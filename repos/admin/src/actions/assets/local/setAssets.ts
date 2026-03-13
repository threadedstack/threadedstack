import type { Asset } from '@tdsk/domain'
import { setContextAssets } from '@TAF/state/accessors'

export const setAssets = (contextKey: string, assets: Asset[]) => {
  const map = Object.fromEntries(assets.map((asset) => [asset.id, asset])) as Record<
    string,
    Asset
  >
  setContextAssets(contextKey, map)
}
