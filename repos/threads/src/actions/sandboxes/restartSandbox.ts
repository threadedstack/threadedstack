import { getSessionsForSandbox } from '@TTH/state/accessors'
import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'

export type TRestartSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const restartSandbox = async (opts: TRestartSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts
  const sessions = getSessionsForSandbox(sandboxId)
  const sessionIds = sessions.map((s) => s.sessionId)

  await stopSandbox({ sandboxId, orgId })

  for (const _sid of sessionIds) {
    try {
      await openSession({ sandboxId, orgId, projectId, sessionId: null })
    } catch (err) {
      console.error(`[restartSandbox] Failed to reopen session:`, err)
    }
  }
}
