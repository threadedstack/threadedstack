import { sandboxApi } from '@TAF/services'

export const getSandboxStatus = async (opts: {
  orgId: string
  projectId: string
  sandboxId: string
  podName: string
}) => {
  return sandboxApi.status(opts.orgId, opts.projectId, opts.sandboxId, opts.podName)
}
