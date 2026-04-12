import { clearSessionEvents } from '@TTH/state/accessors'
import { openSession } from '@TTH/actions/sessions'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'

export type TRecreateSandboxOpts = {
  sandboxId: string
  orgId: string
  projectId: string
}

export const recreateSandbox = async (opts: TRecreateSandboxOpts): Promise<void> => {
  const { sandboxId, orgId, projectId } = opts

  await stopSandbox({ sandboxId, orgId })
  sessionStorage.removeItem(`shell_${sandboxId}`)
  clearSessionEvents(sandboxId)
  await openSession({ sandboxId, orgId, projectId, reconnectSessionId: null })
}
