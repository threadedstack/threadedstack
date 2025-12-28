import { isArr } from '@keg-hub/jsutils/isArr'

export const deepCopy = <T=Record<any, any>>(obj:Record<any, any>) => {
  if (obj === null || typeof obj !== `object`) return obj

  const copy = isArr(obj) ? [] : {}

  for (const key in obj)
    Object.prototype.hasOwnProperty.call(obj, key)
      && (copy[key] = deepCopy(obj[key]))

  return copy as T
}
