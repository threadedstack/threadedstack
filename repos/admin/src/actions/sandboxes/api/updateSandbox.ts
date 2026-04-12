import type { Sandbox } from '@tdsk/domain'

import { sandboxApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertSandbox } from '@TAF/actions/sandboxes/local/upsertSandbox'

export type TUpdateSandboxOpts = {
  id: string
  orgId: string
  projectId?: string
  data: Partial<Sandbox>
}

export const updateSandbox = async (opts: TUpdateSandboxOpts) => {
  const { orgId, id, projectId, data } = opts
  const resp = await sandboxApi.update(orgId, id, data, projectId)

  if (resp.error) return { error: resp.error }

  const contextKey = projectId || `org`
  resp.data && upsertSandbox(contextKey, resp.data)
  resp.data && query.upsertListCache(sandboxApi.cache.list(orgId, contextKey), resp.data)
  resp.data && query.updateDetailCache(sandboxApi.cache.detail(id), resp.data)

  return resp
}
