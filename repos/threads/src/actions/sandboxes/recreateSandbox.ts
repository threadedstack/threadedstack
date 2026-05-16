import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { openSession, clearStoredSessionsForSandbox } from '@TTH/actions/sessions'

export type TRecreateSandboxOpts = {
  orgId: string
  sandboxId: string
  projectId: string
}

export const recreateSandbox = async (opts: TRecreateSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts

  await stopSandbox({ sandboxId, orgId, projectId, force: true })
  clearStoredSessionsForSandbox(sandboxId)
  const { cols, rows } = estimateTerminalDimensions()
  await openSession({ sandboxId, orgId, projectId, sessionId: null, cols, rows })
}
