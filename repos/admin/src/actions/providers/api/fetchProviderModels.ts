import { providersApi } from '@TAF/services/providersApi'

export type TFetchProviderModelsOpts = {
  brand: string
  baseUrl?: string
  providerKey?: string
}

export const fetchProviderModels = async (opts: TFetchProviderModelsOpts) => {
  const { brand, ...rest } = opts
  const resp = await providersApi.fetchModels(brand, rest)
  if (resp.error) return { error: resp.error }

  return resp
}
