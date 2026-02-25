import type { Asset } from '@tdsk/domain'
import { setContextAssets } from '@TAF/state/accessors'

export const setAssets = (contextKey: string, assets: Asset[]) => {
  const map = assets.reduce(
    (acc, asset) => {
      acc[asset.id] = asset
      return acc
    },
    {} as Record<string, Asset>
  )

  setContextAssets(contextKey, map)
}
