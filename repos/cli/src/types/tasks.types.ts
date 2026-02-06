import type { TValueOf } from '@TSCL/types/helpers.types'
import type { TCliCfg, TCtxCfg } from '@TSCL/types/config.types'

export type TTaskOptionTypeMap = {
  arr: any[]
  str: string
  array: any[]
  num: number
  bool: boolean
  string: string
  number: number
  boolean: boolean
  obj: Record<string, any>
  object: Record<string, any>
}

export type TTaskOptionType = keyof TTaskOptionTypeMap
export type TParamValue = TValueOf<TTaskOptionTypeMap>

export type TTaskPMap = {
  //[K: string]: TParamValue
  [K: string]: any
}

export type TTaskOption<T extends TTaskPMap = TTaskPMap> = {
  env?: string
  alias?: string[]
  allowed?: string[]
  example?: string
  required?: boolean
  description?: string
  default?: TValueOf<T>
  type?: TTaskOptionType
}

export type TTaskOptions<T extends TTaskPMap = TTaskPMap> = Record<string, TTaskOption<T>>

export type TTParams = {
  [K in keyof TTaskOptions]: any
}

export type TTaskParams = TTParams & {
  env?: string
}

export type TTaskActionArgs<P extends TTaskPMap = TTaskPMap> = {
  params: P
  task: TTask
  tasks: TTasks
  config: TCliCfg
  options?: string[]
}

export type TTaskAction<T extends TTaskPMap = TTaskPMap> = <P extends TTaskPMap = T>(
  args: TTaskActionArgs<P>
) => any

export type TTask<P extends TTaskParams = TTaskParams> = {
  name: string
  tasks?: TTasks
  alias?: string[]
  action?: TTaskAction<P>
  options?: TTaskOptions<P>
  [key: string]: any
}

export type TTasks = Record<string, TTask>

export type TUtilArgs<T extends TTaskPMap = TTaskPMap> = TTaskActionArgs<T> & {
  ctx: TCtxCfg
}
