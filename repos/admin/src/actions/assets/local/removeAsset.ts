import { getContextAssets, setContextAssets } from '@TAF/state/accessors'

export const removeAsset = (contextKey: string, id: string) => {
  const current = getContextAssets(contextKey) || {}
  const { [id]: _, ...rest } = current
  setContextAssets(contextKey, rest)
}
