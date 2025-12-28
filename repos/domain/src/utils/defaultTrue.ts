import { isStr } from '@keg-hub/jsutils/isStr'
import { exists } from '@keg-hub/jsutils/exists'
import { toBool } from '@keg-hub/jsutils/toBool'

export const defaultTrue = (val: any) => {
  if (!exists(val)) return true
  if (isStr(val) && val.trim() === ``) return true

  return toBool(val)
}
