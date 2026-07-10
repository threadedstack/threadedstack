import type { ReactNode } from 'react'

import { makeTheme } from '@tdsk/components'
import { ThemeProvider } from '@mui/material/styles'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const theme = makeTheme({ type: 'light' })
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

const mockUseProjectCollections = vi.fn()

vi.mock(`@TAF/state/selectors`, () => ({
  useProjectCollections: () => mockUseProjectCollections(),
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

describe(`Collections`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseProjectCollections.mockReturnValue([mockCollections])
  })

  it(`renders DataTable rows sourced from state`, () => {
    renderWithTheme(<Collections />)
    expect(screen.getByText(`tasks`)).toBeTruthy()
    expect(screen.getByText(`notes`)).toBeTruthy()
  })

  it(`shows each collection's record count`, () => {
    renderWithTheme(<Collections />)
    expect(screen.getByText(`4`)).toBeTruthy()
    expect(screen.getByText(`0`)).toBeTruthy()
  })

  it(`shows schema field count for schema'd collections and "Schemaless" otherwise`, () => {
    renderWithTheme(<Collections />)
    expect(screen.getByText(`1 fields`)).toBeTruthy()
    expect(screen.getByText(`Schemaless`)).toBeTruthy()
  })

  it(`shows table column headers`, () => {
    renderWithTheme(<Collections />)
    expect(screen.getByText(`Name`)).toBeTruthy()
    expect(screen.getByText(`Description`)).toBeTruthy()
    expect(screen.getByText(`Schema`)).toBeTruthy()
    expect(screen.getByText(`Records`)).toBeTruthy()
    expect(screen.getByText(`Created`)).toBeTruthy()
  })

  it(`shows a loading skeleton while the map is undefined`, () => {
    mockUseProjectCollections.mockReturnValue([undefined])
    renderWithTheme(<Collections />)
    expect(screen.queryByText(`tasks`)).toBeNull()
  })

  it(`shows empty state when no collections`, () => {
    mockUseProjectCollections.mockReturnValue([{}])
    renderWithTheme(<Collections />)
    expect(
      screen.getByText(
        `No collections yet. Collections are created by agents and Functions through the Collections/Records API.`
      )
    ).toBeTruthy()
  })

  it(`asserts there are NO row action buttons for any row (read-only)`, () => {
    renderWithTheme(<Collections />)
    const rows = screen.getAllByRole(`row`)
    const dataRows = rows.slice(1)
    dataRows.forEach((row) => {
      const buttons = within(row).queryAllByRole(`button`)
      expect(buttons.length).toBe(0)
    })
  })
})
