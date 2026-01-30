import { assetsApi } from '@TAF/services'
import { removeAsset } from '@TAF/actions/assets/local/removeAsset'

export const deleteAsset = async (id: string) => {
  const resp = await assetsApi.delete(id)
  if (resp.error) return { error: resp.error }
  resp.data?.success && removeAsset(id)

  return resp
}
