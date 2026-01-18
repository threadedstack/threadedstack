import type { TPayPlanRaw, TPayPlanMeta } from '@TDM/types'

import { toNum } from '@keg-hub/jsutils/toNum'
import { camelCase } from '@keg-hub/jsutils/camelCase'

/**
 * Converts a the raw metadata values into a valid plan metadata object
 */
export const rawPlanToMeta = (raw: TPayPlanRaw | TPayPlanMeta) => {
  return Object.entries(raw).reduce((acc, [key, value]) => {
    acc[camelCase(key)] = toNum(value)
    return acc
  }, {} as TPayPlanMeta)
}
