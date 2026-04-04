import { sandboxApi } from '@TAF/services'

export const getSandboxStatus = async (opts: {
  orgId: string
  sandboxId: string
  podName: string
}) => {
  return sandboxApi.status(opts.orgId, opts.sandboxId, opts.podName)
}
