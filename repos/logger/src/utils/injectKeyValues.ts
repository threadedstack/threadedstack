import { injectUnsafe } from './safeReplacer'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isStr } from '@keg-hub/jsutils/isStr'

/**
 * @description - Injects the secret keys and values into the logger
 * Ensures they are not logged to the console
 */
export const injectKeyValues = (resp: Record<string, any>) => {
  if (!resp || !isObj(resp)) return resp

  const keys = Object.keys(resp).filter(Boolean)
  if (!keys.length) return resp

  injectUnsafe(keys)

  // injectUnsafe registers substrings for later string matching, so it can
  // only accept strings -- non-string values (numbers, booleans, nested
  // objects/arrays) reach escapeStrForRegEx's String.prototype.replace call
  // and throw
  const values = Object.values(resp).filter((value) => isStr(value) && value)
  values.length && injectUnsafe(values)

  return resp
}
