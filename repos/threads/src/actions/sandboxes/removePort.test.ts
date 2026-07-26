import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRemovePort = vi.fn()

vi.mock(`@TTH/services/sandboxApi`, () => ({
  sandboxApi: {
    removePort: (...args: unknown[]) => mockRemovePort(...args),
  },
}))

import { removePort } from './removePort'

describe(`removePort`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`resolves cleanly when the request succeeds`, async () => {
    mockRemovePort.mockResolvedValue({ error: null })

    await expect(
      removePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080)
    ).resolves.toBeUndefined()
    expect(mockRemovePort).toHaveBeenCalledWith(`og_1`, `pj_1`, `sb_1`, 8080, `in_1`)
  })

  it(`throws with the error's message when the request fails with a message`, async () => {
    mockRemovePort.mockResolvedValue({ error: { message: `port not found` } })

    await expect(removePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080)).rejects.toThrow(
      `port not found`
    )
  })

  it(`throws with the fallback message when the error has no message`, async () => {
    mockRemovePort.mockResolvedValue({ error: { message: `` } })

    await expect(removePort(`og_1`, `pj_1`, `sb_1`, `in_1`, 8080)).rejects.toThrow(
      `Failed to remove port 8080`
    )
  })
})
