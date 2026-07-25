import type { ReactNode } from 'react'

import { makeTheme } from '@tdsk/components'
import { ThemeProvider } from '@mui/material/styles'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'

const theme = makeTheme({ type: 'light' })
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

const mockUseProjectCollections = vi.fn()
const mockCanCreate = vi.fn(() => true)
const mockCanUpdate = vi.fn(() => true)
const mockCanDelete = vi.fn(() => true)

vi.mock(`@TAF/state/selectors`, () => ({
  useProjectCollections: () => mockUseProjectCollections(),
}))

vi.mock(`@TAF/hooks/permissions/usePermissions`, () => ({
  usePermissions: () => ({
    canCreate: mockCanCreate,
    canUpdate: mockCanUpdate,
    canDelete: mockCanDelete,
  }),
}))

const deleteCollection = vi.fn().mockResolvedValue({ data: { success: true } })
vi.mock(`@TAF/actions/collections/api/deleteCollection`, () => ({
  deleteCollection: (...args: any[]) => deleteCollection(...args),
}))

vi.mock(`@TAF/components/Collections/CollectionDrawer`, () => ({
  CollectionDrawer: ({ open, collection }: any) =>
    open ? (
      <div data-testid='collection-drawer'>{collection ? collection.name : `new`}</div>
    ) : null,
}))

import { Collections } from './Collections'

const mockCollections = {
  col_tasks01: {
    id: `col_tasks01`,
    name: `tasks`,
    description: `Agent task tracking`,
    schema: [{ name: `status`, type: `string` }],
    projectId: `project-1`,
    recordCount: 4,
    createdAt: `2026-01-01T00:00:00.000Z`,
  },
  col_notes01: {
    id: `col_notes01`,
    name: `notes`,
    description: null,
    schema: null,
    projectId: `project-1`,
    recordCount: 0,
    createdAt: `2026-01-02T00:00:00.000Z`,
  },
} as any

const defaultProps = { orgId: `org-1`, projectId: `project-1` }

describe(`Collections`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanCreate.mockReturnValue(true)
    mockCanUpdate.mockReturnValue(true)
    mockCanDelete.mockReturnValue(true)
    mockUseProjectCollections.mockReturnValue([mockCollections])
  })

  it(`renders DataTable rows sourced from state`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    expect(screen.getByText(`tasks`)).toBeTruthy()
    expect(screen.getByText(`notes`)).toBeTruthy()
  })

  it(`shows each collection's record count`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    expect(screen.getByText(`4`)).toBeTruthy()
    expect(screen.getByText(`0`)).toBeTruthy()
  })

  it(`shows schema field count for schema'd collections and "Schemaless" otherwise`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    expect(screen.getByText(`1 fields`)).toBeTruthy()
    expect(screen.getByText(`Schemaless`)).toBeTruthy()
  })

  it(`shows table column headers`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    expect(screen.getByText(`Name`)).toBeTruthy()
    expect(screen.getByText(`Description`)).toBeTruthy()
    expect(screen.getByText(`Schema`)).toBeTruthy()
    expect(screen.getByText(`Records`)).toBeTruthy()
    expect(screen.getByText(`Created`)).toBeTruthy()
    expect(screen.getByText(`Actions`)).toBeTruthy()
  })

  it(`shows a loading skeleton while the map is undefined`, () => {
    mockUseProjectCollections.mockReturnValue([undefined])
    renderWithTheme(<Collections {...defaultProps} />)
    expect(screen.queryByText(`tasks`)).toBeNull()
  })

  it(`shows empty state with a create action when no collections`, () => {
    mockUseProjectCollections.mockReturnValue([{}])
    renderWithTheme(<Collections {...defaultProps} />)
    expect(
      screen.getByText(`No collections yet. Create your first collection to get started.`)
    ).toBeTruthy()
    expect(screen.getByText(`Create Collection`)).toBeTruthy()
  })

  it(`renders an Edit and Delete action button for every row`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    const rows = screen.getAllByRole(`row`)
    const dataRows = rows.slice(1)
    dataRows.forEach((row) => {
      const buttons = within(row).queryAllByRole(`button`)
      expect(buttons.length).toBe(2)
    })
  })

  it(`opens the drawer in create mode from the header action`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    fireEvent.click(screen.getByText(`Create Collection`))
    expect(screen.getByTestId(`collection-drawer`).textContent).toBe(`new`)
  })

  it(`opens the drawer pre-filled with the clicked collection on row click`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    fireEvent.click(screen.getByText(`tasks`))
    expect(screen.getByTestId(`collection-drawer`).textContent).toBe(`tasks`)
  })

  it(`opens the drawer pre-filled with the clicked collection on Edit click`, () => {
    renderWithTheme(<Collections {...defaultProps} />)
    const rows = screen.getAllByRole(`row`)
    const [editButton] = within(rows[1]).getAllByRole(`button`)
    fireEvent.click(editButton)
    expect(screen.getByTestId(`collection-drawer`).textContent).toBe(`tasks`)
  })

  it(`disables the create action when the user lacks create permission`, () => {
    mockCanCreate.mockReturnValue(false)
    renderWithTheme(<Collections {...defaultProps} />)
    expect(screen.getByText(`Create Collection`).closest(`button`)).toBeDisabled()
  })

  it(`confirms and calls deleteCollection with the collection's name and id`, async () => {
    renderWithTheme(<Collections {...defaultProps} />)
    const rows = screen.getAllByRole(`row`)
    const [, deleteButton] = within(rows[1]).getAllByRole(`button`)
    fireEvent.click(deleteButton)

    const confirmButton = screen.getByText(`Confirm`)
    await fireEvent.click(confirmButton)

    expect(deleteCollection).toHaveBeenCalledWith(
      `org-1`,
      `project-1`,
      `tasks`,
      `col_tasks01`
    )
  })
})
