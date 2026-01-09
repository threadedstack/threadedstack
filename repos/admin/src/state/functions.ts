import type { Function as TDFunction } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const functionsState = atomWithReset<Record<string, TDFunction>>(undefined)
export const activeFunctionIdState = atomWithReset<string>(undefined)
