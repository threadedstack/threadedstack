import type { Config } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const configsState = atomWithReset<Record<string, Config>>(undefined)
export const activeConfigIdState = atomWithReset<string>(undefined)
