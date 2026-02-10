import type { Request } from 'express'

import * as jose from 'jose'
import { Auth } from './auth'
import { EJWTError } from '@TPX/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`jose`, () => ({
  createRemoteJWKSet: vi.fn(() => `mock-jwks-keyset`),
  jwtVerify: vi.fn(),
}))

vi.mock(`@TPX/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe(`Auth`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe(`constructor`, () => {
    it(`should throw when url is empty`, () => {
      expect(() => new Auth({ url: `` })).toThrow(
        `JWKS URL is required but not configured`
      )
    })

    it(`should initialize successfully with a valid URL`, () => {
      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      expect(auth.jwksUrl).toBe(`https://auth.example.com/.well-known/jwks.json`)
      expect(jose.createRemoteJWKSet).toHaveBeenCalled()
    })
  })

  describe(`initialized`, () => {
    it(`should return true after construction with valid URL`, () => {
      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      expect(auth.initialized()).toBe(true)
    })
  })

  describe(`isPublic`, () => {
    const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })

    it(`should return true for /health`, () => {
      expect(auth.isPublic(`/health`)).toBe(true)
    })

    it(`should return true for /domains/validate`, () => {
      expect(auth.isPublic(`/domains/validate`)).toBe(true)
    })

    it(`should return false for /auth/me`, () => {
      expect(auth.isPublic(`/auth/me`)).toBe(false)
    })
  })

  describe(`extract`, () => {
    const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })

    it(`should return token from Bearer header`, () => {
      const mockReq = {
        headers: { authorization: `Bearer my-jwt-token-123` },
      } as unknown as Request

      expect(auth.extract(mockReq)).toBe(`my-jwt-token-123`)
    })

    it(`should return null for missing authorization header`, () => {
      const mockReq = {
        headers: {},
      } as unknown as Request

      expect(auth.extract(mockReq)).toBeNull()
    })

    it(`should return null for non-Bearer header`, () => {
      const mockReq = {
        headers: { authorization: `Basic dXNlcjpwYXNz` },
      } as unknown as Request

      expect(auth.extract(mockReq)).toBeNull()
    })
  })

  describe(`verify`, () => {
    it(`should return valid result with payload for a valid JWT`, async () => {
      const mockPayload = {
        sub: `user-123`,
        userId: `user-123`,
        email: `test@example.com`,
        iat: 1700000000,
        exp: 1700003600,
      }

      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: { alg: `RS256` },
      } as any)

      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      const result = await auth.verify(`valid-token`)

      expect(result).toEqual({
        valid: true,
        payload: mockPayload,
      })
      expect(jose.jwtVerify).toHaveBeenCalledWith(`valid-token`, `mock-jwks-keyset`)
    })

    it(`should return expired error for an expired JWT`, async () => {
      const error = new Error(`Token has expired`)
      error.name = EJWTError.expired

      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(error)

      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      const result = await auth.verify(`expired-token`)

      expect(result).toEqual({
        valid: false,
        expired: true,
        error: `Token expired`,
      })
    })

    it(`should return signature error for an invalid signature`, async () => {
      const error = new Error(`signature verification failed`)
      error.name = EJWTError.signature

      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(error)

      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      const result = await auth.verify(`bad-signature-token`)

      expect(result).toEqual({
        valid: false,
        error: `Invalid token signature`,
      })
    })

    it(`should return claim validation error for a claim failure`, async () => {
      const error = new Error(`unexpected "aud" claim value`)
      error.name = EJWTError.claim

      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(error)

      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      const result = await auth.verify(`bad-claim-token`)

      expect(result).toEqual({
        valid: false,
        error: `Token claim validation failed: unexpected "aud" claim value`,
      })
    })

    it(`should return generic error for unknown verification failures`, async () => {
      const error = new Error(`Something went wrong`)
      error.name = `UnknownError`

      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(error)

      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      const result = await auth.verify(`unknown-error-token`)

      expect(result).toEqual({
        valid: false,
        error: `Something went wrong`,
      })
    })

    it(`should return valid false when JWKS is not initialized`, async () => {
      const auth = new Auth({ url: `https://auth.example.com/.well-known/jwks.json` })
      // Force jwks to null to simulate uninitialized state
      auth.jwks = null

      const result = await auth.verify(`some-token`)

      expect(result).toEqual({
        valid: false,
        error: `JWKS client not initialized. Call initJWKS first.`,
      })
    })
  })
})
