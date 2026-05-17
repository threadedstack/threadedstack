import type { TSandboxActionOpts } from '@TTH/types'

import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { openSession, clearStoredSessionsForSandbox } from '@TTH/actions/sessions'

export const recreateSandbox = async (opts: TSandboxActionOpts): Promise<void> => {
  const { sandboxId, orgId, projectId, instanceId } = opts

  await stopSandbox({ sandboxId, orgId, projectId, instanceId, force: true })
  clearStoredSessionsForSandbox(sandboxId)

  const { cols, rows } = estimateTerminalDimensions()
  try {
    await openSession({
      cols,
      rows,
      orgId,
      sandboxId,
      projectId,
      instanceId,
      sessionId: null,
    })
  } catch (err) {
    throw new Error(
      `Sandbox was stopped but failed to start a new session: ${err instanceof Error ? err.message : err}`
    )
  }
}
