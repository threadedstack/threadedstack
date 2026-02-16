import { secretsApi } from '@TAF/services'
import { upsertSecret, upsertOrgSecret } from '@TAF/actions/secrets/local/upsertSecret'

export type TCreateSecretOpts = {
  orgId: string
  name: string
  value: string
  projectId?: string
  providerId?: string
  description?: string
}

export const createSecret = async (opts: TCreateSecretOpts) => {
  const { orgId, projectId, ...data } = opts
  const resp = await secretsApi.create(orgId, data, projectId)
  if (resp.data) projectId ? upsertSecret(resp.data) : upsertOrgSecret(resp.data)

  return resp
}
