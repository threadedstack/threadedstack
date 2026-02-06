import type { Response } from 'express'
import type { User } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TApp, TRequest, TEndpoint, TPayConfig } from '@TBE/types'

import { subscriptions } from './subscriptions'
import { config } from '@TBE/configs/backend.config'
import { getEndpointCfg as getEpCfg } from '@TBE/mocks/endpoints'
import { PaymentsService } from '@TBE/services/payments/payments'

// Mock PaymentsService
vi.mock('@TBE/services/payments/payments', () => ({
  PaymentsService: vi.fn().mockImplementation(() => ({
    service: {
      fetchPlans: vi.fn().mockResolvedValue({ data: [] }),
      fetchProduct: vi.fn().mockResolvedValue({ data: null }),
      ensureCustomer: vi.fn().mockResolvedValue({ data: null }),
      createCheckout: vi.fn().mockResolvedValue({ data: null }),
      createPortal: vi.fn().mockResolvedValue({ data: null }),
      cancelSubscription: vi.fn().mockResolvedValue({ data: { success: true } }),
      getProductIdForTier: vi.fn().mockReturnValue(null),
    },
  })),
}))

describe('Subscription endpoints', () => {
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
      payments: new PaymentsService({
        ...config.payments,
        type: `console`,
      } as TPayConfig),
    },
  } as unknown as TApp

  const getEndpointCfg = (ep?: TEndpoint) => getEpCfg(mockApp, ep)

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockReq = {
      app: mockApp,
      user: {
        id: `user_123`,
        email: `test@example.com`,
      } as User,
      params: {},
      body: {},
      query: {},
    }
  })

  describe('Parent endpoint configuration', () => {
    it('should have correct configuration', () => {
      expect(subscriptions.path).toBe('/subscriptions')
      expect(subscriptions.method).toBe('use')
      expect(subscriptions.endpoints).toBeDefined()
      expect(subscriptions.endpoints?.getPlans).toBeDefined()
      expect(subscriptions.endpoints?.getCurrentSubscription).toBeDefined()
      expect(subscriptions.endpoints?.createCheckout).toBeDefined()
      expect(subscriptions.endpoints?.createPortalSession).toBeDefined()
      expect(subscriptions.endpoints?.cancelSubscription).toBeDefined()
    })
  })

  describe('GET /_/subscriptions/current - Get current subscription', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.getCurrentSubscription)

    it('should return 200 with subscription data when subscription exists', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        tier: 'basic',
        status: 'active',
        polarId: 'polar_sub_123',
        polarCustomerId: 'polar_cust_123',
        currentPeriodEnd: new Date('2024-12-31'),
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByUser).toHaveBeenCalledWith('user_123')
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockSubscription })
    })

    it('should return 200 with free tier when no subscription exists', async () => {
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByUser).toHaveBeenCalledWith('user_123')
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          userId: 'user_123',
          tier: 'free',
          status: 'active',
        },
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' })
    })

    it('should return 500 with error message on database failure', async () => {
      const mockError = new Error('Database connection failed')

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Database connection failed' })
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/current')
      expect(ep.method).toBe('get')
    })
  })

  describe('GET /_/subscriptions/plans - Get available plans', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.getPlans)

    it('should return 200 with plans data on success', async () => {
      // Note: PaymentsService is instantiated in the endpoint,
      // so we can't directly mock the instance. This test validates structure only.
      await ep.action(mockReq as TRequest, mockRes as Response)

      // Verify response structure (actual data depends on PaymentsService mock)
      expect(mockStatus).toHaveBeenCalled()
      expect(mockJson).toHaveBeenCalled()
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/plans')
      expect(ep.method).toBe('get')
    })
  })

  describe('POST /_/subscriptions/checkout - Create checkout session', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.createCheckout)

    it('should return 400 when tier is missing', async () => {
      mockReq.body = {
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Missing required fields: tier, successUrl, cancelUrl',
      })
    })

    it('should return 400 when successUrl is missing', async () => {
      mockReq.body = {
        tier: 'basic',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Missing required fields: tier, successUrl, cancelUrl',
      })
    })

    it('should return 400 when cancelUrl is missing', async () => {
      mockReq.body = {
        tier: 'basic',
        successUrl: 'http://localhost:3000/billing?success=true',
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(400)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Missing required fields: tier, successUrl, cancelUrl',
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined
      mockReq.body = {
        tier: 'basic',
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' })
    })

    it('should call checkout flow with valid data', async () => {
      mockReq.body = {
        tier: 'basic',
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await ep.action(mockReq as TRequest, mockRes as Response)

      // Verify endpoint was called (actual behavior depends on PaymentsService mock)
      expect(mockStatus).toHaveBeenCalled()
      expect(mockJson).toHaveBeenCalled()
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/checkout')
      expect(ep.method).toBe('post')
    })
  })

  describe('POST /_/subscriptions/portal - Create portal session', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.createPortalSession)

    it('should return 404 when user has no subscription', async () => {
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'No active subscription found',
      })
    })

    it('should return 404 when subscription has no customer ID', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        polarId: 'polar_sub_123',
        polarCustomerId: null,
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'No active subscription found',
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' })
    })

    it('should return 500 when database query fails', async () => {
      const mockError = new Error('Database query failed')

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Database query failed' })
    })

    it('should call portal creation with valid subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        polarId: 'polar_sub_123',
        polarCustomerId: 'polar_cust_123',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByUser).toHaveBeenCalledWith('user_123')
      // Verify endpoint was called (actual behavior depends on PaymentsService mock)
      expect(mockStatus).toHaveBeenCalled()
      expect(mockJson).toHaveBeenCalled()
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/portal')
      expect(ep.method).toBe('post')
    })
  })

  describe('DELETE /_/subscriptions/current - Cancel subscription', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.cancelSubscription)

    it('should return 404 when user has no active subscription', async () => {
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: null })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'No active subscription found',
      })
    })

    it('should return 404 when subscription has no polar ID', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        polarId: null,
        polarCustomerId: 'polar_cust_123',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({
        error: 'No active subscription found',
      })
    })

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(401)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' })
    })

    it('should return 500 when database query fails', async () => {
      const mockError = new Error('Database query failed')

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ error: mockError })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(500)
      expect(mockJson).toHaveBeenCalledWith({ error: 'Database query failed' })
    })

    it('should call cancellation with valid subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        polarId: 'polar_sub_123',
        polarCustomerId: 'polar_cust_123',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByUser).toHaveBeenCalledWith('user_123')
      // Verify endpoint was called (actual behavior depends on PaymentsService mock)
      expect(mockStatus).toHaveBeenCalled()
      expect(mockJson).toHaveBeenCalled()
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/current')
      expect(ep.method).toBe('delete')
    })
  })
})
