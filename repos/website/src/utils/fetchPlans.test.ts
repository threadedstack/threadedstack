import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock(`@TAF/constants/envs`, () => ({
  TDSK_CADDY_PX_HOST: `px.test.threadedstack.app`,
}))

// Shrinks FetchPlansTimeoutMs so the hang test below completes in
// milliseconds instead of the real 30s.
vi.mock(`@TAF/constants/values`, () => ({
  FetchPlansTimeoutMs: 50,
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

import { fetchPlans } from './fetchPlans'

describe(`fetchPlans`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it(`returns the plans array on a successful response`, async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: `plan_1`, name: `Solo` }] }),
    })

    const plans = await fetchPlans()

    expect(plans).toEqual([{ id: `plan_1`, name: `Solo` }])
    expect(mockFetch).toHaveBeenCalledWith(
      `https://px.test.threadedstack.app/_/subscriptions/plans`,
      { signal: expect.any(AbortSignal) }
    )
  })

  it(`returns an empty array when the response has no data`, async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

    const plans = await fetchPlans()

    expect(plans).toEqual([])
  })

  it(`throws with the status and body text on a non-ok response`, async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: `Internal Server Error`,
      text: async () => `boom`,
    })

    await expect(fetchPlans()).rejects.toThrow(
      `Failed to fetch plans: 500 Internal Server Error - boom`
    )
  })

  it(`rejects within the timeout window instead of hanging when the request never settles`, async () => {
    // Mimics real fetch's abort-signal behavior: never resolves on its own,
    // only rejects once the passed AbortSignal actually fires -- this proves
    // fetchPlans passes a working, bounded signal rather than an unbounded
    // fetch that would hang the root-route loader forever.
    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise((_resolve, reject) => {
        opts.signal?.addEventListener(`abort`, () => {
          reject(new DOMException(`The operation was aborted`, `AbortError`))
        })
      })
    })

    await expect(fetchPlans()).rejects.toThrow()
  })
})
