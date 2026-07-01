import { providersApi } from '@TAF/services/providersApi'

export type TFetchProviderModelsOpts = {
  orgId: string
  brand: string
  baseUrl?: string
}

export const fetchProviderModels = async (opts: TFetchProviderModelsOpts) => {
  const { orgId, brand, ...rest } = opts
  const resp = await providersApi.fetchModels(orgId, brand, rest)
  if (resp.error) return { error: resp.error }

  return resp
}
