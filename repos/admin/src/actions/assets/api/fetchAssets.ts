import { assetsApi } from '@TAF/services'
import { upsertAssets } from '@TAF/actions/assets/local/upsertAssets'

export const fetchAssets = async (contextKey: string, data?: Record<string, any>) => {
  const resp = await assetsApi.list(data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertAssets(contextKey, resp.data)

  return resp
}
