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

  describe(`applyAuth`, () => {
    const createMockReq = () => ({ setHeader: vi.fn() }) as any
    const mockSecret = { id: 'aaaaaaaaaa', name: 'test', value: 'secret-value' } as any

    it(`should throw when secretId is missing`, async () => {
      const req = createMockReq()
      await expect(service.applyAuth(req, { type: 'bearer' } as any)).rejects.toThrow(
        'Auth configured but no secretId provided'
      )
    })

    it(`should throw when secret not found in array`, async () => {
      const req = createMockReq()
      await expect(
        service.applyAuth(req, { type: 'bearer', secretId: 'zzzzzzzzzz' } as any, [])
      ).rejects.toThrow('Secret with ID "zzzzzzzzzz" not found for auth')
    })

    it(`should throw when secret has no value`, async () => {
      const req = createMockReq()
      const noValueSecret = { id: 'aaaaaaaaaa', name: 'test', value: undefined } as any
      await expect(
        service.applyAuth(req, { type: 'bearer', secretId: 'aaaaaaaaaa' } as any, [
          noValueSecret,
        ])
      ).rejects.toThrow('Secret with ID "aaaaaaaaaa" not found for auth')
    })

    it(`should set Bearer auth header`, async () => {
      const req = createMockReq()
      await service.applyAuth(req, { type: 'bearer', secretId: 'aaaaaaaaaa' } as any, [
        mockSecret,
      ])
      expect(req.setHeader).toHaveBeenCalledWith('Authorization', 'Bearer secret-value')
    })

    it(`should set Basic auth header`, async () => {
      const req = createMockReq()
      await service.applyAuth(req, { type: 'basic', secretId: 'aaaaaaaaaa' } as any, [
        mockSecret,
      ])
      const expectedBasic = Buffer.from('secret-value').toString('base64')
      expect(req.setHeader).toHaveBeenCalledWith(
        'Authorization',
        `Basic ${expectedBasic}`
      )
    })

    it(`should set API key header`, async () => {
      const req = createMockReq()
      await service.applyAuth(req, { type: 'apikey', secretId: 'aaaaaaaaaa' } as any, [
        mockSecret,
      ])
      expect(req.setHeader).toHaveBeenCalledWith('Authorization', 'secret-value')
    })

    it(`should use custom headerName`, async () => {
      const req = createMockReq()
      await service.applyAuth(
        req,
        { type: 'bearer', secretId: 'aaaaaaaaaa', headerName: 'X-Custom' } as any,
        [mockSecret]
      )
      expect(req.setHeader).toHaveBeenCalledWith('X-Custom', 'Bearer secret-value')
    })

    it(`should throw on unknown auth type`, async () => {
      const req = createMockReq()
      await expect(
        service.applyAuth(
          req,
          { type: 'custom-unknown', secretId: 'aaaaaaaaaa' } as any,
          [mockSecret]
        )
      ).rejects.toThrow('Unknown auth type: custom-unknown')
    })
  })
})
