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

  it(`retries a transport failure (dead keep-alive socket) and succeeds on a fresh connection`, async () => {
    let calls = 0
    const fetchFn = (async () => {
      calls += 1
      if (calls === 1) {
        // The reused-but-dead socket through the hairpin throws (not an HTTP response).
        const err = new Error(`fetch failed`)
        ;(err as any).cause = { code: `ECONNRESET` }
        throw err
      }
      return { ok: true, status: 200, json: async () => ({ data: { beat: true } }) }
    }) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn })

    const res = await api.queryRecords(`c`, emptyQuery)
    expect(calls).toBe(2) // first threw, retried on a fresh connection
    expect(res.ok).toBe(true)
    expect(res.data).toEqual({ beat: true })
  })

  it(`gives up after the retry budget when the transport keeps failing`, async () => {
    let calls = 0
    const fetchFn = (async () => {
      calls += 1
      throw new Error(`fetch failed`)
    }) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn })

    const res = await api.queryRecords(`c`, emptyQuery)
    // 1 initial + ApiNetworkRetryMax(2) retries = 3 attempts.
    expect(calls).toBe(3)
    expect(res).toMatchObject({ ok: false, status: 0 })
    expect(res.error).toMatch(/fetch failed/)
  })

  it(`does NOT retry a timeout (returns after one attempt so a heartbeat is never blocked N×)`, async () => {
    let calls = 0
    const fetchFn = ((_url: string, init: any) => {
      calls += 1
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener(`abort`, () => {
          const err = new Error(`aborted`)
          err.name = `AbortError`
          reject(err)
        })
      })
    }) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn, requestTimeoutMs: 5 })

    const res = await api.queryRecords(`c`, emptyQuery)
    expect(calls).toBe(1) // a timeout is NOT retried
    expect(res.error).toMatch(/timed out/)
  })

  it(`authorFunction POSTs the request to the agent-scoped author-function URL`, async () => {
    let seenUrl: string | undefined
    let seenBody: unknown
    const fetchFn = (async (url: string, init: any) => {
      seenUrl = url
      seenBody = JSON.parse(init.body)
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: { id: `fn_1`, name: `f` } }),
      }
    }) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn })

    const request = { name: `f`, language: `javascript`, content: `x` }
    const res = await api.authorFunction(request)

    expect(seenUrl).toBe(
      `https://px.test/_/orgs/og_1/projects/pj_1/agents/ag_1/author-function`
    )
    expect(seenBody).toEqual(request)
    expect(res).toEqual({ ok: true, status: 201, data: { id: `fn_1`, name: `f` } })
  })

  it(`authorEndpoint POSTs the request to the agent-scoped author-endpoint URL`, async () => {
    let seenUrl: string | undefined
    let seenBody: unknown
    const fetchFn = (async (url: string, init: any) => {
      seenUrl = url
      seenBody = JSON.parse(init.body)
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: { id: `ep_1`, name: `ep` } }),
      }
    }) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn })

    const request = { name: `ep`, path: `/x`, options: { url: `https://api.test` } }
    const res = await api.authorEndpoint(request)

    expect(seenUrl).toBe(
      `https://px.test/_/orgs/og_1/projects/pj_1/agents/ag_1/author-endpoint`
    )
    expect(seenBody).toEqual(request)
    expect(res).toEqual({ ok: true, status: 201, data: { id: `ep_1`, name: `ep` } })
  })

  it(`authorSecret POSTs the request to the agent-scoped author-secret URL and returns the id-only echo`, async () => {
    let seenUrl: string | undefined
    let seenBody: any
    const fetchFn = (async (url: string, init: any) => {
      seenUrl = url
      seenBody = JSON.parse(init.body)
      return {
        ok: true,
        status: 201,
        json: async () => ({ data: { secretId: `sc_1`, name: `K`, rotated: false } }),
      }
    }) as unknown as typeof fetch
    const api = createResidentApi({ ...baseOpts, fetchFn })

    const request = { name: `K`, value: `sk_live_secret` }
    const res = await api.authorSecret(request)

    expect(seenUrl).toBe(
      `https://px.test/_/orgs/og_1/projects/pj_1/agents/ag_1/author-secret`
    )
    // The value is sent over the wire (encrypted at rest server-side)…
    expect(seenBody.value).toBe(`sk_live_secret`)
    // …but the response never echoes the value back.
    expect(res).toEqual({
      ok: true,
      status: 201,
      data: { secretId: `sc_1`, name: `K`, rotated: false },
    })
    expect(res.data).not.toHaveProperty(`value`)
  })
})
