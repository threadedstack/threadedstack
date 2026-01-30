import type { Asset } from '@tdsk/domain'

import { setAssets, getAssets } from '@TAF/state/accessors'

export const upsertAssets = (assets: Asset[]) => {
  const current = getAssets() || {}
  const assetsMap = assets.reduce(
    (acc, asset) => {
      acc[asset.id] = asset
      return acc
    },
    {} as Record<string, Asset>
  )

  setAssets({ ...current, ...assetsMap })
}
