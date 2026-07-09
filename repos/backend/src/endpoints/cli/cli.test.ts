import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { cli } from './cli'
import { EPMethod } from '@TBE/types'
import { createSessionKey } from './createSessionKey'
import { revokeSessionKey } from './revokeSessionKey'
import { CliSessionKeyPrefix, CliSessionKeyMaxPerOrg } from '@TBE/constants/values'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const build = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()
  const apiKeySvc = {
    get: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    cleanupExpiredCliSessionKeys: vi.fn().mockResolvedValue({ data: undefined }),
    countActiveCliSessionKeys: vi.fn().mockResolvedValue({ data: 0 }),
    findOldestCliSessionKey: vi.fn().mockResolvedValue({ data: undefined }),
  }
  const roleSvc = {
    isOrgMember: vi.fn().mockResolvedValue({ data: true }),
  }
  const req = {
    app: { locals: { db: { services: { apiKey: apiKeySvc, role: roleSvc } } } } as any,
    user: { id: `user-1` } as any,
    params: { orgId: `org-1` },
    query: {},
    body: {},
  } as unknown as TRequest
  const res = { status: mockStatus, json: mockJson } as unknown as Response
  return { req, res, mockJson, mockStatus, apiKeySvc, roleSvc }
}

describe(`CLI endpoints`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(cli.path).toBe(`/cli`)
      expect(cli.method).toBe(EPMethod.Use)
      expect(cli.endpoints).toBeDefined()
      expect(cli.endpoints?.createSessionKey).toBeDefined()
      expect(cli.endpoints?.revokeSessionKey).toBeDefined()
    })
  })

  describe(`POST /cli/session - Create CLI session key`, () => {
    it(`should create a session key and return 201`, async () => {
      const { req, res, mockJson, mockStatus, apiKeySvc } = build()
      apiKeySvc.create.mockResolvedValue({ data: { id: `key-1` } })

      await createSessionKey.action(req, res)

      expect(mockStatus).toHaveBeenCalledWith(201)
      const response = mockJson.mock.calls[0][0]
      expect(response.data.id).toBe(`key-1`)
      expect(response.data.orgId).toBe(`org-1`)
      expect(response.data.key).toMatch(/^tdsk_/)
      expect(response.data.expiresAt).toEqual(expect.any(String))
    })

    it(`should return 401 when unauthenticated`, async () => {
      const { req, res } = build()
      req.user = undefined

      await expect(createSessionKey.action(req, res)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should return 400 when orgId is missing`, async () => {
      const { req, res } = build()
      req.params = {}

      await expect(createSessionKey.action(req, res)).rejects.toThrow(
        `Organization ID is required`
      )
    })

    it(`should return 403 when caller is not an org member`, async () => {
      const { req, res, roleSvc } = build()
      roleSvc.isOrgMember.mockResolvedValue({ data: false })

      await expect(createSessionKey.action(req, res)).rejects.toThrow(
        `You are not a member of this organization`
      )
    })

    it(`should still create a key when cleanup of expired keys fails`, async () => {
      const { req, res, mockStatus, apiKeySvc } = build()
      apiKeySvc.cleanupExpiredCliSessionKeys.mockResolvedValue({
        error: new Error(`cleanup failed`),
      })
      apiKeySvc.create.mockResolvedValue({ data: { id: `key-1` } })

      await createSessionKey.action(req, res)

      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should return 500 when the active key count lookup fails`, async () => {
      const { req, res, apiKeySvc } = build()
      apiKeySvc.countActiveCliSessionKeys.mockResolvedValue({
        error: new Error(`count failed`),
      })

      await expect(createSessionKey.action(req, res)).rejects.toThrow(
        `Failed to check session key count`
      )
    })

    it(`should revoke the oldest key when the per-org max is reached`, async () => {
      const { req, res, mockStatus, apiKeySvc } = build()
      apiKeySvc.countActiveCliSessionKeys.mockResolvedValue({
        data: CliSessionKeyMaxPerOrg,
      })
      apiKeySvc.findOldestCliSessionKey.mockResolvedValue({ data: { id: `oldest-1` } })
      apiKeySvc.revoke.mockResolvedValue({ data: {} })
      apiKeySvc.create.mockResolvedValue({ data: { id: `key-new` } })

      await createSessionKey.action(req, res)

      expect(apiKeySvc.findOldestCliSessionKey).toHaveBeenCalledWith(
        `user-1`,
        `org-1`,
        CliSessionKeyPrefix
      )
      expect(apiKeySvc.revoke).toHaveBeenCalledWith(`oldest-1`)
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should not look up the oldest key when under the per-org max`, async () => {
      const { req, res, apiKeySvc } = build()
      apiKeySvc.countActiveCliSessionKeys.mockResolvedValue({
        data: CliSessionKeyMaxPerOrg - 1,
      })
      apiKeySvc.create.mockResolvedValue({ data: { id: `key-1` } })

      await createSessionKey.action(req, res)

      expect(apiKeySvc.findOldestCliSessionKey).not.toHaveBeenCalled()
      expect(apiKeySvc.revoke).not.toHaveBeenCalled()
    })

    it(`should still create a key when finding the oldest key for rotation fails`, async () => {
      const { req, res, mockStatus, apiKeySvc } = build()
      apiKeySvc.countActiveCliSessionKeys.mockResolvedValue({
        data: CliSessionKeyMaxPerOrg,
      })
      apiKeySvc.findOldestCliSessionKey.mockResolvedValue({
        error: new Error(`lookup failed`),
      })
      apiKeySvc.create.mockResolvedValue({ data: { id: `key-1` } })

      await createSessionKey.action(req, res)

      expect(apiKeySvc.revoke).not.toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should still create a key when revoking the oldest key fails`, async () => {
      const { req, res, mockStatus, apiKeySvc } = build()
      apiKeySvc.countActiveCliSessionKeys.mockResolvedValue({
        data: CliSessionKeyMaxPerOrg,
      })
      apiKeySvc.findOldestCliSessionKey.mockResolvedValue({ data: { id: `oldest-1` } })
      apiKeySvc.revoke.mockResolvedValue({ error: new Error(`revoke failed`) })
      apiKeySvc.create.mockResolvedValue({ data: { id: `key-1` } })

      await createSessionKey.action(req, res)

      expect(mockStatus).toHaveBeenCalledWith(201)
    })

    it(`should return 500 when creating the key fails`, async () => {
      const { req, res, apiKeySvc } = build()
      apiKeySvc.create.mockResolvedValue({ error: new Error(`insert failed`) })

      await expect(createSessionKey.action(req, res)).rejects.toThrow(`insert failed`)
    })
  })

  describe(`DELETE /cli/session - Revoke CLI session key`, () => {
    const cliSessionKey = (overrides = {}) => ({
      id: `key-1`,
      userId: `user-1`,
      orgId: `org-1`,
      name: `${CliSessionKeyPrefix}2026-01-01`,
      ...overrides,
    })

    it(`should revoke the caller's own session key and return 200`, async () => {
      const { req, res, mockStatus, mockJson, apiKeySvc } = build()
      req.body = { keyId: `key-1` }
      apiKeySvc.get.mockResolvedValue({ data: cliSessionKey() })
      apiKeySvc.revoke.mockResolvedValue({ data: {} })

      await revokeSessionKey.action(req, res)

      expect(apiKeySvc.revoke).toHaveBeenCalledWith(`key-1`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: { revoked: true } })
    })

    it(`should accept keyId from the query string`, async () => {
      const { req, res, apiKeySvc } = build()
      req.query = { keyId: `key-1` }
      apiKeySvc.get.mockResolvedValue({ data: cliSessionKey() })
      apiKeySvc.revoke.mockResolvedValue({ data: {} })

      await revokeSessionKey.action(req, res)

      expect(apiKeySvc.get).toHaveBeenCalledWith(`key-1`)
    })

    it(`should return 401 when unauthenticated`, async () => {
      const { req, res } = build()
      req.user = undefined
      req.body = { keyId: `key-1` }

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should return 400 when keyId is missing`, async () => {
      const { req, res } = build()

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(`keyId is required`)
    })

    it(`should return 500 when the key lookup fails`, async () => {
      const { req, res, apiKeySvc } = build()
      req.body = { keyId: `key-1` }
      apiKeySvc.get.mockResolvedValue({ error: new Error(`db down`) })

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(
        `Failed to look up session key: db down`
      )
    })

    it(`should return 404 when the key does not exist`, async () => {
      const { req, res, apiKeySvc } = build()
      req.body = { keyId: `missing` }
      apiKeySvc.get.mockResolvedValue({ data: undefined })

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(
        `Session key not found`
      )
    })

    it(`should return 403 when the key belongs to another user`, async () => {
      const { req, res, apiKeySvc } = build()
      req.body = { keyId: `key-1` }
      apiKeySvc.get.mockResolvedValue({ data: cliSessionKey({ userId: `other-user` }) })

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(
        `You can only revoke your own session keys`
      )
    })

    it(`should return 403 when the key belongs to a different org`, async () => {
      const { req, res, apiKeySvc } = build()
      req.body = { keyId: `key-1` }
      apiKeySvc.get.mockResolvedValue({ data: cliSessionKey({ orgId: `other-org` }) })

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(
        `Session key does not belong to this organization`
      )
    })

    it(`should return 400 when the key is not a CLI session key`, async () => {
      const { req, res, apiKeySvc } = build()
      req.body = { keyId: `key-1` }
      apiKeySvc.get.mockResolvedValue({ data: cliSessionKey({ name: `regular-key` }) })

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(
        `This endpoint can only revoke CLI session keys`
      )
    })

    it(`should return 500 when revoking fails`, async () => {
      const { req, res, apiKeySvc } = build()
      req.body = { keyId: `key-1` }
      apiKeySvc.get.mockResolvedValue({ data: cliSessionKey() })
      apiKeySvc.revoke.mockResolvedValue({ error: new Error(`revoke failed`) })

      await expect(revokeSessionKey.action(req, res)).rejects.toThrow(
        `Failed to revoke session key`
      )
    })
  })
})
