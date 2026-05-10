import { sandboxApi } from '@TAF/services'

export type TStopSandboxOpts = {
  orgId: string
  force?: boolean
  podName?: string
  projectId: string
  sandboxId: string
  stopAll?: boolean
}

export const stopSandbox = async (opts: TStopSandboxOpts) => {
  const { orgId, force, stopAll, podName, projectId, sandboxId } = opts

  return sandboxApi.stop(orgId, projectId, sandboxId, {
    ...(podName ? { podName } : {}),
    ...(stopAll ? { stopAll } : {}),
    ...(force ? { force } : {}),
  })
}
