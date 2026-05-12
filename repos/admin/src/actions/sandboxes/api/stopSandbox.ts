import { sandboxApi } from '@TAF/services'

export type TStopSandboxOpts = {
  orgId: string
  force?: boolean
  projectId: string
  sandboxId: string
  stopAll?: boolean
  instanceId?: string
}

export const stopSandbox = async (opts: TStopSandboxOpts) => {
  const { orgId, force, stopAll, instanceId, projectId, sandboxId } = opts

  return sandboxApi.stop(orgId, projectId, sandboxId, {
    ...(instanceId ? { instanceId } : {}),
    ...(stopAll ? { stopAll } : {}),
    ...(force ? { force } : {}),
  })
}
