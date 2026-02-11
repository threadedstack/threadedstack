import { secretsApi } from '@TAF/services'
import { setSecrets } from '@TAF/actions/secrets/local/setSecrets'

export type TFetchSecretsOpts = {
  orgId: string
  projectId?: string
}

export const fetchSecrets = async (opts: TFetchSecretsOpts) => {
  const { orgId, projectId } = opts
  const resp = await secretsApi.list(orgId, projectId)
  resp.data && setSecrets(resp.data)
  return resp
}
