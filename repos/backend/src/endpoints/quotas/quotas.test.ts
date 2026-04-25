import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { quotas } from './quotas'
import { config } from '@TBE/configs/backend.config'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

describe(`Quota Endpoints`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  let mockApp = {
    locals: {
      db: {
        services: {
          quota: {
            findByOrgAndPeriod: vi.fn(),
          },
          org: {
            get: vi.fn(),
          },
          role: {
            isOrgMember: vi.fn(),
          },
          subscription: {
            findByUser: vi.fn(),
          },
        },
      },
      config: config,
    },
  } as unknown as TApp

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(mockApp, ep)

  const mockUserId = `user_123`
  const mockOrgId = `org_123`

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: mockApp,
      params: {},
      body: {},
      user: {
        id: mockUserId,
      } as any,
    }

    vi.clearAllMocks()
  })

  describe(`Parent endpoint configuration`, () => {
    it(`should have correct configuration`, () => {
      expect(quotas.path).toBe(`/quotas`)
      expect(quotas.method).toBe(`use`)
      expect(quotas.endpoints).toBeDefined()
      expect(quotas.endpoints?.getOrgQuota).toBeDefined()
      expect(quotas.endpoints?.getOrgLimits).toBeDefined()
      expect(quotas.endpoints?.checkQuota).toBeDefined()
    })
  })

  describe(`GET /_/quotas/:orgId - Get current quota usage`, () => {
    const ep = getEndpointCfg(quotas.endpoints?.getOrgQuota)

    it(`should return 200 with quota data when quota exists`, async () => {
      const mockQuota = {
        orgId: mockOrgId,
        period: `2026-01`,
        price: 0,
        retention: 1,
        organizations: 1,
        projects: 3,
        members: 2,
        endpoints: 5,
        threads: 10,
        messages: 50,
        functionCalls: 500,
        runtime: 120,
        orgSecrets: 5,
        projectSecrets: 10,
      }

      mockReq.params = { orgId: mockOrgId }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>

      mockFindByOrgAndPeriod.mockResolvedValue({ data: mockQuota })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByOrgAndPeriod).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockQuota })
    })

    it(`should return zeros if no quota record exists`, async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>

      mockFindByOrgAndPeriod.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          orgId: mockOrgId,
          period: expect.stringMatching(/^\d{4}-\d{2}$/),
          price: 0,
          retention: 0,
          organizations: 0,
          projects: 0,
          members: 0,
          endpoints: 0,
          threads: 0,
          messages: 0,
          functionCalls: 0,
          runtime: 0,
          orgSecrets: 0,
          projectSecrets: 0,
        },
      })
    })

    it(`should return 401 if not authenticated`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.user = undefined

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should return 500 on database error`, async () => {
      const mockError = new Error(`Database connection failed`)
      mockReq.params = { orgId: mockOrgId }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>

      mockFindByOrgAndPeriod.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database connection failed`
      )
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/`)
      expect(ep.method).toBe(`get`)
    })
  })

  describe(`GET /_/quotas/:orgId/limits - Get plan limits`, () => {
    const ep = getEndpointCfg(quotas.endpoints?.getOrgLimits)

    it(`should return 200 with plan limits for org tier`, async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({
        data: { tier: `solo` },
      })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockGetOrg).toHaveBeenCalledWith(mockOrgId)
      expect(mockFindByUser).toHaveBeenCalledWith(`owner_123`)
      expect(mockStatus).toHaveBeenCalledWith(200)
      // Should return PlanLimits[solo]
      const jsonArg = mockJson.mock.calls[0][0]
      expect(jsonArg.data).toBeDefined()
      expect(jsonArg.data.projects).toBe(10) // solo = 10 projects
    })

    it(`should return free tier limits if owner has no subscription`, async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const jsonArg = mockJson.mock.calls[0][0]
      expect(jsonArg.data.projects).toBe(2) // free = 2 projects
    })

    it(`should return 401 if not authenticated`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.user = undefined

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should return 500 if org not found`, async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >

      mockGetOrg.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Organization not found`
      )
    })

    it(`should return 500 if org has no ownerId`, async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >

      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: null } })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Organization not found`
      )
    })

    it(`should return 500 on database error`, async () => {
      const mockError = new Error(`Database query failed`)
      mockReq.params = { orgId: mockOrgId }

      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >

      mockGetOrg.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Database query failed`
      )
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/limits`)
      expect(ep.method).toBe(`get`)
    })
  })

  describe(`POST /_/quotas/:orgId/check - Check quota availability`, () => {
    const ep = getEndpointCfg(quotas.endpoints?.checkQuota)

    it(`should allow action within quota`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: `projects`,
        amount: 1,
      }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByOrgAndPeriod.mockResolvedValue({
        data: { projects: 0 },
      })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({
        data: { tier: `free` },
      })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          allowed: true,
          current: 0,
          limit: 2,
          remaining: 2,
        },
      })
    })

    it(`should deny action exceeding quota`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: `projects`,
        amount: 1,
      }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByOrgAndPeriod.mockResolvedValue({
        data: { projects: 2 },
      })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({
        data: { tier: `free` },
      })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          allowed: false,
          current: 2,
          limit: 2,
          remaining: 0,
        },
      })
    })

    it(`should handle unlimited resources (limit = -1)`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: `projects`,
        amount: 1,
      }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByOrgAndPeriod.mockResolvedValue({
        data: { projects: 999 },
      })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({
        data: { tier: `team` },
      })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      const jsonArg = mockJson.mock.calls[0][0]
      expect(jsonArg.data.allowed).toBe(true)
      expect(jsonArg.data.limit).toBe(-1)
      expect(jsonArg.data.remaining).toBe(-1)
    })

    it(`should default amount to 1 if not provided`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: `projects`,
      }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByOrgAndPeriod.mockResolvedValue({
        data: { projects: 1 },
      })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({
        data: { tier: `free` },
      })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          allowed: true,
          current: 1,
          limit: 2,
          remaining: 1,
        },
      })
    })

    it(`should return 400 if resource is missing`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { amount: 1 }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Missing required field: resource`
      )
    })

    it(`should return 401 if not authenticated`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: `projects`, amount: 1 }
      mockReq.user = undefined

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Authentication required`
      )
    })

    it(`should return 400 for invalid resource`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: `invalid_resource`,
        amount: 1,
      }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByOrgAndPeriod.mockResolvedValue({ data: {} })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({
        data: { tier: `free` },
      })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Invalid resource: invalid_resource`
      )
    })

    it(`should return 500 if org not found`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: `projects`, amount: 1 }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >

      mockFindByOrgAndPeriod.mockResolvedValue({ data: { projects: 2 } })
      mockGetOrg.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Organization not found`
      )
    })

    it(`should return 500 on subscription lookup error`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: `projects`, amount: 1 }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrg = mockReq.app?.locals.db.services.org.get as ReturnType<
        typeof vi.fn
      >
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByOrgAndPeriod.mockResolvedValue({ data: { projects: 2 } })
      mockGetOrg.mockResolvedValue({ data: { id: mockOrgId, ownerId: `owner_123` } })
      mockFindByUser.mockResolvedValue({ error: new Error(`Subscription DB error`) })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Subscription DB error`
      )
    })

    it(`should return 400 when amount is negative (SEC-003 fix)`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: `projects`,
        amount: -5,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Amount must be a positive number`
      )
    })

    it(`should return 400 when amount is zero (SEC-003 fix)`, async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: `projects`,
        amount: 0,
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        `Amount must be a positive number`
      )
    })

    it(`should have correct endpoint configuration`, () => {
      expect(ep.path).toBe(`/check`)
      expect(ep.method).toBe(`post`)
    })
  })
})
