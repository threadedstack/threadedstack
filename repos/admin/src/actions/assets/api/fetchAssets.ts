import { assetsApi } from '@TAF/services'
import { setAssets } from '@TAF/actions/assets/local/setAssets'

export const fetchAssets = async (contextKey: string, data?: Record<string, any>) => {
  const resp = await assetsApi.list(data)
  if (resp.error) return { error: resp.error }

  resp.data && setAssets(contextKey, resp.data)

  return resp
}
