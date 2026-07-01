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
      createCustomer: vi.fn().mockResolvedValue({ data: null }),
      createCheckoutSession: vi.fn().mockResolvedValue({ data: null }),
      createPortalSession: vi.fn().mockResolvedValue({ data: null }),
      cancelSubscription: vi.fn().mockResolvedValue(undefined),
      updateSubscription: vi.fn().mockResolvedValue(undefined),
      updateSeatQuantity: vi.fn().mockResolvedValue(undefined),
      getInvoices: vi.fn().mockResolvedValue([]),
      constructWebhookEvent: vi.fn(),
      webhook: vi.fn().mockResolvedValue(undefined),
      config: {
        priceIds: { solo: `price_solo`, pro: `price_pro`, team: `price_team` },
        seatPriceIds: { pro: `seat_pro`, team: `seat_team` },
      },
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
            findByUser: vi.fn().mockResolvedValue({ data: null }),
            upsertByUser: vi.fn().mockResolvedValue({ data: null }),
          },
          invoice: {
            findByUserId: vi.fn(),
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
      headers: {},
      get: vi.fn(() => undefined),
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
      expect(subscriptions.endpoints?.updateSubscription).toBeDefined()
      expect(subscriptions.endpoints?.getInvoices).toBeDefined()
    })
  })

  describe('GET /_/subscriptions/current - Get current subscription', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.getCurrentSubscription)

    it('should return 200 with subscription data when subscription exists', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        tier: 'solo',
        status: 'active',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Authentication required'
      )
    })

    it('should return 500 with error message on database failure', async () => {
      const mockError = new Error('Database connection failed')

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Database connection failed'
      )
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/current')
      expect(ep.method).toBe('get')
    })
  })

  describe('GET /_/subscriptions/plans - Get available plans', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.getPlans)

    it('should return 200 with plans data on success', async () => {
      await ep.action(mockReq as TRequest, mockRes as Response)

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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Missing required fields: tier, successUrl, cancelUrl'
      )
    })

    it('should return 400 when successUrl is missing', async () => {
      mockReq.body = {
        tier: 'solo',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Missing required fields: tier, successUrl, cancelUrl'
      )
    })

    it('should return 400 when cancelUrl is missing', async () => {
      mockReq.body = {
        tier: 'solo',
        successUrl: 'http://localhost:3000/billing?success=true',
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Missing required fields: tier, successUrl, cancelUrl'
      )
    })

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined
      mockReq.body = {
        tier: 'solo',
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Authentication required'
      )
    })

    it('should return 400 for invalid tier', async () => {
      mockReq.body = {
        tier: 'invalid_tier',
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Invalid tier: invalid_tier'
      )
    })

    it('should return 400 for free tier checkout', async () => {
      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: null })

      mockReq.body = {
        tier: 'free',
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Cannot checkout for free tier'
      )
    })

    it('should call checkout flow with valid data for new subscription', async () => {
      mockReq.body = {
        tier: 'solo',
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: null })

      const paymentsService = mockReq.app?.locals.payments.service as any
      paymentsService.createCustomer.mockResolvedValue({
        data: { id: 'cus_123' },
      })
      paymentsService.createCheckoutSession.mockResolvedValue({
        data: {
          id: 'cs_123',
          url: 'https://checkout.stripe.com/session_123',
          customer_id: 'cus_123',
        },
      })

      const mockUpsert = mockReq.app?.locals.db.services.subscription
        .upsertByUser as ReturnType<typeof vi.fn>
      mockUpsert.mockResolvedValue({ data: {} })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalled()
    })

    it('should update subscription when user already has active subscription', async () => {
      mockReq.body = {
        tier: 'pro',
        successUrl: 'http://localhost:3000/billing?success=true',
        cancelUrl: 'http://localhost:3000/billing?cancelled=true',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({
        data: {
          stripeSubscriptionId: 'sub_existing',
          stripeCustomerId: 'cus_existing',
          status: 'active',
          tier: 'solo',
        },
      })

      const paymentsService = mockReq.app?.locals.payments.service as any

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(paymentsService.updateSubscription).toHaveBeenCalledWith(
        'sub_existing',
        'price_pro'
      )
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: { updated: true, message: 'Subscription updated to pro' },
      })
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'No active subscription found'
      )
    })

    it('should return 404 when subscription has no customer ID', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: null,
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'No active subscription found'
      )
    })

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Authentication required'
      )
    })

    it('should return 500 when database query fails', async () => {
      const mockError = new Error('Database query failed')

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Database query failed'
      )
    })

    it('should call portal creation with valid subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      const paymentsService = mockReq.app?.locals.payments.service as any
      paymentsService.createPortalSession.mockResolvedValue({
        data: { url: 'https://billing.stripe.com/session_123' },
      })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByUser).toHaveBeenCalledWith('user_123')
      expect(mockStatus).toHaveBeenCalledWith(200)
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

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'No active subscription found'
      )
    })

    it('should return 404 when subscription has no stripe subscription ID', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        stripeSubscriptionId: null,
        stripeCustomerId: 'cus_stripe_123',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'No active subscription found'
      )
    })

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Authentication required'
      )
    })

    it('should return 500 when database query fails', async () => {
      const mockError = new Error('Database query failed')

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ error: mockError })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Database query failed'
      )
    })

    it('should call cancellation with valid subscription', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByUser).toHaveBeenCalledWith('user_123')
      expect(mockStatus).toHaveBeenCalled()
      expect(mockJson).toHaveBeenCalled()
    })

    it('should return response with { data: { success: true, message } } shape', async () => {
      const mockSubscription = {
        id: 'sub_123',
        userId: 'user_123',
        stripeSubscriptionId: 'sub_stripe_123',
        stripeCustomerId: 'cus_stripe_123',
      }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: mockSubscription })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          success: true,
          message: `Subscription cancelled successfully`,
        },
      })
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/current')
      expect(ep.method).toBe('delete')
    })
  })

  describe('POST /_/subscriptions/update - Update subscription tier', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.updateSubscription)

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined
      mockReq.body = { tier: 'pro' }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Authentication required'
      )
    })

    it('should return 400 when tier is missing', async () => {
      mockReq.body = {}

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Missing required field: tier'
      )
    })

    it('should return 400 for invalid tier', async () => {
      mockReq.body = { tier: 'invalid' }

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Invalid tier: invalid'
      )
    })

    it('should return 404 when no active subscription found', async () => {
      mockReq.body = { tier: 'pro' }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({ data: null })

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'No active subscription found'
      )
    })

    it('should update subscription to new tier', async () => {
      mockReq.body = { tier: 'pro' }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({
        data: { stripeSubscriptionId: 'sub_123', tier: 'solo' },
      })

      const paymentsService = mockReq.app?.locals.payments.service as any

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(paymentsService.updateSubscription).toHaveBeenCalledWith(
        'sub_123',
        'price_pro'
      )
      expect(mockStatus).toHaveBeenCalledWith(200)
    })

    it('should cancel at period end when downgrading to free', async () => {
      mockReq.body = { tier: 'free' }

      const mockFindByUser = mockReq.app?.locals.db.services.subscription
        .findByUser as ReturnType<typeof vi.fn>
      mockFindByUser.mockResolvedValue({
        data: { stripeSubscriptionId: 'sub_downgrade_free', tier: 'pro' },
      })
      const mockUpsertByUser = mockReq.app?.locals.db.services.subscription
        .upsertByUser as ReturnType<typeof vi.fn>
      mockUpsertByUser.mockResolvedValue({ data: null })

      const paymentsService = mockReq.app?.locals.payments.service as any

      await ep.action(mockReq as TRequest, mockRes as Response)

      // Downgrading to free cancels the Stripe subscription at period end and
      // must NOT resolve a price ID / call updateSubscription.
      expect(paymentsService.cancelSubscription).toHaveBeenCalledWith(
        'sub_downgrade_free'
      )
      expect(mockUpsertByUser).toHaveBeenCalledWith({
        userId: 'user_123',
        cancelAtPeriodEnd: true,
      })
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({
        data: {
          success: true,
          message: 'Subscription will be cancelled at period end',
        },
      })
    })

    it('should reject API key authentication with 403', async () => {
      mockReq.body = { tier: 'pro' }
      // `fromAuthHeaders` reads via `req.header(key)`; the proxy sets
      // `X-User-Api-Key-Id` for API-key auth. Simulate that here.
      mockReq.header = vi.fn((h: string) =>
        h === 'X-User-Api-Key-Id' ? 'key_123' : undefined
      ) as any

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Subscription endpoints do not accept API key authentication'
      )
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/update')
      expect(ep.method).toBe('post')
    })
  })

  describe('GET /_/subscriptions/invoices - Get invoices', () => {
    const ep = getEndpointCfg(subscriptions.endpoints?.getInvoices)

    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined

      await expect(ep.action(mockReq as TRequest, mockRes as Response)).rejects.toThrow(
        'Authentication required'
      )
    })

    it('should return invoices for user', async () => {
      const mockInvoices = [
        { id: 'inv_1', amount: 1000, status: 'paid' },
        { id: 'inv_2', amount: 2000, status: 'paid' },
      ]

      const mockFindByUserId = mockReq.app?.locals.db.services.invoice
        .findByUserId as ReturnType<typeof vi.fn>
      mockFindByUserId.mockResolvedValue({ data: mockInvoices })

      await ep.action(mockReq as TRequest, mockRes as Response)

      expect(mockFindByUserId).toHaveBeenCalledWith('user_123')
      expect(mockStatus).toHaveBeenCalledWith(200)
      expect(mockJson).toHaveBeenCalledWith({ data: mockInvoices })
    })

    it('should have correct endpoint configuration', () => {
      expect(ep.path).toBe('/invoices')
      expect(ep.method).toBe('get')
    })
  })
})
