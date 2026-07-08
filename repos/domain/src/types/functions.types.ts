import type { TRecordQuery } from './collection.types'

export enum EFunLanguage {
  python = `python`,
  typescript = `typescript`,
  javascript = `javascript`,
}

export type TFunLanguage = `${EFunLanguage}`

/** HTTP request data passed to FaaS function handler */
export type TFunctionRequest = {
  path?: string
  body?: unknown
  method?: string
  query?: Record<string, string>
  headers?: Record<string, string>
}

/** A record document surfaced to a Function — the record id plus its JSON `data`. */
export type TRecordDocument = {
  id: string
  data: Record<string, unknown>
}

/**
 * Project-scoped records capability injected into a Function's execution context.
 *
 * A platform-mediated bridge: every method executes host-side against the
 * collection/record service scoped to the Function's project (the project is
 * implicit — bound at injection time). The isolated V8 sandbox holds only these
 * bound async methods; it never receives a raw db handle, connection string, or
 * network access. This is what lets a Function persist/read collection records.
 */
export interface IRecordsCapability {
  query(collection: string, query?: TRecordQuery): Promise<TRecordDocument[]>
  get(collection: string, id: string): Promise<TRecordDocument | null>
  upsert(
    collection: string,
    record: { id?: string; data: Record<string, unknown> }
  ): Promise<{ id: string }>
  delete(collection: string, id: string): Promise<{ deleted: boolean }>
  count(collection: string, query?: TRecordQuery): Promise<number>
}

/** Platform-injected context available to function handler */
export type TFunctionContext = {
  args?: Record<string, any>
  envVars?: Record<string, string>
  secrets?: Record<string, string>
  /**
   * Project-scoped records capability. Present when the executor is given a host
   * db handle; the isolate reaches it through a platform-mediated bridge, never a
   * direct db connection.
   */
  records?: IRecordsCapability
  /**
   * Platform-injected, trusted identity of the invoker (never from model output).
   * Effect Functions authorize by this (e.g. board role gates).
   */
  caller?: { agentId?: string; scheduleId?: string }
}

/** Return value from a FaaS function handler (maps to HTTP response) */
export type TFunctionResponse = {
  body?: unknown
  statusCode?: number
  headers?: Record<string, string>
}

/** Internal execution result from FunctionExecutor */
export type TFunctionExecResult = {
  error?: string
  output: unknown
  duration: number
  success: boolean
}

export enum EFunParamType {
  array = `array`,
  string = `string`,
  object = `object`,
  number = `number`,
  boolean = `boolean`,
}

export type TFunParamType = `${EFunParamType}`

export type TFunctionParam = {
  name: string
  default?: unknown
  required?: boolean
  type: TFunParamType
  description?: string
}
