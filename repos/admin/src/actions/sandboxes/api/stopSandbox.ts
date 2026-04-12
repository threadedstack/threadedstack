import { sandboxApi } from '@TAF/services'

export type TStopSandboxOpts = {
  orgId: string
  projectId: string
  sandboxId: string
  podName: string
}

export const stopSandbox = async (opts: TStopSandboxOpts) => {
  return sandboxApi.stop(opts.orgId, opts.projectId, opts.sandboxId, opts.podName)
}
