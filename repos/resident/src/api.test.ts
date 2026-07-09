import type { TRecordQuery } from '@tdsk/domain'

import { describe, it, expect } from 'vitest'

import { createResidentApi } from './api'

const baseOpts = {
  backendUrl: `https://px.test`,
  token: `tdsk_x`,
  orgId: `og_1`,
  projectId: `pj_1`,
  agentId: `ag_1`,
}

const emptyQuery = {} as TRecordQuery

describe(`resident api`, () => {
  it(`returns { ok, data } on a successful POST`, async () => {
    const fetchFn = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: `r1` }] }),
    })) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn })

    const res = await api.queryRecords(`c`, emptyQuery)
    expect(res.ok).toBe(true)
    expect(res.data).toEqual([{ id: `r1` }])
  })

  it(`passes an abort signal on every request`, async () => {
    let sawSignal = false
    const fetchFn = (async (_url: string, init: any) => {
      sawSignal = init?.signal instanceof AbortSignal
      return { ok: true, status: 200, json: async () => ({ data: null }) }
    }) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn })

    await api.queryRecords(`c`, emptyQuery)
    expect(sawSignal).toBe(true)
  })

  it(`aborts and returns a timeout error when a request hangs`, async () => {
    // A fetch that never resolves on its own — only the timeout AbortController
    // can settle it (rejecting with an AbortError, as the platform fetch does).
    const fetchFn = ((_url: string, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener(`abort`, () => {
          const err = new Error(`aborted`)
          err.name = `AbortError`
          reject(err)
        })
      })) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn, requestTimeoutMs: 5 })

    const res = await api.queryRecords(`c`, emptyQuery)
    expect(res.ok).toBe(false)
    expect(res.status).toBe(0)
    expect(res.error).toMatch(/timed out/)
  })
})
