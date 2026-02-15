import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  createSession,
  getSession,
  deleteSession,
  resetSessionStore,
  SESSION_TTL,
} from './sessionStore'

describe(`sessionStore`, () => {
  beforeEach(() => {
    resetSessionStore()
  })

  afterEach(() => {
    resetSessionStore()
    vi.restoreAllMocks()
  })

  const mockSessionData = {
    agentId: `agent-1`,
    orgId: `org-1`,
    userId: `user-1`,
    llmConfig: {
      apiKey: `sk-test-key`,
      model: `claude-sonnet-4-20250514`,
      provider: `anthropic` as const,
    },
  }

  describe(`createSession`, () => {
    it(`should return a UUID token`, () => {
      const token = createSession(mockSessionData)
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )
    })

    it(`should return unique tokens for each call`, () => {
      const token1 = createSession(mockSessionData)
      const token2 = createSession(mockSessionData)
      expect(token1).not.toBe(token2)
    })
  })

  describe(`getSession`, () => {
    it(`should return the session for a valid token`, () => {
      const token = createSession(mockSessionData)
      const session = getSession(token)
      expect(session).toBeDefined()
      expect(session!.agentId).toBe(`agent-1`)
      expect(session!.orgId).toBe(`org-1`)
      expect(session!.userId).toBe(`user-1`)
      expect(session!.llmConfig.apiKey).toBe(`sk-test-key`)
      expect(session!.llmConfig.provider).toBe(`anthropic`)
    })

    it(`should return undefined for an unknown token`, () => {
      expect(getSession(`nonexistent-token`)).toBeUndefined()
    })

    it(`should return undefined and delete an expired session`, () => {
      const now = Date.now()
      vi.spyOn(Date, `now`).mockReturnValueOnce(now)

      const token = createSession(mockSessionData)

      // Advance time past TTL
      vi.spyOn(Date, `now`).mockReturnValue(now + SESSION_TTL + 1)

      expect(getSession(token)).toBeUndefined()
      // Session was deleted on access
      vi.spyOn(Date, `now`).mockReturnValue(now)
      expect(getSession(token)).toBeUndefined()
    })

    it(`should return the session if just within TTL`, () => {
      const now = Date.now()
      vi.spyOn(Date, `now`).mockReturnValueOnce(now)

      const token = createSession(mockSessionData)

      // Advance time to just before TTL
      vi.spyOn(Date, `now`).mockReturnValue(now + SESSION_TTL - 1)

      expect(getSession(token)).toBeDefined()
    })

    it(`should include createdAt timestamp`, () => {
      const before = Date.now()
      const token = createSession(mockSessionData)
      const session = getSession(token)
      expect(session!.createdAt).toBeGreaterThanOrEqual(before)
      expect(session!.createdAt).toBeLessThanOrEqual(Date.now())
    })
  })

  describe(`deleteSession`, () => {
    it(`should remove the session`, () => {
      const token = createSession(mockSessionData)
      expect(getSession(token)).toBeDefined()
      deleteSession(token)
      expect(getSession(token)).toBeUndefined()
    })

    it(`should not throw for unknown tokens`, () => {
      expect(() => deleteSession(`nonexistent`)).not.toThrow()
    })
  })

  describe(`resetSessionStore`, () => {
    it(`should clear all sessions`, () => {
      const token1 = createSession(mockSessionData)
      const token2 = createSession({ ...mockSessionData, agentId: `agent-2` })
      resetSessionStore()
      expect(getSession(token1)).toBeUndefined()
      expect(getSession(token2)).toBeUndefined()
    })
  })
})
