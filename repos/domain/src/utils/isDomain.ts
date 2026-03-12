import { isStr } from '@keg-hub/jsutils/isStr'
import { DomainRegex } from '@TDM/constants/values'

export const isDomain = (val: string) => {
  if (!isStr(val)) return false
  const trimmed = val.trim()
  return trimmed !== `` && DomainRegex.test(trimmed.toLowerCase())
}
