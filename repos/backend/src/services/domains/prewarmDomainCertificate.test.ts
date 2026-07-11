import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { prewarmDomainCertificate } from './prewarmDomainCertificate'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { logger } from '@TBE/utils/logger'

describe(`prewarmDomainCertificate`, () => {
  let mockDb: any
  let origFetch: typeof globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    origFetch = globalThis.fetch
    mockDb = {
      services: {
        domain: {
          verified: vi.fn().mockResolvedValue({ data: true }),
        },
      },
    }
  })

  afterEach(() => {
    globalThis.fetch = origFetch
  })

  it(`marks the domain verified when the pre-warm request succeeds`, async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      text: vi.fn().mockResolvedValue(`OK`),
    }) as any

    await prewarmDomainCertificate(mockDb, `example.com`, `X-Prewarm`)

    expect(globalThis.fetch).toHaveBeenCalledWith(`https://example.com`, {
      method: `GET`,
      headers: { 'X-Prewarm': `true` },
      signal: expect.any(AbortSignal),
    })
    expect(mockDb.services.domain.verified).toHaveBeenCalledWith(`example.com`)
  })

  it(`logs a warning and does not mark verified when the pre-warm response is an error status`, async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 503,
      text: vi.fn().mockResolvedValue(`Service Unavailable`),
    }) as any

    await prewarmDomainCertificate(mockDb, `example.com`, `X-Prewarm`)

    expect(mockDb.services.domain.verified).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Service Unavailable`)
    )
  })

  it(`swallows a thrown fetch error and logs a warning instead of throwing`, async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error(`network unreachable`)) as any

    await expect(
      prewarmDomainCertificate(mockDb, `example.com`, `X-Prewarm`)
    ).resolves.toBeUndefined()

    expect(mockDb.services.domain.verified).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`network unreachable`)
    )
  })
})
