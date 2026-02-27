import { providersApi } from '@TAF/services/providersApi'

export type TFetchProviderModelsOpts = {
  brand: string
  baseUrl?: string
  providerKey?: string
}

export const fetchProviderModels = async (opts: TFetchProviderModelsOpts) => {
  const { brand, ...rest } = opts
  return providersApi.fetchModels(brand, rest)
}
