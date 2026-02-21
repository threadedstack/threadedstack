import type { AuthManager } from '@TRL/services/auth'
import type { TReplConfig } from '@TRL/types/config.types'

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

export type TTaskPMap = {
  [K: string]: any
}

export type TTaskOption<T extends TTaskPMap = TTaskPMap> = {
  alias?: string[]
  allowed?: string[]
  example?: string
  required?: boolean
  description?: string
  default?: any
  type?: TTaskOptionType
}

export type TTaskOptions<T extends TTaskPMap = TTaskPMap> = Record<string, TTaskOption<T>>

export type TTaskActionArgs<P extends TTaskPMap = TTaskPMap> = {
  params: P
  task: TTask
  tasks: TTasks
  auth: AuthManager
  config?: TReplConfig
  options?: string[]
}

export type TTaskAction<T extends TTaskPMap = TTaskPMap> = <P extends TTaskPMap = T>(
  args: TTaskActionArgs<P>
) => any

export type TTask<P extends TTaskPMap = TTaskPMap> = {
  name: string
  tasks?: TTasks
  alias?: string[]
  action?: TTaskAction<P>
  options?: TTaskOptions<P>
  description?: string
  example?: string
  [key: string]: any
}

export type TTasks = Record<string, TTask>

// Re-export TReplConfig from config.types for backward compatibility
export type { TReplConfig } from './config.types'
