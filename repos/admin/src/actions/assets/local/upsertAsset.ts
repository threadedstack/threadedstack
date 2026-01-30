import type { Asset } from '@tdsk/domain'

import { setAssets, getAssets } from '@TAF/state/accessors'

export const upsertAsset = (asset: Asset) => {
  setAssets({ ...getAssets(), [asset.id]: asset })
}
