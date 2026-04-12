import { getOpenSessions } from '@TTH/state/accessors'
import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'

export type TRestartSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const restartSandbox = async (opts: TRestartSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts
  const session = getOpenSessions().get(sandboxId)
  const reconnectSessionId = session?.sessionId

  await stopSandbox({ sandboxId, orgId })
  await openSession({ sandboxId, orgId, projectId, reconnectSessionId })
}
