import type { TAgentAction, TRecordQuery } from '@tdsk/domain'
import type {
  TApiResult,
  TResidentApi,
  TDispatchResult,
  TResidentRecord,
  TAuthoredSecret,
  TAuthoredEndpoint,
  TAuthoredFunction,
  TAuthorSecretRequest,
  TAuthorEndpointRequest,
  TAuthorFunctionRequest,
} from './types/resident.types'

import { log } from './log'
import {
  ApiRequestTimeoutMs,
  ApiNetworkRetryMax,
  ApiNetworkRetryDelaysMs,
} from './constants'

export type TResidentApiOpts = {
  backendUrl: string
  token: string
  orgId: string
  projectId: string
  agentId: string
  /** Backend admin path segment (default `_`). */
  adminPath?: string
  /** Per-request wall-clock timeout (default ApiRequestTimeoutMs). */
  requestTimeoutMs?: number
  /** Injectable for tests — the runtime's ONLY HTTP boundary. */
  fetchFn?: typeof fetch
}

/**
 * The resident's backend client: records reads (config/watches/inbox/context),
 * the read-receipt upsert, and the R1 dispatch endpoint. Talks straight to the
 * in-cluster backend with the pod-scoped resident token; never throws — every
 * call resolves `{ ok, status, data?, error? }` (the shared ApiService style).
 */
export const createResidentApi = (opts: TResidentApiOpts): TResidentApi => {
  const { backendUrl, token, orgId, projectId, agentId, fetchFn } = opts
  const doFetch = fetchFn ?? fetch
  const admin = opts.adminPath ?? `_`
  const requestTimeoutMs = opts.requestTimeoutMs ?? ApiRequestTimeoutMs
  const base = `${backendUrl.replace(/\/+$/, ``)}/${admin}/orgs/${orgId}/projects/${projectId}`

  const post = async <T>(url: string, body: unknown): Promise<TApiResult<T>> => {
    // Retry ONLY a transport throw (a dead keep-alive socket through the egress
    // hairpin throws ECONNRESET/"fetch failed") — a fresh attempt opens a new
    // connection. An HTTP error RESPONSE (4xx/5xx) is returned, never retried
    // here. Each attempt is independently timeout-bounded so a hung backend
    // never stalls a heartbeat/poll (the loop + heartbeat are serialized).
    for (let attempt = 0; ; attempt++) {
      // Bound this attempt.
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs)
      let result: TApiResult<T> | undefined
      let retry = false
      try {
        const res = await doFetch(url, {
          method: `POST`,
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': `application/json`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        let payload: any
        try {
          payload = await res.json()
        } catch {
          payload = undefined
        }

        result = res.ok
          ? { ok: true, status: res.status, data: payload?.data as T }
          : {
              ok: false,
              status: res.status,
              error:
                payload?.error?.message ??
                payload?.message ??
                `Request failed with status ${res.status}`,
            }
      } catch (err) {
        const aborted = err instanceof Error && err.name === `AbortError`
        const message = aborted
          ? `Request timed out after ${requestTimeoutMs}ms`
          : err instanceof Error
            ? err.message
            : String(err)
        // A TIMEOUT is not retried (that could block a heartbeat for N×timeout);
        // the caller retries on its next cycle. Only a connection-level throw
        // (dead keep-alive socket) is retried with a fresh connection.
        if (!aborted && attempt < ApiNetworkRetryMax) {
          retry = true
          log.debug(
            `API request failed (attempt ${attempt + 1}/${
              ApiNetworkRetryMax + 1
            }), retrying: POST ${url}: ${message}`
          )
        } else {
          log.debug(`API request failed: POST ${url}: ${message}`)
          result = { ok: false, status: 0, error: message }
        }
      } finally {
        clearTimeout(timer)
      }

      if (result) return result
      if (retry)
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            ApiNetworkRetryDelaysMs[attempt] ??
              ApiNetworkRetryDelaysMs[ApiNetworkRetryDelaysMs.length - 1]
          )
        )
    }
  }

  return {
    // Reads go through the resident READ surface (residentAuth) — the
    // collections API sits behind the accounts-level user authentication and
    // 401s the resident token (proven live 2026-07-08).
    queryRecords: (collection: string, query: TRecordQuery) =>
      post<TResidentRecord[]>(`${base}/agents/${agentId}/records/query`, {
        collection,
        query,
      }),

    // Raw record WRITES have no resident surface by design (writes flow
    // through dispatch Functions). This remains only as the inbox
    // read-receipt fallback for configs without a markMessageRead Function;
    // it fails closed (401) and callers already tolerate that (in-memory
    // seen-set protects against refires).
    upsertRecord: (collection: string, record) =>
      post<TResidentRecord>(`${base}/collections/${collection}/records`, record),

    dispatch: (actions: TAgentAction[]) =>
      post<TDispatchResult[]>(`${base}/agents/${agentId}/dispatch`, { actions }),

    authorFunction: (request: TAuthorFunctionRequest) =>
      post<TAuthoredFunction>(`${base}/agents/${agentId}/author-function`, request),

    authorEndpoint: (request: TAuthorEndpointRequest) =>
      post<TAuthoredEndpoint>(`${base}/agents/${agentId}/author-endpoint`, request),

    authorSecret: (request: TAuthorSecretRequest) =>
      post<TAuthoredSecret>(`${base}/agents/${agentId}/author-secret`, request),
  }
}
