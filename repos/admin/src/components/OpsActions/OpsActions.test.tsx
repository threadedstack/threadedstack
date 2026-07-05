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

const mockUseOpsActions = vi.fn()

vi.mock(`@TAF/state/selectors`, () => ({
  useOpsActions: () => mockUseOpsActions(),
}))

const mockCanUpdate = vi.fn(() => true)

vi.mock(`@TAF/hooks/permissions/usePermissions`, () => ({
  usePermissions: () => ({ canUpdate: mockCanUpdate }),
}))

const mockOverrideOpsAction = vi.fn().mockResolvedValue({ data: {} })

vi.mock(`@TAF/actions/opsActions/api/overrideOpsAction`, () => ({
  overrideOpsAction: (...args: any[]) => mockOverrideOpsAction(...args),
}))

import { OpsActions } from './OpsActions'
import { EOpsActionStatus } from '@tdsk/domain'

const mockOpsActions = {
  'oa-1': {
    id: `oa-1`,
    orgId: `org-1`,
    agentId: `agent-1`,
    action: `restartDeployment`,
    params: { deployment: `tdsk-backend`, reason: `Memory leak` },
    dryRun: true,
    dryRunResult: null,
    result: null,
    status: EOpsActionStatus.dryRun,
    scanResult: { passed: true, findings: [] },
    reviewVerdict: null,
    rollback: { kind: `restart`, prevRevision: `1` },
    reason: null,
    meta: null,
    createdAt: `2026-01-01T00:00:00.000Z`,
  },
  'oa-2': {
    id: `oa-2`,
    orgId: `org-1`,
    agentId: `agent-1`,
    action: `triggerRedeploy`,
    params: { reason: `Bug fix` },
    dryRun: false,
    dryRunResult: {
      ok: true,
      data: {},
      startedAt: `2026-01-01T00:00:00.000Z`,
      completedAt: `2026-01-01T00:00:01.000Z`,
    },
    result: {
      ok: true,
      data: {},
      startedAt: `2026-01-01T00:00:00.000Z`,
      completedAt: `2026-01-01T00:00:01.000Z`,
    },
    status: EOpsActionStatus.executed,
    scanResult: { passed: true, findings: [] },
    reviewVerdict: { approved: true, reason: `approved`, by: `user-1` },
    rollback: { kind: `redeploy`, prevSha: `abc123` },
    reason: null,
    meta: null,
    createdAt: `2026-01-02T00:00:00.000Z`,
  },
  'oa-3': {
    id: `oa-3`,
    orgId: `org-1`,
    agentId: `agent-1`,
    action: `podStatus`,
    params: { component: `tdsk-backend` },
    dryRun: false,
    dryRunResult: null,
    result: { ok: true, data: { pods: [] } },
    status: EOpsActionStatus.rejected,
    scanResult: { passed: false, findings: [`not allowed`] },
    reviewVerdict: null,
    rollback: null,
    reason: `Scan rejected`,
    meta: null,
    createdAt: `2026-01-03T00:00:00.000Z`,
  },
  'oa-4': {
    id: `oa-4`,
    orgId: `org-1`,
    agentId: `agent-1`,
    action: `applySandboxConfig`,
    params: { sandboxId: `sb_1`, patch: { runtime: `bun` }, reason: `upgrade` },
    dryRun: false,
    dryRunResult: null,
    result: { ok: false, error: `sandbox not found` },
    status: EOpsActionStatus.failed,
    scanResult: { passed: true, findings: [] },
    reviewVerdict: null,
    rollback: null,
    reason: `execution failed`,
    meta: null,
    createdAt: `2026-01-04T00:00:00.000Z`,
  },
} as any

describe(`OpsActions`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanUpdate.mockReturnValue(true)
    mockUseOpsActions.mockReturnValue([mockOpsActions])
    mockOverrideOpsAction.mockResolvedValue({ data: {} })
  })

  it(`renders DataTable rows sourced from state`, () => {
    renderWithTheme(<OpsActions orgId='org-1' />)
    expect(screen.getByText(`restartDeployment`)).toBeTruthy()
    expect(screen.getByText(`triggerRedeploy`)).toBeTruthy()
  })

  it(`shows table column headers`, () => {
    renderWithTheme(<OpsActions orgId='org-1' />)
    expect(screen.getByText(`Action`)).toBeTruthy()
    expect(screen.getByText(`Agent`)).toBeTruthy()
    expect(screen.getByText(`Status`)).toBeTruthy()
    expect(screen.getByText(`Created`)).toBeTruthy()
    expect(screen.getByText(`Actions`)).toBeTruthy()
  })

  it(`shows empty state when no ops actions`, () => {
    mockUseOpsActions.mockReturnValue([{}])
    renderWithTheme(<OpsActions orgId='org-1' />)
    expect(
      screen.getByText(
        `No ops actions yet. The steward will record ops actions here as it operates.`
      )
    ).toBeTruthy()
  })

  it(`dryRun row shows Approve and Reject buttons`, () => {
    renderWithTheme(<OpsActions orgId='org-1' />)
    const row = screen.getByText(`restartDeployment`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    expect(buttons.length).toBe(2)
  })

  it(`executed row shows only a Revert button`, () => {
    renderWithTheme(<OpsActions orgId='org-1' />)
    const row = screen.getByText(`triggerRedeploy`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    expect(buttons.length).toBe(1)
  })

  it(`rejected row shows no action buttons`, () => {
    renderWithTheme(<OpsActions orgId='org-1' />)
    const rows = screen.getAllByText(`rejected`)
    const rejectedRow = rows[0].closest(`tr`)!
    const buttons = within(rejectedRow).queryAllByRole(`button`)
    expect(buttons.length).toBe(0)
  })

  it(`failed row shows no action buttons`, () => {
    renderWithTheme(<OpsActions orgId='org-1' />)
    const failedRow = screen.getByText(`failed`).closest(`tr`)!
    const buttons = within(failedRow).queryAllByRole(`button`)
    expect(buttons.length).toBe(0)
  })

  it(`opens Approve dialog on dryRun row and calls override({approve:true})`, async () => {
    renderWithTheme(<OpsActions orgId='org-1' />)

    const row = screen.getByText(`restartDeployment`).closest(`tr`)!
    const [approveBtn] = within(row).getAllByRole(`button`)
    fireEvent.click(approveBtn)

    expect(screen.getByText(`Approve Ops Action`)).toBeTruthy()
    expect(screen.getAllByText(/Async override/).length).toBeGreaterThan(0)

    await act(async () => {
      fireEvent.click(screen.getByRole(`button`, { name: `Approve` }))
    })

    expect(mockOverrideOpsAction).toHaveBeenCalledWith(`org-1`, `oa-1`, {
      approve: true,
      reason: undefined,
    })
  })

  it(`opens Reject dialog on dryRun row and calls override({approve:false, reason})`, async () => {
    renderWithTheme(<OpsActions orgId='org-1' />)

    const row = screen.getByText(`restartDeployment`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    const rejectBtn = buttons[1]
    fireEvent.click(rejectBtn)

    expect(screen.getByText(`Reject Ops Action`)).toBeTruthy()
    expect(screen.getAllByText(/Async override/).length).toBeGreaterThan(0)

    fireEvent.change(screen.getByRole(`textbox`, { name: `Rejection Reason` }), {
      target: { value: `Not safe right now` },
    })

    await act(async () => {
      fireEvent.click(screen.getByRole(`button`, { name: `Reject` }))
    })

    expect(mockOverrideOpsAction).toHaveBeenCalledWith(`org-1`, `oa-1`, {
      approve: false,
      reason: `Not safe right now`,
    })
  })

  it(`Revert button on executed row calls override({approve:false})`, async () => {
    renderWithTheme(<OpsActions orgId='org-1' />)

    const row = screen.getByText(`triggerRedeploy`).closest(`tr`)!
    const [revertBtn] = within(row).getAllByRole(`button`)
    await act(async () => {
      fireEvent.click(revertBtn)
    })

    expect(mockOverrideOpsAction).toHaveBeenCalledWith(`org-1`, `oa-2`, {
      approve: false,
      reason: undefined,
    })
  })

  it(`disables all action buttons when user lacks update permission`, () => {
    mockCanUpdate.mockReturnValue(false)
    renderWithTheme(<OpsActions orgId='org-1' />)
    const dryRunRow = screen.getByText(`restartDeployment`).closest(`tr`)!
    within(dryRunRow)
      .getAllByRole(`button`)
      .forEach((btn) => expect(btn).toBeDisabled())
    const executedRow = screen.getByText(`triggerRedeploy`).closest(`tr`)!
    within(executedRow)
      .getAllByRole(`button`)
      .forEach((btn) => expect(btn).toBeDisabled())
  })
})
