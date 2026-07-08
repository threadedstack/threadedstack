import type { ChildProcess } from 'node:child_process'
import type { TSpawnFn } from './session'
import type {
  TApiResult,
  TResidentApi,
  TDispatchResult,
  TResidentConfig,
  TResidentRecord,
  TAuthoredFunction,
  TAuthorFunctionRequest,
} from './types/resident.types'

import { EventEmitter } from 'node:events'
import { normalizeResidentConfig } from './config'

/**
 * Shared test doubles for the child-process + HTTP boundaries. NOT exported
 * from the package entry — imported directly by the co-located test files.
 */

export type TFakeChild = ChildProcess & {
  stdout: EventEmitter
  stderr: EventEmitter
  killed: string[]
  emitClose: (code: number | null) => void
  emitStdout: (text: string) => void
}

/** Build a fake ChildProcess the session/sub-agent modules can drive. */
export const makeFakeChild = (): TFakeChild => {
  const child = new EventEmitter() as unknown as TFakeChild
  const stdout = new EventEmitter()
  const stderr = new EventEmitter()
  const killed: string[] = []

  Object.assign(child, {
    stdout,
    stderr,
    killed,
    kill: (signal?: string) => {
      killed.push(signal ?? `SIGTERM`)
      // A killed real child always closes; mirror that so timeout paths settle
      setImmediate(() => child.emitClose(null))
      return true
    },
    emitStdout: (text: string) => stdout.emit(`data`, Buffer.from(text)),
    emitClose: (code: number | null) =>
      (child as unknown as EventEmitter).emit(`close`, code),
  })
  return child
}

export type TSpawnCall = {
  bin: string
  args: string[]
  options: Record<string, any>
  child: TFakeChild
}

/**
 * A spawnFn double that records every call and hands back scripted children.
 * `script` runs on the next tick so callers can await the returned promise.
 */
export const makeSpawnFn = (
  script?: (call: TSpawnCall, index: number) => void
): { spawnFn: TSpawnFn; calls: TSpawnCall[] } => {
  const calls: TSpawnCall[] = []
  const spawnFn = ((bin: string, args: string[], options: Record<string, any>) => {
    const child = makeFakeChild()
    const call: TSpawnCall = { bin, args, options, child }
    calls.push(call)
    if (script) setImmediate(() => script(call, calls.length - 1))
    return child as unknown as ChildProcess
  }) as unknown as TSpawnFn
  return { spawnFn, calls }
}

/** The claude CLI JSON envelope for a scripted turn. */
export const claudeJson = (result: string, sessionId = `sess-1`): string =>
  JSON.stringify({ type: `result`, result, session_id: sessionId, is_error: false })

export const okResult = <T>(data: T): TApiResult<T> => ({ ok: true, status: 200, data })

export type TFakeApi = TResidentApi & {
  dispatched: Array<Array<{ function: string; args: Record<string, unknown> }>>
  upserts: Array<{
    collection: string
    record: { id?: string; data: Record<string, unknown> }
  }>
  queries: Array<{ collection: string; query: unknown }>
  authored: TAuthorFunctionRequest[]
  /** Override per-collection query responses. */
  onQuery: (
    fn: (collection: string, query: unknown) => TApiResult<TResidentRecord[]> | undefined
  ) => void
  /** Override dispatch behavior (default: every action ok). */
  onDispatch: (
    fn: (
      actions: Array<{ function: string; args: Record<string, unknown> }>
    ) => TApiResult<TDispatchResult[]>
  ) => void
  /** Override authorFunction behavior (default: accepted). */
  onAuthor: (
    fn: (request: TAuthorFunctionRequest) => TApiResult<TAuthoredFunction>
  ) => void
}

/** In-memory TResidentApi double recording all traffic. */
export const makeFakeApi = (): TFakeApi => {
  let queryHandler:
    | ((collection: string, query: unknown) => TApiResult<TResidentRecord[]> | undefined)
    | undefined
  let dispatchHandler:
    | ((
        actions: Array<{ function: string; args: Record<string, unknown> }>
      ) => TApiResult<TDispatchResult[]>)
    | undefined
  let authorHandler:
    | ((request: TAuthorFunctionRequest) => TApiResult<TAuthoredFunction>)
    | undefined

  const api: TFakeApi = {
    dispatched: [],
    upserts: [],
    queries: [],
    authored: [],
    onQuery: (fn) => {
      queryHandler = fn
    },
    onDispatch: (fn) => {
      dispatchHandler = fn
    },
    onAuthor: (fn) => {
      authorHandler = fn
    },
    queryRecords: async (collection, query) => {
      api.queries.push({ collection, query })
      return queryHandler?.(collection, query) ?? okResult<TResidentRecord[]>([])
    },
    upsertRecord: async (collection, record) => {
      api.upserts.push({ collection, record })
      return okResult({ id: record.id ?? `rec-1`, data: record.data })
    },
    dispatch: async (actions) => {
      api.dispatched.push(actions)
      return (
        dispatchHandler?.(actions) ??
        okResult<TDispatchResult[]>(actions.map(() => ({ ok: true })))
      )
    },
    authorFunction: async (request) => {
      api.authored.push(request)
      return (
        authorHandler?.(request) ??
        okResult<TAuthoredFunction>({ id: `fn_test001`, name: request.name })
      )
    },
  }
  return api
}

/** A fully-defaulted config with overrides. */
export const makeConfig = (
  overrides: Partial<TResidentConfig> = {},
  agentId = `ag_test`
): TResidentConfig => ({
  ...normalizeResidentConfig({}, agentId),
  ...overrides,
  agentId,
})
