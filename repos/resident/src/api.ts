import type { TAgentAction, TRecordQuery } from '@tdsk/domain'
import type {
  TApiResult,
  TResidentApi,
  TDispatchResult,
  TResidentRecord,
  TAuthoredFunction,
  TAuthorFunctionRequest,
} from './types/resident.types'

import { log } from './log'

export type TResidentApiOpts = {
  backendUrl: string
  token: string
  orgId: string
  projectId: string
  agentId: string
  /** Backend admin path segment (default `_`). */
  adminPath?: string
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
  const base = `${backendUrl.replace(/\/+$/, ``)}/${admin}/orgs/${orgId}/projects/${projectId}`

  const post = async <T>(url: string, body: unknown): Promise<TApiResult<T>> => {
    try {
      const res = await doFetch(url, {
        method: `POST`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `application/json`,
        },
        body: JSON.stringify(body),
      })

      let payload: any
      try {
        payload = await res.json()
      } catch {
        payload = undefined
      }

      if (!res.ok)
        return {
          ok: false,
          status: res.status,
          error:
            payload?.error?.message ??
            payload?.message ??
            `Request failed with status ${res.status}`,
        }

      return { ok: true, status: res.status, data: payload?.data as T }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log.debug(`API request failed: POST ${url}: ${message}`)
      return { ok: false, status: 0, error: message }
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
  }
}
