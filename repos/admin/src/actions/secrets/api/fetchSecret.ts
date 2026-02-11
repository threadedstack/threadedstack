import { secretsApi } from '@TAF/services'
import { upsertSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TFetchSecretOpts = {
  id: string
  orgId: string
  projectId?: string
}

export const fetchSecret = async (opts: TFetchSecretOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await secretsApi.get(orgId, id, projectId)
  resp.data && upsertSecret(resp.data)
  return resp
}
