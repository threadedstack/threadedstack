import { isStr } from '@keg-hub/jsutils/isStr'
import { isNum } from '@keg-hub/jsutils/isNum'
import { isArr } from '@keg-hub/jsutils/isArr'
import { isBool } from '@keg-hub/jsutils/isBool'
import { isColl } from '@keg-hub/jsutils/isColl'
import { exists } from '@keg-hub/jsutils/exists'
import { reduceObj } from '@keg-hub/jsutils/reduceObj'

export type TObjToQueryOpts = {
  array?: `string` | `repeated`
}

const valueToStr = (encodedKey: string, value: any) => {
  const stringVal =
    isStr(value) || isNum(value) || isBool(value)
      ? value
      : isColl(value)
        ? isArr(value)
          ? value.join(',')
          : JSON.stringify(value)
        : null

  return exists(stringVal) ? `${encodedKey}=${encodeURIComponent(stringVal)}` : null
}

const arrToStr = (encodedKey: string, value: Array<string | number | boolean>) => {
  return (
    value.reduce((acc: string, val) => {
      if (!exists(val)) return acc

      return acc
        ? `${acc}&${encodedKey}=${encodeURIComponent(val)}`
        : `${encodedKey}=${encodeURIComponent(val)}`
    }, ``) || null
  )
}

/**
 * Converts the input object to url querystring
 * @param {Object} obj - object with kvp to convert into a querystring
 * @function
 * @returns {String} querystring
 */
export const objToQuery = <T extends string>(
  obj: Record<string, any>,
  opts: TObjToQueryOpts = {}
): T => {
  const repeated = (opts?.array || `repeated`) == `repeated`
  return reduceObj<T>(
    obj,
    (key, value, urlStr) => {
      if (!exists(value)) return urlStr

      const encodedKey = encodeURIComponent(key)

      const converted =
        isArr(value) && repeated
          ? arrToStr(encodedKey, value)
          : valueToStr(encodedKey, value)

      if (!exists(converted)) return urlStr

      return (urlStr ? `${urlStr}&${converted}` : `?${converted}`) as T
    },
    '' as T
  )
}
