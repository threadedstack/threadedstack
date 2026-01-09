import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock jose
vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn(),
}))

// Mock logger
vi.mock('@TPX/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('neonAuth JWKS', () => {
  const mockJwksUrl = 'https://auth.neon.tech/.well-known/jwks.json'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('initJWKS', () => {
    it('should initialize JWKS client with valid URL', async () => {
      const { initJWKS, isJWKSInitialized, getJWKSUrl } = await import('./neonAuth')

      initJWKS(mockJwksUrl)

      expect(isJWKSInitialized()).toBe(true)
      expect(getJWKSUrl()).toBe(mockJwksUrl)
    })

    it('should throw error if URL is missing', async () => {
      const { initJWKS } = await import('./neonAuth')

      expect(() => initJWKS('')).toThrow('JWKS URL is required but not configured')
    })

    it('should allow re-initialization with different URL', async () => {
      const { initJWKS, getJWKSUrl } = await import('./neonAuth')
      const newUrl = 'https://other.auth.com/.well-known/jwks.json'

      initJWKS(mockJwksUrl)
      expect(getJWKSUrl()).toBe(mockJwksUrl)

      initJWKS(newUrl)
      expect(getJWKSUrl()).toBe(newUrl)
    })
  })

  describe('isJWKSInitialized', () => {
    it('should return false before initialization', async () => {
      const { isJWKSInitialized } = await import('./neonAuth')
      expect(isJWKSInitialized()).toBe(false)
    })

    it('should return true after initialization', async () => {
      const { initJWKS, isJWKSInitialized } = await import('./neonAuth')
      initJWKS(mockJwksUrl)
      expect(isJWKSInitialized()).toBe(true)
    })
  })

  describe('verifyToken', () => {
    it('should return error if JWKS not initialized', async () => {
      const { verifyToken } = await import('./neonAuth')

      const result = await verifyToken('some-token')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('JWKS client not initialized')
    })

    it('should return valid result with payload on success', async () => {
      const jose = await import('jose')
      const mockPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        teamId: 'team-456',
        role: 'admin',
      }

      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: mockPayload,
        protectedHeader: { alg: 'RS256' },
      } as any)

      const { initJWKS, verifyToken } = await import('./neonAuth')
      initJWKS(mockJwksUrl)

      const result = await verifyToken('valid-token')

      expect(result.valid).toBe(true)
      expect(result.payload).toEqual(mockPayload)
    })

    it('should return error for expired token', async () => {
      const jose = await import('jose')
      const error = new Error('Token expired')
      error.name = 'JWTExpired'
      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(error)

      const { initJWKS, verifyToken } = await import('./neonAuth')
      initJWKS(mockJwksUrl)

      const result = await verifyToken('expired-token')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('expired')
    })

    it('should return error for invalid signature', async () => {
      const jose = await import('jose')
      const error = new Error('Invalid signature')
      error.name = 'JWSSignatureVerificationFailed'
      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(error)

      const { initJWKS, verifyToken } = await import('./neonAuth')
      initJWKS(mockJwksUrl)

      const result = await verifyToken('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Invalid token signature')
    })
  })
})
