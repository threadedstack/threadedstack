import { sandboxApi } from '@TAF/services'

export const getSandboxSessions = async (opts: { orgId: string; sandboxId: string }) => {
  return sandboxApi.sessions(opts.orgId, opts.sandboxId)
}
