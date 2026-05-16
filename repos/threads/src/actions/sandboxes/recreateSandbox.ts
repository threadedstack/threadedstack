import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { clearStoredSessionsForSandbox } from '@TTH/utils/sessionStorage'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'

export type TRecreateSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const recreateSandbox = async (opts: TRecreateSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts

  await stopSandbox({ sandboxId, orgId, projectId, force: true })
  clearStoredSessionsForSandbox(sandboxId)
  const { cols, rows } = estimateTerminalDimensions()
  await openSession({ sandboxId, orgId, projectId, sessionId: null, cols, rows })
}
