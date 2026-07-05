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

const mockUseVerifications = vi.fn()

vi.mock(`@TAF/state/selectors`, () => ({
  useVerifications: () => mockUseVerifications(),
}))

import { Verifications } from './Verifications'

const mockVerifications = {
  'vf-1': {
    id: `vf-1`,
    orgId: `org-1`,
    agentId: `agent-1`,
    prNumber: 42,
    prUrl: `https://github.com/org/repo/pull/42`,
    mergeSha: `abc123def456789`,
    probe: { kind: `health`, params: { url: `/_/health` } },
    status: `pending`,
    detail: null,
    revertPrUrl: null,
    escalationId: null,
    meta: null,
    createdAt: `2026-01-01T00:00:00.000Z`,
  },
  'vf-2': {
    id: `vf-2`,
    orgId: `org-1`,
    agentId: `agent-1`,
    prNumber: 55,
    prUrl: `https://github.com/org/repo/pull/55`,
    mergeSha: `deadbeef1234`,
    probe: { kind: `ci-green` },
    status: `regressed`,
    detail: `CI failed after deploy`,
    revertPrUrl: `https://github.com/org/repo/pull/57`,
    escalationId: `esc_abc`,
    meta: null,
    createdAt: `2026-01-02T00:00:00.000Z`,
  },
} as any

describe(`Verifications`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseVerifications.mockReturnValue([mockVerifications])
  })

  it(`renders DataTable rows sourced from state`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)
    expect(screen.getByText(`#42`)).toBeTruthy()
    expect(screen.getByText(`#55`)).toBeTruthy()
  })

  it(`displays probe kind and status columns`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)
    expect(screen.getByText(`health`)).toBeTruthy()
    expect(screen.getByText(`ci-green`)).toBeTruthy()
    expect(screen.getByText(`pending`)).toBeTruthy()
    expect(screen.getByText(`regressed`)).toBeTruthy()
  })

  it(`shows table column headers`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)
    expect(screen.getByText(`PR`)).toBeTruthy()
    expect(screen.getByText(`Probe Kind`)).toBeTruthy()
    expect(screen.getByText(`Status`)).toBeTruthy()
    expect(screen.getByText(`Revert PR`)).toBeTruthy()
    expect(screen.getByText(`Created`)).toBeTruthy()
  })

  it(`shows empty state when no verifications`, () => {
    mockUseVerifications.mockReturnValue([{}])
    renderWithTheme(<Verifications orgId='org-1' />)
    expect(
      screen.getByText(
        `No verifications yet. The steward will record post-deploy probe results here.`
      )
    ).toBeTruthy()
  })

  it(`asserts there are NO row action buttons for any row`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)
    const rows = screen.getAllByRole(`row`)
    // First row is header; check all data rows have zero buttons
    const dataRows = rows.slice(1)
    dataRows.forEach((row) => {
      const buttons = within(row).queryAllByRole(`button`)
      expect(buttons.length).toBe(0)
    })
  })

  it(`asserts no resolve, reject, or approve dialog exists`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)
    expect(screen.queryByText(`Resolve`)).toBeNull()
    expect(screen.queryByText(`Reject`)).toBeNull()
    expect(screen.queryByText(`Approve`)).toBeNull()
  })

  it(`opens the drawer when a row is clicked and shows expected fields`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)

    const row = screen.getByText(`#42`).closest(`tr`)!
    fireEvent.click(row)

    // Drawer should be open and show key fields
    expect(screen.getByText(`PR Number`)).toBeTruthy()
    expect(screen.getByText(`Probe`)).toBeTruthy()
    // Status appears in both table header and drawer label; use getAllByText
    expect(screen.getAllByText(`Status`).length).toBeGreaterThan(0)
    // Revert PR appears in both table header and drawer label; use getAllByText
    expect(screen.getAllByText(`Revert PR`).length).toBeGreaterThan(0)
    expect(screen.getByText(`Agent`)).toBeTruthy()
    // Created appears in both table header and drawer label; use getAllByText
    expect(screen.getAllByText(`Created`).length).toBeGreaterThan(0)
    expect(
      screen.getByText(
        `Verifications are read-only observability. Post-deploy remediation (revert PR + escalation) is fully automatic.`
      )
    ).toBeTruthy()
  })

  it(`drawer shows no action buttons`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)

    const row = screen.getByText(`#42`).closest(`tr`)!
    fireEvent.click(row)

    // Verify no Resolve/Reject/Approve buttons in drawer
    expect(screen.queryByRole(`button`, { name: /resolve/i })).toBeNull()
    expect(screen.queryByRole(`button`, { name: /reject/i })).toBeNull()
    expect(screen.queryByRole(`button`, { name: /approve/i })).toBeNull()
  })

  it(`drawer shows escalation link for regressed verifications`, () => {
    renderWithTheme(<Verifications orgId='org-1' />)

    // Click on the regressed row (#55)
    const prLinks = screen.getAllByText(`#55`)
    const row = prLinks[0].closest(`tr`)!
    fireEvent.click(row)

    // Escalation section should be present with a link
    expect(screen.getByText(`Escalation`)).toBeTruthy()
    const escalationLink = screen.getByText(`esc_abc`)
    expect(escalationLink).toBeTruthy()
    const href =
      escalationLink.getAttribute(`href`) ||
      escalationLink.closest(`a`)?.getAttribute(`href`)
    expect(href).toContain(`/orgs/org-1/escalations/esc_abc`)
  })
})
