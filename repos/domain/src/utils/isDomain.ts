import { isStr } from '@keg-hub/jsutils/isStr'

export const isDomain = (val: string) => {
  if (!isStr(val) || !val.trim()) return false

  const regex =
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/
  return regex.test(val.trim().toLowerCase())
}
