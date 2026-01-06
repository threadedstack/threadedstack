import { exists } from '@keg-hub/jsutils/exists'
import { isBool } from '@keg-hub/jsutils/isBool'

const falsy = [`f`, `false`, 0]

export const asBool = (item: any, fallback: any = false) => {
  return isBool(item)
    ? item
    : !exists(item) || item === ``
      ? fallback
      : falsy.includes(`${item}`.toLowerCase())
        ? false
        : true
}
