import { ProxyService } from './proxy'
import { Exception } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`axios`, () => ({
  default: { post: vi.fn() },
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: {
    replaceInObj: vi.fn((obj: any) => obj),
  },
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
      ).rejects.toThrow('Secret not found for auth')
    })

    it(`should throw when secret has no value`, async () => {
      const req = createMockReq()
      const noValueSecret = { id: 'aaaaaaaaaa', name: 'test', value: undefined } as any
      await expect(
        service.applyAuth(req, { type: 'bearer', secretId: 'aaaaaaaaaa' } as any, [
          noValueSecret,
        ])
      ).rejects.toThrow('Secret not found for auth')
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

  describe(`applyAuth - Exception status codes`, () => {
    const createMockReq = () => ({ setHeader: vi.fn() }) as any
    const mockSecret = { id: 'aaaaaaaaaa', name: 'test', value: 'secret-value' } as any

    it(`should throw Exception(400) when auth configured but no secretId`, async () => {
      const req = createMockReq()
      try {
        await service.applyAuth(req, { type: 'bearer' } as any)
        expect.unreachable(`should have thrown`)
      } catch (error) {
        expect(error).toBeInstanceOf(Exception)
        expect((error as Exception).status).toBe(400)
        expect((error as Exception).message).toBe(
          `Auth configured but no secretId provided`
        )
      }
    })

    it(`should throw Exception(404) when secret not found`, async () => {
      const req = createMockReq()
      try {
        await service.applyAuth(
          req,
          { type: 'bearer', secretId: 'missing-id' } as any,
          []
        )
        expect.unreachable(`should have thrown`)
      } catch (error) {
        expect(error).toBeInstanceOf(Exception)
        expect((error as Exception).status).toBe(404)
        expect((error as Exception).message).toBe(`Secret not found for auth`)
      }
    })

    it(`should throw Exception(400) when auth type is unknown`, async () => {
      const req = createMockReq()
      try {
        await service.applyAuth(
          req,
          { type: 'custom-unknown', secretId: 'aaaaaaaaaa' } as any,
          [mockSecret]
        )
        expect.unreachable(`should have thrown`)
      } catch (error) {
        expect(error).toBeInstanceOf(Exception)
        expect((error as Exception).status).toBe(400)
        expect((error as Exception).message).toContain(`Unknown auth type`)
      }
    })
  })

  describe(`getOAuthToken - Exception status codes`, () => {
    it(`should throw Exception(502) when access_token is missing from response`, async () => {
      const axios = await import('axios')
      vi.mocked(axios.default.post).mockResolvedValue({
        data: { expires_in: 3600 },
      })

      try {
        await service.getOAuthToken({
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client-1',
          clientSecret: 'client-secret',
        } as any)
        expect.unreachable(`should have thrown`)
      } catch (error) {
        expect(error).toBeInstanceOf(Exception)
        expect((error as Exception).status).toBe(502)
        // The inner Exception is caught by the outer catch block,
        // which re-throws with a generic message
        expect((error as Exception).message).toBe(`Failed to obtain OAuth access token`)
      }
    })

    it(`should throw Exception(502) when token exchange request fails`, async () => {
      const axios = await import('axios')
      vi.mocked(axios.default.post).mockRejectedValue(new Error(`Network error`))

      try {
        await service.getOAuthToken({
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client-2',
          clientSecret: 'client-secret',
        } as any)
        expect.unreachable(`should have thrown`)
      } catch (error) {
        expect(error).toBeInstanceOf(Exception)
        expect((error as Exception).status).toBe(502)
        expect((error as Exception).message).toBe(`Failed to obtain OAuth access token`)
      }
    })
  })

  describe(`applyEndpointOptionsAsync - Exception status codes`, () => {
    const createMockReq = () => ({ setHeader: vi.fn() }) as any

    it(`should throw Exception(403) when request origin is not in domain whitelist`, async () => {
      const req = createMockReq()
      try {
        await service.applyEndpointOptionsAsync(
          req,
          {
            domainWhitelist: {
              allowedDomains: ['example.com'],
              enforceWhitelist: true,
              logBlocked: false,
            },
          } as any,
          undefined,
          'https://evil.com',
          '/api/test'
        )
        expect.unreachable(`should have thrown`)
      } catch (error) {
        expect(error).toBeInstanceOf(Exception)
        expect((error as Exception).status).toBe(403)
        expect((error as Exception).message).toBe(
          `Request origin not in domain whitelist`
        )
      }
    })

    it(`should throw Exception(403) when request path does not match pathRegex`, async () => {
      const req = createMockReq()
      try {
        await service.applyEndpointOptionsAsync(
          req,
          { pathRegex: '^/allowed/.*$' } as any,
          undefined,
          undefined,
          '/forbidden/resource'
        )
        expect.unreachable(`should have thrown`)
      } catch (error) {
        expect(error).toBeInstanceOf(Exception)
        expect((error as Exception).status).toBe(403)
        expect((error as Exception).message).toBe(`Request path does not match pathRegex`)
      }
    })

    it(`should not throw when domain whitelist allows the origin`, async () => {
      const req = createMockReq()
      // No auth/oauth so it should complete without throwing
      await expect(
        service.applyEndpointOptionsAsync(
          req,
          {
            domainWhitelist: {
              allowedDomains: ['example.com'],
              enforceWhitelist: true,
            },
          } as any,
          undefined,
          'https://example.com',
          '/api/test'
        )
      ).resolves.toBeUndefined()
    })

    it(`should not throw when path matches pathRegex`, async () => {
      const req = createMockReq()
      await expect(
        service.applyEndpointOptionsAsync(
          req,
          { pathRegex: '^/api/.*$' } as any,
          undefined,
          undefined,
          '/api/resource'
        )
      ).resolves.toBeUndefined()
    })
  })
})
