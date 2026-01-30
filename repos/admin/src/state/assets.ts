import type { Asset } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const assetsState = atomWithReset<Record<string, Asset>>(undefined)
export const activeAssetIdState = atomWithReset<string>(undefined)
