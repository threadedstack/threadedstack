import { setAssets, getAssets } from '@TAF/state/accessors'

export const removeAsset = (id: string) => {
  const current = getAssets() || {}
  const { [id]: _, ...rest } = current
  setAssets(rest)
}
