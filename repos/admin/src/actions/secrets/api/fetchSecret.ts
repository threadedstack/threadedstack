import { secretsApi } from '@TAF/services'
import { upsertSecret, upsertOrgSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TFetchSecretOpts = {
  id: string
  orgId: string
  projectId?: string
}

export const fetchSecret = async (opts: TFetchSecretOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await secretsApi.get(orgId, id, projectId)
  if (resp.data) projectId ? upsertSecret(resp.data) : upsertOrgSecret(resp.data)

  return resp
}
