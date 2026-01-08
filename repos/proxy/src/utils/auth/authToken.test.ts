import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger
vi.mock(`@TPX/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Create error classes for mock
class MockTokenExpiredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = `TokenExpiredError`
  }
}

class MockJsonWebTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = `JsonWebTokenError`
  }
}

// Mock jwt
vi.mock(`jsonwebtoken`, () => ({
  default: {
    sign: vi.fn().mockReturnValue(`mock-token`),
    verify: vi.fn().mockImplementation((token, _secret) => {
      if (token === `valid-token`) {
        return { userId: `user-123`, email: `test@test.com` }
      }
      if (token === `expired-token`) {
        throw new MockTokenExpiredError(`Token expired`)
      }
      throw new MockJsonWebTokenError(`Invalid token`)
    }),
  },
  TokenExpiredError: MockTokenExpiredError,
  JsonWebTokenError: MockJsonWebTokenError,
}))

describe(`JWT Auth Middleware`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe(`Token generation`, () => {
    it(`should generate access token`, async () => {
      const { generateAccessToken } = await import(`./authToken`)
      const token = generateAccessToken(
        { userId: `user-123`, email: `test@test.com` },
        `secret`,
        `7d`
      )

      expect(token).toBe(`mock-token`)
    })

    it(`should generate refresh token`, async () => {
      const { generateRefreshToken } = await import(`./authToken`)
      const token = generateRefreshToken(
        { userId: `user-123`, email: `test@test.com` },
        `secret`,
        `30d`
      )

      expect(token).toBe(`mock-token`)
    })
  })
})
