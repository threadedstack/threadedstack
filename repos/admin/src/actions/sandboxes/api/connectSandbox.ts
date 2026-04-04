import { sandboxApi } from '@TAF/services'

export type TConnectSandboxOpts = {
  orgId: string
  sandboxId: string
}

export const connectSandbox = async (opts: TConnectSandboxOpts) => {
  return sandboxApi.connect(opts.orgId, opts.sandboxId)
}
