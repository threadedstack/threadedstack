import { sandboxApi } from '@TAF/services'

export type TGetSandboxStatus = {
  orgId: string
  projectId: string
  sandboxId: string
  instanceId: string
}

export const getSandboxStatus = async (opts: TGetSandboxStatus) => {
  return sandboxApi.status(opts.orgId, opts.projectId, opts.sandboxId, opts.instanceId)
}
