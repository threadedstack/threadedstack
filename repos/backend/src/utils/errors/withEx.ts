import type { TErrorArgs, TErrorItems, TThrowExceptions } from '@TBE/types'

import { isArr } from '@keg-hub/jsutils'
import { Exception } from '@tdsk/domain'

const throwEx = (idx: number, codeKey?: string, ...args: TErrorArgs) => {
  const [status, message, code = codeKey] = args

  throw new Exception(status, message, `${code}-${idx}`)
}

export const withEx = (items: TErrorItems, codeKey: string = `err`) => {
  return Object.entries(items).reduce((acc, [name, args], idx) => {
    acc[name] = isArr(args)
      ? () => throwEx(idx, codeKey, ...(args as TErrorArgs))
      : (...props: any[]) => throwEx(idx, codeKey, ...args(...props))

    return acc
  }, {} as TThrowExceptions)
}
