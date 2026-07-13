import type { TRecordQuery } from './collection.types'
import type { TScanResult } from './skillProposal.types'

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
  /**
   * Atomic compare-and-set: merge `patch` into the record's data ONLY when
   * every `match` field currently equals its expected value (`null` matches
   * absent). Exactly one concurrent caller can win a given transition — the
   * loser (or a missing id) gets `{ conflict: true }`. The claim/lease
   * primitive for concurrent multi-agent coordination.
   */
  cas(
    collection: string,
    id: string,
    match: Record<string, string | number | boolean | null>,
    patch: Record<string, unknown>
  ): Promise<TRecordDocument | { conflict: true }>
}

/**
 * Untrusted text fields submitted to the content-scan capability. Mirrors the
 * field surface of the platform's deterministic task-proposal scanner: every
 * provided field is scanned as free text; omitted fields scan as empty.
 * `sourceSignal` is plain text here (not the proposal enum) — the scanner
 * treats it purely as content to scan, never as a discriminator.
 */
export type TScanContentInput = {
  title?: string
  description?: string
  evidence?: string
  sourceSignal?: string
}

/**
 * Deterministic, fail-closed content-scan capability injected into a Function's
 * execution context.
 *
 * A platform-mediated bridge over the host's deterministic text scanner (the
 * same fail-closed engine gating task proposals): the isolate sends the
 * untrusted fields as JSON and receives the verdict as JSON — the scanner
 * itself (rules, regexes, normalizer) never crosses into the sandbox. The scan
 * is pure and dependency-free: same input always yields the same verdict.
 * `passed: false` means at least one finding — callers MUST treat that as a
 * hard reject before persisting or re-injecting the content.
 */
export interface IScanCapability {
  content(input: TScanContentInput): Promise<TScanResult>
}

/**
 * Request a Function passes to an external connection (a proxy Endpoint).
 *
 * NOTE (security): there is deliberately NO caller-supplied `path`. Concatenating
 * agent-authored path onto the endpoint's base URL is the classic SSRF/traversal
 * trigger, so the target host is fixed by the endpoint config and bounded by the
 * platform egress guard — a Function can only vary the query, headers, and body.
 */
export type TConnectorRequest = {
  /** Query params merged onto the outbound request (cannot change the host). */
  query?: Record<string, string>
  /** Headers merged onto the outbound request (endpoint-injected secrets win). */
  headers?: Record<string, string>
  /** JSON body sent upstream (for POST/PUT/PATCH). */
  body?: unknown
  /** Override the endpoint's HTTP method for this call. */
  method?: string
}

/** Result of an external connection call surfaced back to the Function. */
export type TConnectorResult = {
  ok: boolean
  status?: number
  body?: unknown
  error?: string
}

/**
 * Project-scoped external-connection capability injected into a Function's
 * execution context.
 *
 * A platform-mediated bridge over the Proxy Engine: the isolate names a project
 * `proxy` Endpoint (by id or name) and the host resolves it, injects its
 * server-side secrets/auth (OAuth, bearer, basic, api-key), enforces its domain
 * whitelist, executes the outbound HTTPS call, and returns the response as JSON.
 * The secrets NEVER cross into the isolate — the Function only ever sees the
 * response body. This is what lets an agent-authored Function actually reach the
 * outside world (send an email, post to a channel, call a third-party API)
 * instead of dead-ending in a records Collection.
 *
 * Only `proxy`-type Endpoints are reachable — `agent`/`faas` Endpoints are
 * refused so a Function cannot invoke agents or other Functions through it.
 */
export interface IConnectorCapability {
  invoke(ref: string, request?: TConnectorRequest): Promise<TConnectorResult>
}

/** Outcome of a task-proposal promotion attempt via `context.taskProposals.promote`. */
export type TTaskProposalPromoteResult = {
  /** True only when the authoritative table row transitioned to `promoted` on this call. */
  promoted: boolean
}

/**
 * Task-proposal promotion capability injected into a Function's execution context.
 *
 * `task_proposals` is the platform's authoritative SQL table (not a project
 * Collection), so a Function has no way to reach it through `context.records`,
 * whose scope is deliberately the tenant's own Collections. This bridge is the
 * ONE sanctioned path to promote a proposal: the isolate names the proposal id
 * (and an optional note) and the host runs the SAME idempotent promotion
 * pipeline the work-cycle pickup uses — an already-terminal (promoted/rejected)
 * proposal is a no-op, never an error. The db handle never crosses into the
 * isolate; only the id/note and the boolean outcome do.
 */
export interface ITaskProposalsCapability {
  promote(id: string, note?: string): Promise<TTaskProposalPromoteResult>
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
   * Deterministic fail-closed content scanner. Present whenever the executor
   * builds its host-bridge surface; reached through a platform-mediated bridge —
   * the scanner never crosses into the isolate.
   */
  scan?: IScanCapability
  /**
   * Project-scoped external-connection capability over the Proxy Engine. Present
   * when the executor builds its host-bridge surface with endpoint access.
   * Reached through a platform-mediated bridge — endpoint secrets are injected
   * host-side and never cross into the isolate.
   */
  connect?: IConnectorCapability
  /**
   * Task-proposal promotion capability over the authoritative `task_proposals`
   * table. Present whenever the executor builds its host-bridge surface —
   * reached through a platform-mediated bridge, never a direct db connection.
   */
  taskProposals?: ITaskProposalsCapability
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
