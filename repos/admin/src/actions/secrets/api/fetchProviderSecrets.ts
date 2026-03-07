import { secretsApi } from '@TAF/services'

export type TFetchProviderSecretsOpts = {
  orgId: string
  providerId: string
}

export const fetchProviderSecrets = async (opts: TFetchProviderSecretsOpts) => {
  const { orgId, providerId } = opts
  return secretsApi.list(orgId, undefined, {
    providerId,
    queryKey: ['secrets', 'provider', providerId, 'list'],
  })
}
