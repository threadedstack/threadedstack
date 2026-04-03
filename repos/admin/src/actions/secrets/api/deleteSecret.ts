import { secretsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeSecret, removeOrgSecret } from '@TAF/actions/secrets/local/removeSecret'

export type TDeleteSecretOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const deleteSecret = async (opts: TDeleteSecretOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await secretsApi.delete(orgId, id, projectId)
  if (resp.error) return { error: resp.error }

  projectId ? removeSecret(projectId, id) : removeOrgSecret(id)
  query.removeFromListCache(secretsApi.cache.list(orgId, projectId), id)
  query.client.removeQueries({ queryKey: secretsApi.cache.detail(id) })

  return { success: true }
}
