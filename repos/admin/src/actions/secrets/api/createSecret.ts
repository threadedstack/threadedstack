import { secretsApi } from '@TAF/services'
import { upsertSecret } from '@TAF/actions/secrets/local/upsertSecret'

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
  resp.data && upsertSecret(resp.data)
  return resp
}
