import { sandboxApi } from '@TAF/services'

export type TStopSandboxOpts = {
  orgId: string
  sandboxId: string
  podName: string
}

export const stopSandbox = async (opts: TStopSandboxOpts) => {
  return sandboxApi.stop(opts.orgId, opts.sandboxId, opts.podName)
}
