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

const mockUseEscalations = vi.fn()

vi.mock(`@TAF/state/selectors`, () => ({
  useEscalations: () => mockUseEscalations(),
}))

const mockCanUpdate = vi.fn(() => true)

vi.mock(`@TAF/hooks/permissions/usePermissions`, () => ({
  usePermissions: () => ({ canUpdate: mockCanUpdate }),
}))

const mockResolveEscalation = vi.fn().mockResolvedValue({ data: {} })

vi.mock(`@TAF/actions/escalations/api/resolveEscalation`, () => ({
  resolveEscalation: (...args: any[]) => mockResolveEscalation(...args),
}))

import { Escalations } from './Escalations'

const mockEscalations = {
  'esc-1': {
    id: `esc-1`,
    orgId: `org-1`,
    agentId: `agent-1`,
    title: `Need secrets vault access`,
    problem: `Cannot read STRIPE_SECRET_KEY from environment`,
    evidence: [`Error log: STRIPE_SECRET_KEY not found`, `Run #42 output`],
    proposedPatch: null,
    target: `secrets`,
    status: `open`,
    dedupeKey: `dedupe-1`,
    issueRef: `https://github.com/org/repo/issues/1`,
    resolvedRef: null,
    reason: null,
    meta: null,
    createdAt: `2026-01-01T00:00:00.000Z`,
  },
  'esc-2': {
    id: `esc-2`,
    orgId: `org-1`,
    agentId: `agent-1`,
    title: `Already resolved escalation`,
    problem: `Previously resolved need`,
    evidence: [],
    proposedPatch: `diff --git a/foo.ts b/foo.ts\n+const x = 1`,
    target: `app`,
    status: `resolved`,
    dedupeKey: `dedupe-2`,
    issueRef: null,
    resolvedRef: `https://github.com/org/repo/pull/99`,
    reason: null,
    meta: null,
    createdAt: `2026-01-02T00:00:00.000Z`,
  },
} as any

describe(`Escalations`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanUpdate.mockReturnValue(true)
    mockUseEscalations.mockReturnValue([mockEscalations])
    mockResolveEscalation.mockResolvedValue({ data: {} })
  })

  it(`renders DataTable rows sourced from state`, () => {
    renderWithTheme(<Escalations orgId='org-1' />)
    expect(screen.getByText(`Need secrets vault access`)).toBeTruthy()
    expect(screen.getByText(`Already resolved escalation`)).toBeTruthy()
  })

  it(`displays target and status columns`, () => {
    renderWithTheme(<Escalations orgId='org-1' />)
    expect(screen.getByText(`secrets`)).toBeTruthy()
    expect(screen.getByText(`open`)).toBeTruthy()
    expect(screen.getByText(`resolved`)).toBeTruthy()
  })

  it(`shows table column headers`, () => {
    renderWithTheme(<Escalations orgId='org-1' />)
    expect(screen.getByText(`Target`)).toBeTruthy()
    expect(screen.getByText(`Title`)).toBeTruthy()
    expect(screen.getByText(`Status`)).toBeTruthy()
    expect(screen.getByText(`Created`)).toBeTruthy()
    expect(screen.getByText(`Actions`)).toBeTruthy()
  })

  it(`shows empty state when no escalations`, () => {
    mockUseEscalations.mockReturnValue([{}])
    renderWithTheme(<Escalations orgId='org-1' />)
    expect(
      screen.getByText(
        `No escalations yet. The steward will surface needs it cannot yet act on here.`
      )
    ).toBeTruthy()
  })

  it(`renders exactly two action buttons (Resolve and Reject) for non-terminal row`, () => {
    renderWithTheme(<Escalations orgId='org-1' />)
    const row = screen.getByText(`Need secrets vault access`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    expect(buttons.length).toBe(2)
  })

  it(`disables both action buttons for a terminal (resolved) escalation`, () => {
    renderWithTheme(<Escalations orgId='org-1' />)
    const row = screen.getByText(`Already resolved escalation`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    expect(buttons.length).toBe(2)
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it(`disables both action buttons when the user lacks update permission`, () => {
    mockCanUpdate.mockReturnValue(false)
    renderWithTheme(<Escalations orgId='org-1' />)
    const row = screen.getByText(`Need secrets vault access`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    buttons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it(`opens the resolve dialog and posts {status:'resolved', resolvedRef} via resolveEscalation`, async () => {
    renderWithTheme(<Escalations orgId='org-1' />)

    const row = screen.getByText(`Need secrets vault access`).closest(`tr`)!
    const [resolveBtn] = within(row).getAllByRole(`button`)
    fireEvent.click(resolveBtn)

    expect(screen.getByText(`Resolve Escalation`)).toBeTruthy()
    expect(
      screen.getAllByText(`This is an async override; it does not block the agent.`)
        .length
    ).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole(`textbox`, { name: `Resolved Ref (PR URL)` }), {
      target: { value: `https://github.com/org/repo/pull/123` },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole(`button`, { name: `Resolve` }))
    })

    expect(mockResolveEscalation).toHaveBeenCalledWith(`org-1`, `esc-1`, {
      status: 'resolved',
      resolvedRef: `https://github.com/org/repo/pull/123`,
    })
  })

  it(`opens the reject dialog and posts {status:'rejected', reason} via resolveEscalation`, async () => {
    renderWithTheme(<Escalations orgId='org-1' />)

    const row = screen.getByText(`Need secrets vault access`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    const rejectBtn = buttons[1]
    fireEvent.click(rejectBtn)

    expect(screen.getByText(`Reject Escalation`)).toBeTruthy()
    expect(
      screen.getAllByText(`This is an async override; it does not block the agent.`)
        .length
    ).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole(`textbox`, { name: `Rejection Reason` }), {
      target: { value: `Not actionable at this time` },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole(`button`, { name: `Reject` }))
    })

    expect(mockResolveEscalation).toHaveBeenCalledWith(`org-1`, `esc-1`, {
      status: 'rejected',
      reason: `Not actionable at this time`,
    })
  })
})
