import type { Response } from 'express'
import type { TApp, TRequest, TEndpoint } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { quotas } from './quotas'
import { config } from '@TBE/configs/backend.config'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'

describe('Quota Endpoints', () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>

  // Mock payment service methods
  const mockGetProductIdForTier = vi.fn((tier: string) => {
    const tiers: Record<string, string> = {
      free: 'prod_free_123',
      basic: 'prod_basic_456',
      developer: 'prod_dev_789',
      pro: 'prod_pro_000',
    }
    return tiers[tier]
  })
  const mockGetPlanLimits = vi.fn()
  const mockFetchProduct = vi.fn()

  let mockApp = {
    locals: {
      db: {
        services: {
          quota: {
            findByOrgAndPeriod: vi.fn(),
          },
          role: {
            getOrgOwner: vi.fn(),
            isOrgMember: vi.fn(),
          },
          subscription: {
            findByUser: vi.fn(),
          },
        },
      },
      config: config,
      payments: {
        service: {
          getProductIdForTier: mockGetProductIdForTier,
          getPlanLimits: mockGetPlanLimits,
          fetchProduct: mockFetchProduct,
        },
      },
    },
  } as unknown as TApp

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(mockApp, ep)

  const mockUserId = 'user_123'
  const mockOrgId = 'org_123'

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

    // Reset payment service mocks to default behavior
    mockGetProductIdForTier.mockImplementation((tier: string) => {
      const tiers: Record<string, string> = {
        free: 'prod_free_123',
        basic: 'prod_basic_456',
        developer: 'prod_dev_789',
        pro: 'prod_pro_000',
      }
      return tiers[tier]
    })
    mockGetPlanLimits.mockResolvedValue({ data: null })
    mockFetchProduct.mockResolvedValue({ data: null })
  })

  describe('Parent endpoint configuration', () => {
    it('should have correct configuration', () => {
      expect(quotas.path).toBe('/quotas')
      expect(quotas.method).toBe('use')
      expect(quotas.endpoints).toBeDefined()
      expect(quotas.endpoints?.getOrgQuota).toBeDefined()
      expect(quotas.endpoints?.getOrgLimits).toBeDefined()
      expect(quotas.endpoints?.checkQuota).toBeDefined()
    })
  })

  describe('GET /_/quotas/:orgId - Get current quota usage', () => {
    const ep = getEndpointCfg(quotas.endpoints?.getOrgQuota)

    it('should return 200 with quota data when quota exists', async () => {
      const mockQuota = {
        orgId: mockOrgId,
        period: '2026-01',
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
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({ data: mockQuota })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockIsOrgMember).toHaveBeenCalledWith(mockUserId, mockOrgId)
      expect(mockFindByOrgAndPeriod).toHaveBeenCalled()
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockQuota })
    })

    it('should return zeros if no quota record exists', async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
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

    it('should return 401 if not authenticated', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' })
    })

    it('should return 403 if user not org member', async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: false })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'You are not a member of this organization'
      )
    })

    it('should return 500 on database error', async () => {
      const mockError = new Error('Database connection failed')
      mockReq.params = { orgId: mockOrgId }

      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Database connection failed' })
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/:orgId')
      expect(ep.method).toBe('get')
    })
  })

  describe('GET /_/quotas/:orgId/limits - Get plan limits', () => {
    const ep = getEndpointCfg(quotas.endpoints?.getOrgLimits)

    it('should return 200 with plan limits for org', async () => {
      const mockLimits = {
        price: 0,
        retention: 1,
        organizations: 1,
        projects: 5,
        members: 3,
        endpoints: 25,
        threads: 10,
        messages: 1000,
        functionCalls: 10000,
        runtime: 300,
        orgSecrets: 50,
        projectSecrets: 25,
      }

      const mockProduct = {
        id: 'prod_basic_123',
        name: 'Basic Plan',
      }

      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: { polarPriceId: 'price_basic_123' } })

      // Mock payment service methods
      mockFetchProduct.mockResolvedValue({ data: mockProduct })
      mockGetPlanLimits.mockResolvedValue({ data: mockLimits })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockIsOrgMember).toHaveBeenCalledWith(mockUserId, mockOrgId)
      expect(mockGetOrgOwner).toHaveBeenCalledWith(mockOrgId)
      expect(mockFindByUser).toHaveBeenCalledWith('owner_123')
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockLimits })
    })

    it('should return free tier limits if owner has no subscription', async () => {
      const mockFreeLimits = {
        price: 0,
        retention: 1,
        organizations: 1,
        projects: 1,
        members: 1,
        endpoints: 5,
        threads: 1,
        messages: 100,
        functionCalls: 1000,
        runtime: 5,
        orgSecrets: 10,
        projectSecrets: 5,
      }

      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: null }) // No subscription

      // Mock payment service methods
      mockGetProductIdForTier.mockReturnValue('prod_free_123')
      mockGetPlanLimits.mockResolvedValue({ data: mockFreeLimits })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockFreeLimits })
    })

    it('should return 401 if not authenticated', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' })
    })

    it('should return 403 if user not org member', async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: false })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'You are not a member of this organization'
      )
    })

    it('should return 500 if org owner not found', async () => {
      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Org owner not found' })
    })

    it('should return 500 on database error', async () => {
      const mockError = new Error('Database query failed')
      mockReq.params = { orgId: mockOrgId }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockGetOrgOwner.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Database query failed' })
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/:orgId/limits')
      expect(ep.method).toBe('get')
    })
  })

  describe('POST /_/quotas/:orgId/check - Check quota availability', () => {
    const ep = getEndpointCfg(quotas.endpoints?.checkQuota)

    it('should allow action within quota', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: 'projects',
        amount: 1,
      }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({
        data: { projects: 2 },
      })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: { polarPriceId: 'price_basic_123' } })

      // Mock payment service methods
      mockGetPlanLimits.mockResolvedValue({ data: { projects: 5 } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          allowed: true,
          current: 2,
          limit: 5,
          remaining: 3,
        },
      })
    })

    it('should deny action exceeding quota', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: 'projects',
        amount: 10,
      }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({
        data: { projects: 4 },
      })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: { polarPriceId: 'price_basic_123' } })

      // Mock payment service methods
      mockGetPlanLimits.mockResolvedValue({ data: { projects: 5 } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          allowed: false,
          current: 4,
          limit: 5,
          remaining: 1,
        },
      })
    })

    it('should default amount to 1 if not provided', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: 'projects',
      }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({
        data: { projects: 3 },
      })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: { polarPriceId: 'price_basic_123' } })

      // Mock payment service methods
      mockGetPlanLimits.mockResolvedValue({ data: { projects: 5 } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          allowed: true,
          current: 3,
          limit: 5,
          remaining: 2,
        },
      })
    })

    it('should return 400 if resource is missing', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { amount: 1 }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required field: resource' })
    })

    it('should return 401 if not authenticated', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: 'projects', amount: 1 }
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' })
    })

    it('should return 403 if user not org member', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: 'projects', amount: 1 }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: false })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'You are not a member of this organization'
      )
    })

    it('should return 400 for invalid resource', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = {
        resource: 'invalid_resource',
        amount: 1,
      }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({ data: {} })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: { polarPriceId: 'price_basic_123' } })

      // Mock payment service methods - no limit for invalid_resource
      mockGetPlanLimits.mockResolvedValue({ data: { projects: 5 } })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Invalid resource: invalid_resource',
      })
    })

    it('should return 500 if org owner not found', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: 'projects', amount: 1 }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({ data: { projects: 2 } })
      mockGetOrgOwner.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Org owner not found' })
    })

    it('should return 500 if product not configured', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: 'projects', amount: 1 }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({ data: { projects: 2 } })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: null }) // No subscription

      // Mock payment service method to return undefined
      mockGetProductIdForTier.mockReturnValue(undefined as any)

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Product not configured' })
    })

    it('should return 500 if failed to fetch limits', async () => {
      mockReq.params = { orgId: mockOrgId }
      mockReq.body = { resource: 'projects', amount: 1 }

      const mockIsOrgMember = mockReq.app?.locals.db.services.role
        .isOrgMember as ReturnType<typeof vi.fn>
      const mockFindByOrgAndPeriod = mockReq.app?.locals.db.services.quota
        .findByOrgAndPeriod as ReturnType<typeof vi.fn>
      const mockGetOrgOwner = mockReq.app?.locals.db.services.role
        .getOrgOwner as ReturnType<typeof vi.fn>
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>

      mockIsOrgMember.mockResolvedValue({ data: true })
      mockFindByOrgAndPeriod.mockResolvedValue({ data: { projects: 2 } })
      mockGetOrgOwner.mockResolvedValue({ data: { userId: 'owner_123' } })
      mockFindByUser.mockResolvedValue({ data: { polarPriceId: 'price_basic_123' } })

      // Mock payment service method to return error
      mockGetPlanLimits.mockResolvedValue({
        error: new Error('Failed to fetch plan limits'),
      })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Failed to fetch plan limits' })
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/:orgId/check')
      expect(ep.method).toBe('post')
    })
  })
})
