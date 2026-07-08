import { describe, it, expect } from 'vitest'
import { ApiKey } from './apiKey'
import { EPermResource, EPermAction } from '../types/permissions.types'

describe(`ApiKey model`, () => {
  const baseData = {
    id: `key-1`,
    key: `tdsk_live_abc123`,
    name: `Test Key`,
    orgId: `org-1`,
    userId: `user-1`,
    keyHash: `hashed-value`,
    active: true,
    keyPrefix: `tdsk_live_`,
  }

  describe(`constructor`, () => {
    it(`should create an api key with all fields`, () => {
      const apiKey = new ApiKey(baseData)
      expect(apiKey.id).toBe(`key-1`)
      expect(apiKey.key).toBe(`tdsk_live_abc123`)
      expect(apiKey.name).toBe(`Test Key`)
      expect(apiKey.orgId).toBe(`org-1`)
      expect(apiKey.userId).toBe(`user-1`)
      expect(apiKey.keyHash).toBe(`hashed-value`)
      expect(apiKey.active).toBe(true)
      expect(apiKey.keyPrefix).toBe(`tdsk_live_`)
    })

    it(`should allow orgId and projectId to be undefined`, () => {
      const { orgId, ...rest } = baseData
      const apiKey = new ApiKey(rest)
      expect(apiKey.orgId).toBeUndefined()
      expect(apiKey.projectId).toBeUndefined()
    })
  })

  describe(`sanitize`, () => {
    it(`should strip key and keyHash fields`, () => {
      const apiKey = new ApiKey(baseData)
      const sanitized = apiKey.sanitize()
      expect(sanitized.key).toBeUndefined()
      expect(sanitized.keyHash).toBeUndefined()
    })

    it(`should preserve other fields`, () => {
      const apiKey = new ApiKey(baseData)
      const sanitized = apiKey.sanitize()
      expect(sanitized.id).toBe(`key-1`)
      expect(sanitized.name).toBe(`Test Key`)
      expect(sanitized.orgId).toBe(`org-1`)
      expect(sanitized.keyPrefix).toBe(`tdsk_live_`)
    })

    it(`should return a new ApiKey instance`, () => {
      const apiKey = new ApiKey(baseData)
      const sanitized = apiKey.sanitize()
      expect(sanitized).toBeInstanceOf(ApiKey)
      expect(sanitized).not.toBe(apiKey)
    })
  })

  describe(`hasPermission`, () => {
    it(`should return false when permissions is undefined`, () => {
      const apiKey = new ApiKey(baseData)
      expect(apiKey.hasPermission(`agent:read`)).toBe(false)
    })

    it(`should return false when permissions is an empty array`, () => {
      const apiKey = new ApiKey({ ...baseData, permissions: [] })
      expect(apiKey.hasPermission(`agent:read`)).toBe(false)
    })

    it(`should return true when the permission is present`, () => {
      const apiKey = new ApiKey({
        ...baseData,
        permissions: [
          `${EPermResource.agent}:${EPermAction.read}`,
          `${EPermResource.thread}:${EPermAction.create}`,
        ],
      })
      expect(apiKey.hasPermission(`agent:read`)).toBe(true)
    })

    it(`should return false when the permission is absent`, () => {
      const apiKey = new ApiKey({
        ...baseData,
        permissions: [`${EPermResource.agent}:${EPermAction.read}`],
      })
      expect(apiKey.hasPermission(`agent:delete`)).toBe(false)
    })
  })

  describe(`isExpired`, () => {
    it(`should return false when expiresAt is undefined`, () => {
      const apiKey = new ApiKey(baseData)
      expect(apiKey.isExpired()).toBe(false)
    })

    it(`should return true when expiresAt is in the past`, () => {
      const apiKey = new ApiKey({
        ...baseData,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })
      expect(apiKey.isExpired()).toBe(true)
    })

    it(`should return false when expiresAt is in the future`, () => {
      const apiKey = new ApiKey({
        ...baseData,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
      })
      expect(apiKey.isExpired()).toBe(false)
    })

    it(`should handle expiresAt as a Date instance`, () => {
      const apiKey = new ApiKey({
        ...baseData,
        expiresAt: new Date(Date.now() - 1000),
      })
      expect(apiKey.isExpired()).toBe(true)
    })
  })

  describe(`isValid`, () => {
    it(`should return true when active and not expired`, () => {
      const apiKey = new ApiKey({ ...baseData, active: true })
      expect(apiKey.isValid()).toBe(true)
    })

    it(`should return false when not active`, () => {
      const apiKey = new ApiKey({ ...baseData, active: false })
      expect(apiKey.isValid()).toBe(false)
    })

    it(`should return false when active but expired`, () => {
      const apiKey = new ApiKey({
        ...baseData,
        active: true,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      })
      expect(apiKey.isValid()).toBe(false)
    })
  })

  describe(`getRateLimit`, () => {
    it(`should return the default rate limit when rateLimit is undefined`, () => {
      const apiKey = new ApiKey(baseData)
      expect(apiKey.getRateLimit()).toBe(100)
    })

    it(`should return the default rate limit when rateLimit is 0`, () => {
      const apiKey = new ApiKey({ ...baseData, rateLimit: 0 })
      expect(apiKey.getRateLimit()).toBe(100)
    })

    it(`should return the configured rate limit when set`, () => {
      const apiKey = new ApiKey({ ...baseData, rateLimit: 250 })
      expect(apiKey.getRateLimit()).toBe(250)
    })
  })
})
