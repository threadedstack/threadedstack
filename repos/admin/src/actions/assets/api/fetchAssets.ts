import type { Asset } from '@tdsk/domain'

import { assetsApi } from '@TAF/services'
import { upsertAssets } from '@TAF/actions/assets/local/upsertAssets'

// TODO: set a proper type for data
export const fetchAssets = async (data?: Record<string, any>) => {
  const resp = await assetsApi.list(data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertAssets(resp.data)

  return resp
}
