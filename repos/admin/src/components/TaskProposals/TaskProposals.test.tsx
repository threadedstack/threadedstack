import type { ReactNode } from 'react'

import { makeTheme } from '@tdsk/components'
import { ThemeProvider } from '@mui/material/styles'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, act } from '@testing-library/react'

const theme = makeTheme({ type: 'light' })
const Wrapper = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
)
const renderWithTheme = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper })

const mockUseTaskProposals = vi.fn()

vi.mock(`@TAF/state/selectors`, () => ({
  useTaskProposals: () => mockUseTaskProposals(),
}))

const mockCanUpdate = vi.fn(() => true)

vi.mock(`@TAF/hooks/permissions/usePermissions`, () => ({
  usePermissions: () => ({ canUpdate: mockCanUpdate }),
}))

const mockReviewTaskProposal = vi.fn().mockResolvedValue({ data: {} })

vi.mock(`@TAF/actions/taskProposals/api/reviewTaskProposal`, () => ({
  reviewTaskProposal: (...args: any[]) => mockReviewTaskProposal(...args),
}))

import { TaskProposals } from './TaskProposals'

const mockProposals = {
  'tp-1': {
    id: `tp-1`,
    orgId: `org-1`,
    agentId: `agent-1`,
    title: `Investigate CI flake`,
    description: `CI shows a flaky test on the backend suite`,
    priority: `P1`,
    evidence: `Log excerpt from run #42`,
    sourceSignal: `ci`,
    dedupeKey: `dedupe-1`,
    repos: [`backend`],
    status: `scanned`,
    scanResult: { passed: true, findings: [] },
    auditVerdict: null,
    prUrl: null,
    reason: null,
    parentId: null,
    initiative: null,
    meta: null,
    createdAt: `2026-01-01T00:00:00.000Z`,
  },
  'tp-2': {
    id: `tp-2`,
    orgId: `org-1`,
    agentId: `agent-1`,
    title: `Already resolved task`,
    description: `A previously rejected proposal`,
    priority: `P3`,
    evidence: `Some evidence`,
    sourceSignal: `health`,
    dedupeKey: `dedupe-2`,
    repos: [],
    status: `rejected`,
    scanResult: { passed: false, findings: [`finding-1`] },
    auditVerdict: { approved: false, reason: `Rejected via admin` },
    prUrl: null,
    reason: `Rejected via admin`,
    parentId: null,
    initiative: null,
    meta: null,
    createdAt: `2026-01-02T00:00:00.000Z`,
  },
} as any

describe(`TaskProposals`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanUpdate.mockReturnValue(true)
    mockUseTaskProposals.mockReturnValue([mockProposals])
    mockReviewTaskProposal.mockResolvedValue({ data: {} })
  })

  it(`renders DataTable rows sourced from state`, () => {
    renderWithTheme(<TaskProposals orgId='org-1' />)
    expect(screen.getByText(`Investigate CI flake`)).toBeTruthy()
    expect(screen.getByText(`Already resolved task`)).toBeTruthy()
  })

  it(`displays priority and source signal columns`, () => {
    renderWithTheme(<TaskProposals orgId='org-1' />)
    expect(screen.getByText(`P1`)).toBeTruthy()
    expect(screen.getByText(`ci`)).toBeTruthy()
  })

  it(`displays status chips`, () => {
    renderWithTheme(<TaskProposals orgId='org-1' />)
    expect(screen.getByText(`scanned`)).toBeTruthy()
    expect(screen.getByText(`rejected`)).toBeTruthy()
  })

  it(`shows table column headers`, () => {
    renderWithTheme(<TaskProposals orgId='org-1' />)
    expect(screen.getByText(`Priority`)).toBeTruthy()
    expect(screen.getByText(`Title`)).toBeTruthy()
    expect(screen.getByText(`Source`)).toBeTruthy()
    expect(screen.getByText(`Status`)).toBeTruthy()
    expect(screen.getByText(`Created`)).toBeTruthy()
    expect(screen.getByText(`Actions`)).toBeTruthy()
  })

  it(`shows empty state when no proposals`, () => {
    mockUseTaskProposals.mockReturnValue([{}])
    renderWithTheme(<TaskProposals orgId='org-1' />)
    expect(
      screen.getByText(
        `No task proposals yet. The steward will surface self-sensed tasks here for review.`
      )
    ).toBeTruthy()
  })

  it(`renders exactly one action button (Reject only, no Approve)`, () => {
    renderWithTheme(<TaskProposals orgId='org-1' />)
    const row = screen.getByText(`Investigate CI flake`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    expect(buttons.length).toBe(1)
  })

  it(`disables the reject button for a terminal (rejected) proposal`, () => {
    renderWithTheme(<TaskProposals orgId='org-1' />)
    const row = screen.getByText(`Already resolved task`).closest(`tr`)!
    const button = within(row).getByRole(`button`)
    expect(button).toBeDisabled()
  })

  it(`disables the reject button when the user lacks update permission`, () => {
    mockCanUpdate.mockReturnValue(false)
    renderWithTheme(<TaskProposals orgId='org-1' />)
    const row = screen.getByText(`Investigate CI flake`).closest(`tr`)!
    const button = within(row).getByRole(`button`)
    expect(button).toBeDisabled()
  })

  it(`opens the reject dialog and posts {approve: false, reason} via reviewTaskProposal`, async () => {
    renderWithTheme(<TaskProposals orgId='org-1' />)

    const row = screen.getByText(`Investigate CI flake`).closest(`tr`)!
    fireEvent.click(within(row).getByRole(`button`))

    expect(screen.getByText(`Reject Task Proposal`)).toBeTruthy()
    expect(
      screen.getByText(
        `Rejecting only filters this from the steward's backlog; it never blocks work in flight.`
      )
    ).toBeTruthy()

    fireEvent.change(screen.getByRole(`textbox`, { name: `Rejection Reason` }), {
      target: { value: `Not relevant right now` },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole(`button`, { name: `Reject` }))
    })

    expect(mockReviewTaskProposal).toHaveBeenCalledWith(`org-1`, `tp-1`, {
      approve: false,
      reason: `Not relevant right now`,
    })
  })
})
