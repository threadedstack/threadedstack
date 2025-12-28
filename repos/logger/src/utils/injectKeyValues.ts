import { injectUnsafe } from './safeReplacer'
import { isObj } from '@keg-hub/jsutils/isObj'

/**
 * @description - Injects the secret keys and values into the logger
 * Ensures they are not logged to the console
 */
export const injectKeyValues = (resp:Record<string, any>) => {
  if(!resp || !isObj(resp)) return resp

  const keys = Object.keys(resp).filter(Boolean)
  if(!keys?.length) return resp

  injectUnsafe(keys)

  const values = Object.values(resp).filter(Boolean)
  values.length && injectUnsafe(values)

  return resp
}
