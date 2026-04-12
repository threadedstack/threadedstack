import { sandboxApi } from '@TAF/services'

export const getSandboxSessions = async (opts: {
  orgId: string
  projectId: string
  sandboxId: string
}) => {
  return sandboxApi.sessions(opts.orgId, opts.projectId, opts.sandboxId)
}
