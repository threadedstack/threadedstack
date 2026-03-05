import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { signSessionToken, verifySessionToken, resetSigningKey } from './sessionToken'

const VALID_HEX_KEY = `a`.repeat(64) // 32 bytes hex

describe(`sessionToken`, () => {
  beforeEach(() => {
    resetSigningKey()
    process.env.TDSK_MASTER_KEY = VALID_HEX_KEY
  })

  afterEach(() => {
    resetSigningKey()
    vi.restoreAllMocks()
  })

  const payload = {
    userId: `user-1`,
    agentId: `agent-1`,
    orgId: `org-1`,
  }

  describe(`signSessionToken`, () => {
    it(`should return a JWT string with three parts`, () => {
      const token = signSessionToken(payload)
      const parts = token.split(`.`)
      expect(parts).toHaveLength(3)
    })

    it(`should return different tokens for different payloads`, () => {
      const token1 = signSessionToken(payload)
      const token2 = signSessionToken({ ...payload, userId: `user-2` })
      expect(token1).not.toBe(token2)
    })

    it(`should throw when TDSK_MASTER_KEY is missing`, () => {
      delete process.env.TDSK_MASTER_KEY
      resetSigningKey()
      expect(() => signSessionToken(payload)).toThrow(`TDSK_MASTER_KEY`)
    })
  })

  describe(`verifySessionToken`, () => {
    it(`should return the payload for a valid token`, () => {
      const token = signSessionToken(payload)
      const result = verifySessionToken(token)
      expect(result).toEqual(payload)
    })

    it(`should return null for a tampered token`, () => {
      const token = signSessionToken(payload)
      const tampered = token.slice(0, -5) + `XXXXX`
      expect(verifySessionToken(tampered)).toBeNull()
    })

    it(`should return null for a random string`, () => {
      expect(verifySessionToken(`not-a-jwt`)).toBeNull()
    })

    it(`should return null for an expired token`, () => {
      vi.useFakeTimers()

      const token = signSessionToken(payload)

      // Advance 2 hours past the 1-hour TTL
      vi.advanceTimersByTime(2 * 60 * 60 * 1000)

      expect(verifySessionToken(token)).toBeNull()

      vi.useRealTimers()
    })

    it(`should return token within TTL`, () => {
      vi.useFakeTimers()

      const token = signSessionToken(payload)

      // Advance 30 minutes (within 1-hour TTL)
      vi.advanceTimersByTime(30 * 60 * 1000)

      expect(verifySessionToken(token)).toEqual(payload)

      vi.useRealTimers()
    })

    it(`should return null for a token signed with a different key`, () => {
      const token = signSessionToken(payload)

      // Change the key
      process.env.TDSK_MASTER_KEY = `b`.repeat(64)
      resetSigningKey()

      expect(verifySessionToken(token)).toBeNull()
    })

    it(`should not include extra JWT fields in the result`, () => {
      const token = signSessionToken(payload)
      const result = verifySessionToken(token)
      expect(Object.keys(result!).sort()).toEqual([`agentId`, `orgId`, `userId`])
    })

    it(`should include projectId in result when signed with projectId`, () => {
      const payloadWithProject = { ...payload, projectId: `proj-1` }
      const token = signSessionToken(payloadWithProject)
      const result = verifySessionToken(token)
      expect(result).toEqual(payloadWithProject)
      expect(Object.keys(result!).sort()).toEqual([
        `agentId`,
        `orgId`,
        `projectId`,
        `userId`,
      ])
    })

    it(`should not include projectId when signed without it`, () => {
      const token = signSessionToken(payload)
      const result = verifySessionToken(token)
      expect(result).not.toHaveProperty(`projectId`)
    })
  })
})
