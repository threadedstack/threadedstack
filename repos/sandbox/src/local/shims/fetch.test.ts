import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGuardedFetch } = vi.hoisted(() => ({
  mockGuardedFetch: vi.fn(),
}))

vi.mock(`@tdsk/domain`, async (importOriginal) => {
  const actual = (await importOriginal()) as object
  return { ...actual, guardedFetch: mockGuardedFetch }
})

import { fetchShim } from './fetch'

describe(`fetchShim`, () => {
  let mockSet: ReturnType<typeof vi.fn>
  let mockEvalClosure: ReturnType<typeof vi.fn>
  let jail: any
  let ivm: any
  let deps: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockSet = vi.fn()
    mockEvalClosure = vi.fn().mockReturnValue({ catch: vi.fn() })

    jail = { set: mockSet }
    // Mirrors isolate.test.ts's isolated-vm mock: Callback wraps and returns
    // the given function directly (no structured-clone boundary in tests).
    ivm = { Callback: vi.fn().mockImplementation((fn: any) => fn) }
    deps = { context: { evalClosure: mockEvalClosure } }
  })

  const getFetchStart = async () => {
    await fetchShim.setupCallbacks!(jail, ivm, deps)
    expect(mockSet).toHaveBeenCalledOnce()
    const [name, fn] = mockSet.mock.calls[0]
    expect(name).toBe(`_fetchStart`)
    return fn as (id: number, url: string, optsJson: string) => void
  }

  // Flush the microtask queue so the shim's internal async run().then(...)
  // resolves before assertions run.
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

  it(`should call guardedFetch (not raw fetch) with the isolate-supplied url/opts and settle true on success`, async () => {
    const headers = new Map([[`content-type`, `application/json`]])
    mockGuardedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: `OK`,
      headers: { entries: () => headers.entries() },
      url: `https://api.example.com/data`,
      text: async () => `{"hello":"world"}`,
    })

    const fetchStart = await getFetchStart()
    fetchStart(1, `https://api.example.com/data`, JSON.stringify({ method: `GET` }))
    await flush()

    expect(mockGuardedFetch).toHaveBeenCalledOnce()
    expect(mockGuardedFetch).toHaveBeenCalledWith(`https://api.example.com/data`, {
      method: `GET`,
    })

    expect(mockEvalClosure).toHaveBeenCalledOnce()
    const [closure, args] = mockEvalClosure.mock.calls[0]
    expect(closure).toBe(`__fetchSettle($0, $1, $2)`)
    expect(args[0]).toBe(1)
    expect(args[1]).toBe(true)
    const payload = JSON.parse(args[2])
    expect(payload.ok).toBe(true)
    expect(payload.status).toBe(200)
    expect(payload.body).toBe(`{"hello":"world"}`)
  })

  it(`should settle false with the guard's error message when guardedFetch rejects a blocked host`, async () => {
    mockGuardedFetch.mockRejectedValueOnce(
      new Error(`Egress to non-public address is blocked: 169.254.169.254`)
    )

    const fetchStart = await getFetchStart()
    fetchStart(2, `http://169.254.169.254/latest/meta-data`, ``)
    await flush()

    expect(mockGuardedFetch).toHaveBeenCalledOnce()
    expect(mockGuardedFetch).toHaveBeenCalledWith(
      `http://169.254.169.254/latest/meta-data`,
      {}
    )

    expect(mockEvalClosure).toHaveBeenCalledOnce()
    const [, args] = mockEvalClosure.mock.calls[0]
    expect(args[0]).toBe(2)
    expect(args[1]).toBe(false)
    expect(args[2]).toBe(`Egress to non-public address is blocked: 169.254.169.254`)
  })
})
