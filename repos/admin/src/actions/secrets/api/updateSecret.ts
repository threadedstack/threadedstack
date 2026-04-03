import type { Secret } from '@tdsk/domain'
import { secretsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertSecret, upsertOrgSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TUpdateSecretOpts = {
  orgId: string
  id: string
  data: Partial<Secret>
  projectId?: string
}

export const updateSecret = async (opts: TUpdateSecretOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await secretsApi.update(orgId, id, data, projectId)
  if (resp.data)
    projectId ? upsertSecret(projectId, resp.data) : upsertOrgSecret(resp.data)

  resp.data && query.upsertListCache(secretsApi.cache.list(orgId, projectId), resp.data)
  resp.data && query.updateDetailCache(secretsApi.cache.detail(id), resp.data)

  return resp
}
