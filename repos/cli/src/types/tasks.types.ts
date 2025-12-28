import type { TCliCfg } from '@TSCL/types/config.types'
import type { TValueOf } from '@TSCL/types/helpers.types'


export type TTaskOptionTypeMap = {
  str: string
  string: string
  num: number
  number: number
  bool: boolean
  boolean: boolean
  array: any[]
  arr: any[]
  obj: Record<string, any>
  object: Record<string, any>
}

export type TTaskOptionType = keyof TTaskOptionTypeMap
export type TParamValue = TValueOf<TTaskOptionTypeMap>

export type TTaskPMap = {
  [K:string]:TParamValue
}


export type TTaskOption<T extends TTaskPMap=TTaskPMap> = {
  env?: string
  alias?: string[]
  allowed?:string[]
  example?: string
  required?:boolean
  description?: string
  default?: TValueOf<T>
  type?: TTaskOptionType
}

export type TTaskOptions<T extends TTaskPMap=TTaskPMap> = Record<string, TTaskOption<T>>

export type TTParams = {
  [K in keyof TTaskOptions]: any
}

export type TTaskParams = TTParams & {
  env?:string
}


export type TTaskActionArgs<P extends TTaskParams=TTaskParams> = {
  params: P
  task: TTask
  tasks: TTasks
  options?: string[]
  config?: TCliCfg
}

export type TTaskAction<T extends TTaskParams=TTaskParams> = <P extends TTaskParams=T>(args:TTaskActionArgs<P>) => any



export type TTask<P extends TTaskParams=TTaskParams> = {
  name: string,
  tasks?: TTasks
  alias?: string[]
  action?: TTaskAction<P>
  options?: TTaskOptions<P>
  [key: string]: any
}

export type TTasks = Record<string, TTask>
