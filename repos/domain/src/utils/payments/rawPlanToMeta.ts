import type { TPayPlanRaw, TPayPlanMeta } from '@TDM/types'

import { toNum } from '@keg-hub/jsutils/toNum'
import { camelCase } from '@keg-hub/jsutils/camelCase'

const isCamelCase = (str: string): boolean => {
  const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/
  return camelCaseRegex.test(str)
}

/**
 * Converts a the raw metadata values into a valid plan metadata object
 * NOTE: All TPayPlanMeta fields are numeric, so toNum() conversion is correct for all fields.
 */
export const rawPlanToMeta = (raw: TPayPlanRaw | TPayPlanMeta) => {
  return Object.entries(raw).reduce((acc, [key, value]) => {
    const prop = isCamelCase(key) ? key : camelCase(key)
    acc[prop] = toNum(value)
    return acc
  }, {} as TPayPlanMeta)
}
