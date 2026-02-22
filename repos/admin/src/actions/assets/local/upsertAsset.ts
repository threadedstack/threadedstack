import type { Asset } from '@tdsk/domain'
import { getContextAssets, setContextAssets } from '@TAF/state/accessors'

export const upsertAsset = (contextKey: string, asset: Asset) => {
  const current = getContextAssets(contextKey) || {}
  setContextAssets(contextKey, { ...current, [asset.id]: asset })
}
