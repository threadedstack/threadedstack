import type { Asset } from '@tdsk/domain'
import { getContextAssets, setContextAssets } from '@TAF/state/accessors'

export const upsertAssets = (contextKey: string, assets: Asset[]) => {
  const current = getContextAssets(contextKey) || {}
  const assetsMap = Object.fromEntries(
    assets.map((asset) => [asset.id, asset])
  ) as Record<string, Asset>
  setContextAssets(contextKey, { ...current, ...assetsMap })
}
