import { secretsApi } from '@TAF/services'
import { setSecrets, setOrgSecrets } from '@TAF/actions/secrets/local/setSecrets'

export type TFetchSecretsOpts = {
  orgId: string
  projectId?: string
}

export const fetchSecrets = async (opts: TFetchSecretsOpts) => {
  const { orgId, projectId } = opts
  const resp = await secretsApi.list(orgId, projectId)
  if (resp.data) projectId ? setSecrets(projectId, resp.data) : setOrgSecrets(resp.data)

  return resp
}
