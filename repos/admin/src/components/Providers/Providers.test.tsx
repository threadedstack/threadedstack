import type { ReactNode } from 'react'

import { makeTheme } from '@tdsk/components'
import { ThemeProvider } from '@mui/material/styles'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const theme = makeTheme({ type: 'light' })
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

const mockUseProviders = vi.fn()

vi.mock(`@TAF/state/selectors`, () => ({
  useProviders: () => mockUseProviders(),
}))

const mockCanCreate = vi.fn(() => true)
const mockCanUpdate = vi.fn(() => true)
const mockCanDelete = vi.fn(() => true)

vi.mock(`@TAF/hooks/permissions/usePermissions`, () => ({
  usePermissions: () => ({
    canCreate: mockCanCreate,
    canUpdate: mockCanUpdate,
    canDelete: mockCanDelete,
  }),
}))

vi.mock(`@TAF/actions/providers`, () => ({
  deleteProvider: vi.fn().mockResolvedValue({ data: {} }),
}))

vi.mock(`@TAF/components/Providers/ProviderDrawer`, () => ({
  ProviderDrawer: () => null,
}))

vi.mock(`@tdsk/components`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/components')>()
  return {
    ...actual,
    ConfirmDelete: () => null,
  }
})

import { Providers } from './Providers'

const mockProviders = {
  'provider-1': {
    id: `provider-1`,
    name: `Anthropic`,
    type: `ai`,
    brand: `anthropic`,
    options: {},
  },
  'provider-2': {
    id: `provider-2`,
    name: `OpenAI`,
    type: `ai`,
    brand: `openai`,
    options: {},
  },
  'provider-3': {
    id: `provider-3`,
    name: `GHCR`,
    type: `docker`,
    brand: `ghcr`,
    options: {},
  },
}

describe(`Providers`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanCreate.mockReturnValue(true)
    mockCanUpdate.mockReturnValue(true)
    mockCanDelete.mockReturnValue(true)
    mockUseProviders.mockReturnValue([mockProviders])
  })

  it(`renders all providers under the All tab by default`, () => {
    renderWithTheme(<Providers orgId='org-1' />)
    expect(screen.getByText(`Anthropic`)).toBeTruthy()
    expect(screen.getByText(`OpenAI`)).toBeTruthy()
    expect(screen.getByText(`GHCR`)).toBeTruthy()
  })

  it(`shows a tab per provider type with a count`, () => {
    renderWithTheme(<Providers orgId='org-1' />)
    expect(screen.getByRole(`tab`, { name: `All (3)` })).toBeTruthy()
    expect(screen.getByRole(`tab`, { name: `AI (2)` })).toBeTruthy()
    expect(screen.getByRole(`tab`, { name: `Docker (1)` })).toBeTruthy()
    expect(screen.getByRole(`tab`, { name: `Git (0)` })).toBeTruthy()
  })

  it(`filters the table to only the selected provider type`, () => {
    renderWithTheme(<Providers orgId='org-1' />)

    fireEvent.click(screen.getByRole(`tab`, { name: `Docker (1)` }))

    expect(screen.getByText(`GHCR`)).toBeTruthy()
    expect(screen.queryByText(`Anthropic`)).toBeNull()
    expect(screen.queryByText(`OpenAI`)).toBeNull()
  })

  it(`shows an empty state when the selected type has no providers`, () => {
    renderWithTheme(<Providers orgId='org-1' />)

    fireEvent.click(screen.getByRole(`tab`, { name: `Git (0)` }))

    expect(screen.getByText(`No Git providers yet.`)).toBeTruthy()
    expect(screen.queryByText(`Anthropic`)).toBeNull()
  })

  it(`does not render type tabs when there are no providers`, () => {
    mockUseProviders.mockReturnValue([{}])
    renderWithTheme(<Providers orgId='org-1' />)
    expect(screen.queryByRole(`tab`)).toBeNull()
  })

  it(`combines the active type tab with the search query`, () => {
    renderWithTheme(<Providers orgId='org-1' />)

    fireEvent.click(screen.getByRole(`tab`, { name: `AI (2)` }))
    fireEvent.change(
      screen.getByPlaceholderText(`Search providers by name, type, or URL...`),
      { target: { value: `openai` } }
    )

    expect(screen.getByText(`OpenAI`)).toBeTruthy()
    expect(screen.queryByText(`Anthropic`)).toBeNull()
    expect(screen.queryByText(`GHCR`)).toBeNull()
  })
})
