import { ProxyService } from './proxyService'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

describe(`ProxyService`, () => {
  let service: ProxyService

  beforeEach(() => {
    service = new ProxyService()
  })

  describe(`applyEndpointOptions`, () => {
    it(`should not set followRedirects`, () => {
      const result = service.applyEndpointOptions({} as any)
      expect(result).not.toHaveProperty(`followRedirects`)
    })

    it(`should return empty options when no timeout or retries`, () => {
      const result = service.applyEndpointOptions({} as any)
      expect(result).toEqual({})
    })

    it(`should set timeout when provided`, () => {
      const result = service.applyEndpointOptions({ timeout: 5000 } as any)
      expect(result.timeout).toBe(5000)
    })

    it(`should not include followRedirects even with timeout`, () => {
      const result = service.applyEndpointOptions({ timeout: 5000 } as any)
      expect(result).not.toHaveProperty(`followRedirects`)
      expect(Object.keys(result)).toEqual([`timeout`])
    })
  })
})
