import type { Asset } from '@tdsk/domain'
import { getContextAssets, setContextAssets } from '@TAF/state/accessors'

export const upsertAssets = (contextKey: string, assets: Asset[]) => {
  const current = getContextAssets(contextKey) || {}
  const assetsMap = assets.reduce(
    (acc, asset) => {
      acc[asset.id] = asset
      return acc
    },
    {} as Record<string, Asset>
  )

  setContextAssets(contextKey, { ...current, ...assetsMap })
}
