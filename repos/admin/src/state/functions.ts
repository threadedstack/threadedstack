import type { Function as TDFunction } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export const functionsState = atomWithReset<Record<string, TDFunction>>(undefined)
export const activeFunctionIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `functions` && part))
)
