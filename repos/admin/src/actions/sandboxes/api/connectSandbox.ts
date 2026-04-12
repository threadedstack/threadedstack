import { sandboxApi } from '@TAF/services'

export type TConnectSandboxOpts = {
  orgId: string
  sandboxId: string
  projectId: string
}

export const connectSandbox = async (opts: TConnectSandboxOpts) => {
  return sandboxApi.connect(opts.orgId, opts.projectId, opts.sandboxId)
}
