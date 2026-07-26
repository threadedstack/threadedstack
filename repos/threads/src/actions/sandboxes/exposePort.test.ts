import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExposePort = vi.fn()

vi.mock(`@TTH/services/sandboxApi`, () => ({
  sandboxApi: {
    exposePort: (...args: unknown[]) => mockExposePort(...args),
  },
}))

import { exposePort } from './exposePort'

describe(`exposePort`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`resolves cleanly when the request succeeds`, async () => {
    mockExposePort.mockResolvedValue({ error: null })

    await expect(
      exposePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080)
    ).resolves.toBeUndefined()
  })

  it(`throws with the error's message when the request fails with a message`, async () => {
    mockExposePort.mockResolvedValue({ error: { message: `port already in use` } })

    await expect(exposePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080)).rejects.toThrow(
      `port already in use`
    )
  })

  it(`throws with the fallback message when the error has no message`, async () => {
    mockExposePort.mockResolvedValue({ error: { message: `` } })

    await expect(exposePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080)).rejects.toThrow(
      `Failed to expose port 8080`
    )
  })

  it(`includes protocol in the request body when passed`, async () => {
    mockExposePort.mockResolvedValue({ error: null })

    await exposePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080, `https`)

    expect(mockExposePort).toHaveBeenCalledWith(`og_1`, `pj_1`, `sb_1`, {
      instanceId: `in_1`,
      port: 8080,
      protocol: `https`,
    })
  })

  it(`omits the protocol key entirely when it is not passed`, async () => {
    mockExposePort.mockResolvedValue({ error: null })

    await exposePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080)

    const body = mockExposePort.mock.calls[0][3]
    expect(`protocol` in body).toBe(false)
    expect(body).toEqual({ instanceId: `in_1`, port: 8080 })
  })
})
