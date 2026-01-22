import type {
  TPayConfig,
  TPayProduct,
  TPayCustomer,
  TPayPortalSession,
  TPayCheckoutSession,
} from '@TBE/types'

import * as crypto from 'node:crypto'
import { PolarService } from './polar'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe(`PolarService`, () => {
  const mockConfig: TPayConfig = {
    token: `polar_test_token_123`,
    url: `https://api.polar.test`,
    wbhSecret: `whsec_test_secret_456`,
    plans: {
      pro: `prod_pro_000`,
      free: `prod_free_123`,
      basic: `prod_basic_456`,
      developer: `prod_dev_789`,
    },
  }

  let originalFetch: typeof global.fetch
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    originalFetch = global.fetch
    mockFetch = vi.fn()
    global.fetch = mockFetch as typeof global.fetch
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe(`Constructor`, () => {
    it(`should throw error if token is missing`, () => {
      const invalidConfig = { ...mockConfig, token: `` }
      expect(() => new PolarService(invalidConfig)).toThrow(
        `Payments access token is required`
      )
    })

    it(`should initialize with config`, () => {
      const service = new PolarService(mockConfig)
      expect(service).toBeDefined()
      expect(service.getProductIdForTier(`free`)).toBe(`prod_free_123`)
    })
  })

  describe(`fetchPlans`, () => {
    it(`should fetch all configured plans`, async () => {
      const mockProducts: TPayProduct[] = [
        {
          id: `prod_free_123`,
          name: `Free Plan`,
          metadata: {
            price: `0`,
            runtime: `5`,
            threads: `1`,
            members: `1`,
            messages: `100`,
            projects: `1`,
            endpoints: `5`,
            retention: `1`,
            org_secrets: `10`,
            organizations: `1`,
            function_calls: `1000`,
            project_secrets: `5`,
          },
        },
        {
          id: `prod_basic_456`,
          name: `Basic Plan`,
          metadata: {
            price: `10`,
            runtime: `30`,
            threads: `5`,
            members: `3`,
            messages: `1000`,
            projects: `5`,
            endpoints: `25`,
            retention: `6`,
            org_secrets: `50`,
            organizations: `1`,
            function_calls: `10000`,
            project_secrets: `25`,
          },
        },
        {
          id: `prod_dev_789`,
          name: `Developer Plan`,
          metadata: {
            price: `50`,
            runtime: `60`,
            threads: `20`,
            members: `10`,
            messages: `10000`,
            projects: `20`,
            endpoints: `100`,
            retention: `12`,
            org_secrets: `200`,
            organizations: `3`,
            function_calls: `100000`,
            project_secrets: `100`,
          },
        },
        {
          id: `prod_pro_000`,
          name: `Pro Plan`,
          metadata: {
            price: `200`,
            runtime: `300`,
            threads: `unlimited`,
            members: `unlimited`,
            messages: `unlimited`,
            projects: `unlimited`,
            endpoints: `unlimited`,
            retention: `24`,
            org_secrets: `unlimited`,
            organizations: `unlimited`,
            function_calls: `unlimited`,
            project_secrets: `unlimited`,
          },
        },
      ]

      // Note: Plan order matches config.plans object key order (pro, free, basic, developer)
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts[3] }) // pro
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts[0] }) // free
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts[1] }) // basic
        .mockResolvedValueOnce({ ok: true, json: async () => mockProducts[2] }) // developer

      const service = new PolarService(mockConfig)
      const { data, error } = await service.fetchPlans()

      expect(error).toBeUndefined()
      expect(data).toBeDefined()
      expect(data).toHaveLength(4)
      expect(data![0].name).toBe(`Pro Plan`)
      expect(data![0].metadata.runtime).toBe(300)
      expect(data![1].name).toBe(`Free Plan`)
      expect(data![1].metadata.projects).toBe(1)
      expect(data![1].metadata.price).toBe(0)
      expect(data![2].name).toBe(`Basic Plan`)
      expect(data![3].name).toBe(`Developer Plan`)
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it(`should handle empty product IDs`, async () => {
      const emptyConfig = { ...mockConfig, plans: {} }
      const service = new PolarService(emptyConfig)
      const { data, error } = await service.fetchPlans()

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`No product IDs configured in TDSK_PAY_PLANS`)
    })

    it(`should handle fetch errors for individual products`, async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: `prod_free_123`, name: `Free`, metadata: {} }),
        })
        .mockResolvedValueOnce({ ok: false, status: 404, text: async () => `Not found` })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: `prod_dev_789`, name: `Developer`, metadata: {} }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: `prod_pro_000`, name: `Pro`, metadata: {} }),
        })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.fetchPlans()

      expect(error).toBeUndefined()
      expect(data).toBeDefined()
      expect(data).toHaveLength(3) // Should skip the failed product
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it(`should return Plan objects with parsed metadata`, async () => {
      const mockProduct: TPayProduct = {
        id: `prod_basic_456`,
        name: `Basic Plan`,
        metadata: {
          price: `10`,
          runtime: `30`,
          threads: `5`,
          members: `3`,
          messages: `1000`,
          projects: `5`,
          endpoints: `25`,
          retention: `6`,
          org_secrets: `50`,
          organizations: `1`,
          function_calls: `10000`,
          project_secrets: `25`,
        },
      }

      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockProduct })

      const service = new PolarService({
        ...mockConfig,
        plans: { basic: `prod_basic_456` },
      })
      const { data } = await service.fetchPlans()

      expect(data).toBeDefined()
      expect(data![0].metadata.projects).toBe(5)
      expect(data![0].metadata.endpoints).toBe(25)
      expect(typeof data![0].metadata.projects).toBe(`number`)
    })

    it(`should return empty array when all fetches fail`, async () => {
      // Mock all product fetches to fail
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => `Server error`,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => `Server error`,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => `Server error`,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => `Server error`,
        })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.fetchPlans()

      expect(error).toBeUndefined()
      expect(data).toEqual([]) // All fetches failed, so empty array is returned
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })
  })

  describe(`fetchProduct`, () => {
    it(`should fetch product by ID`, async () => {
      const mockProduct: TPayProduct = {
        id: `prod_test_123`,
        name: `Test Product`,
        metadata: {
          price: `25`,
          runtime: `60`,
          threads: `10`,
          members: `5`,
          messages: `5000`,
          projects: `10`,
          endpoints: `50`,
          retention: `12`,
          org_secrets: `100`,
          organizations: `2`,
          function_calls: `50000`,
          project_secrets: `50`,
        },
      }

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockProduct })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.fetchProduct(`prod_test_123`)

      expect(error).toBeUndefined()
      expect(data).toEqual(mockProduct)
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.polar.test/products/prod_test_123`,
        {
          method: `GET`,
          headers: {
            Authorization: `Bearer polar_test_token_123`,
            [`Content-Type`]: `application/json`,
          },
        }
      )
    })

    it(`should handle API errors with status code`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: `Not Found`,
        text: async () => `Product not found`,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.fetchProduct(`prod_nonexistent`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Status: 404 - Product not found`)
    })

    it(`should handle network errors`, async () => {
      mockFetch.mockRejectedValue(new Error(`Connection timeout`))

      const service = new PolarService(mockConfig)
      const { data, error } = await service.fetchProduct(`prod_test_123`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Connection timeout`)
    })

    it(`should return TPayProduct structure`, async () => {
      const mockProduct: TPayProduct = {
        id: `prod_test`,
        name: `Test`,
        metadata: {
          price: `0`,
          runtime: `5`,
          threads: `1`,
          members: `1`,
          messages: `100`,
          projects: `1`,
          endpoints: `5`,
          retention: `1`,
          org_secrets: `10`,
          organizations: `1`,
          function_calls: `1000`,
          project_secrets: `5`,
        },
      }

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockProduct })

      const service = new PolarService(mockConfig)
      const { data } = await service.fetchProduct(`prod_test`)

      expect(data).toHaveProperty(`id`)
      expect(data).toHaveProperty(`name`)
      expect(data).toHaveProperty(`metadata`)
      expect(data?.metadata).toHaveProperty(`projects`)
    })
  })

  describe(`getPlanLimits`, () => {
    it(`should return TPayPlanMeta structure`, async () => {
      const mockProduct: TPayProduct = {
        id: `prod_test`,
        name: `Test Plan`,
        metadata: {
          price: `25`,
          runtime: `60`,
          threads: `10`,
          members: `5`,
          messages: `5000`,
          projects: `10`,
          endpoints: `50`,
          retention: `12`,
          org_secrets: `100`,
          organizations: `2`,
          function_calls: `50000`,
          project_secrets: `50`,
        },
      }

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockProduct })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.getPlanLimits(`prod_test`)

      expect(error).toBeUndefined()
      expect(data).toBeDefined()
      expect(data?.projects).toBe(10)
      expect(data?.endpoints).toBe(50)
      expect(typeof data?.projects).toBe(`number`)
    })

    it(`should parse raw metadata correctly`, async () => {
      const mockProduct: TPayProduct = {
        id: `prod_test`,
        name: `Test`,
        metadata: {
          price: `10`,
          runtime: `30`,
          threads: `5`,
          members: `3`,
          messages: `1000`,
          projects: `5`,
          endpoints: `25`,
          retention: `6`,
          org_secrets: `50`,
          organizations: `1`,
          function_calls: `10000`,
          project_secrets: `100`,
        },
      }

      mockFetch.mockResolvedValue({ ok: true, json: async () => mockProduct })

      const service = new PolarService(mockConfig)
      const { data } = await service.getPlanLimits(`prod_test`)

      expect(data?.projects).toBe(5)
      expect(data?.runtime).toBe(30)
      expect(data?.functionCalls).toBe(10000) // camelCase conversion
    })

    it(`should handle missing metadata`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => `Not found`,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.getPlanLimits(`prod_missing`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
    })

    it(`should return error if product not found`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => `Not found`,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.getPlanLimits(`prod_nonexistent`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toContain(`404`)
    })
  })

  describe(`ensureCustomer`, () => {
    it(`should create new customer if not exists`, async () => {
      const mockCustomer: TPayCustomer = {
        id: `cus_new_123`,
        email: `new@example.com`,
        metadata: { userId: `user_123` },
      }

      // First call returns empty array (no existing customer)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      // Second call creates customer
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomer,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.ensureCustomer(`new@example.com`, `user_123`)

      expect(error).toBeUndefined()
      expect(data).toEqual(mockCustomer)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(2, `https://api.polar.test/customers`, {
        method: `POST`,
        headers: {
          Authorization: `Bearer polar_test_token_123`,
          [`Content-Type`]: `application/json`,
        },
        body: JSON.stringify({
          email: `new@example.com`,
          metadata: { userId: `user_123` },
        }),
      })
    })

    it(`should return existing customer`, async () => {
      const existingCustomer: TPayCustomer = {
        id: `cus_existing_456`,
        email: `existing@example.com`,
        metadata: { userId: `user_456` },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: [existingCustomer] }),
        text: async () => JSON.stringify({ data: [existingCustomer] }),
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.ensureCustomer(
        `existing@example.com`,
        `user_456`
      )

      expect(error).toBeUndefined()
      expect(data).toEqual(existingCustomer)
      expect(mockFetch).toHaveBeenCalledTimes(1) // Only find call, no create
    })

    it(`should handle API errors on find`, async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: `Internal Server Error`,
        text: async () => `Server error`,
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: `cus_123`, email: `test@example.com` }),
        text: async () => JSON.stringify({ id: `cus_123`, email: `test@example.com` }),
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.ensureCustomer(`test@example.com`, `user_123`)

      // New api.ts behavior: returns error for failed find call
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Status: 500 - Server error`)
    })

    it(`should handle API errors on create`, async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
        text: async () => JSON.stringify({ data: [] }),
      })

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: `Bad Request`,
        text: async () => `Invalid email`,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.ensureCustomer(`invalid`, `user_123`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Status: 400 - Invalid email`)
    })

    it(`should handle network errors`, async () => {
      mockFetch.mockRejectedValue(new Error(`Network timeout`))

      const service = new PolarService(mockConfig)
      const { data, error } = await service.ensureCustomer(`test@example.com`, `user_123`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Network timeout`)
    })
  })

  describe(`createCheckout`, () => {
    it(`should create checkout session with correct params`, async () => {
      const mockSession: TPayCheckoutSession = {
        id: `cs_test_123`,
        url: `https://polar.test/checkout/cs_test_123`,
        customer_id: `cus_123`,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSession,
        text: async () => JSON.stringify(mockSession),
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.createCheckout(
        `price_123`,
        `cus_123`,
        `user_123`,
        `https://app.test/success`,
        `https://app.test/cancel`
      )

      expect(error).toBeUndefined()
      expect(data).toEqual(mockSession)
      expect(mockFetch).toHaveBeenCalledWith(`https://api.polar.test/checkout/sessions`, {
        method: `POST`,
        headers: {
          Authorization: `Bearer polar_test_token_123`,
          [`Content-Type`]: `application/json`,
        },
        body: expect.stringContaining(`"price_id":"price_123"`),
      })
      // Check all expected fields are present in body
      const callArg = (mockFetch as any).mock.calls[0][1].body
      const bodyObj = JSON.parse(callArg)
      expect(bodyObj).toEqual({
        price_id: `price_123`,
        customer_id: `cus_123`,
        success_url: `https://app.test/success`,
        cancel_url: `https://app.test/cancel`,
        metadata: { userId: `user_123` },
      })
    })

    it(`should return session with URL`, async () => {
      const mockSession: TPayCheckoutSession = {
        id: `cs_456`,
        url: `https://polar.test/checkout/cs_456`,
        customer_id: `cus_456`,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSession,
      })

      const service = new PolarService(mockConfig)
      const { data } = await service.createCheckout(
        `price_456`,
        `cus_456`,
        `user_456`,
        `https://success.test`,
        `https://cancel.test`
      )

      expect(data).toHaveProperty(`url`)
      expect(data?.url).toBe(`https://polar.test/checkout/cs_456`)
    })

    it(`should handle API errors`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => `Invalid price ID`,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.createCheckout(
        `invalid_price`,
        `cus_123`,
        `user_123`,
        `https://success.test`,
        `https://cancel.test`
      )

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Status: 400 - Invalid price ID`)
    })

    it(`should handle network errors`, async () => {
      mockFetch.mockRejectedValue(new Error(`Connection failed`))

      const service = new PolarService(mockConfig)
      const { data, error } = await service.createCheckout(
        `price_123`,
        `cus_123`,
        `user_123`,
        `https://success.test`,
        `https://cancel.test`
      )

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Connection failed`)
    })
  })

  describe(`createPortal`, () => {
    it(`should create portal session`, async () => {
      const mockPortalSession: TPayPortalSession = {
        url: `https://polar.test/portal/session_123`,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPortalSession,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.createPortal(`cus_123`)

      expect(error).toBeUndefined()
      expect(data).toEqual(mockPortalSession)
      expect(mockFetch).toHaveBeenCalledWith(`https://api.polar.test/portal/sessions`, {
        method: `POST`,
        headers: {
          Authorization: `Bearer polar_test_token_123`,
          [`Content-Type`]: `application/json`,
        },
        body: JSON.stringify({ customer_id: `cus_123` }),
      })
    })

    it(`should return URL`, async () => {
      const mockPortalSession: TPayPortalSession = {
        url: `https://polar.test/portal/session_456`,
      }

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPortalSession,
      })

      const service = new PolarService(mockConfig)
      const { data } = await service.createPortal(`cus_456`)

      expect(data).toHaveProperty(`url`)
      expect(data?.url).toBe(`https://polar.test/portal/session_456`)
    })

    it(`should handle API errors`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => `Customer not found`,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.createPortal(`cus_nonexistent`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Status: 404 - Customer not found`)
    })

    it(`should handle network errors`, async () => {
      mockFetch.mockRejectedValue(new Error(`Network error`))

      const service = new PolarService(mockConfig)
      const { data, error } = await service.createPortal(`cus_123`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Network error`)
    })
  })

  describe(`cancelSubscription`, () => {
    it(`should cancel subscription by ID`, async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
        text: async () => '',
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.cancelSubscription(`sub_123`)

      expect(error).toBeUndefined()
      expect(data).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.polar.test/subscriptions/sub_123/cancel`,
        {
          method: `POST`,
          headers: {
            Authorization: `Bearer polar_test_token_123`,
            [`Content-Type`]: `application/json`,
          },
        }
      )
    })

    it(`should handle API errors`, async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => `Subscription not found`,
      })

      const service = new PolarService(mockConfig)
      const { data, error } = await service.cancelSubscription(`sub_nonexistent`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Status: 404 - Subscription not found`)
    })

    it(`should handle network errors`, async () => {
      mockFetch.mockRejectedValue(new Error(`Timeout`))

      const service = new PolarService(mockConfig)
      const { data, error } = await service.cancelSubscription(`sub_123`)

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error?.message).toBe(`Timeout`)
    })
  })

  describe(`validateWebhook`, () => {
    it(`should validate correct HMAC-SHA256 signature`, () => {
      const payload = `{"event": "subscription.created", "data": {}}`
      const timestamp = `1234567890`
      const signedPayload = `${timestamp}.${payload}`
      const expectedSignature = crypto
        .createHmac(`sha256`, mockConfig.wbhSecret)
        .update(signedPayload)
        .digest(`hex`)

      const service = new PolarService(mockConfig)
      const isValid = service.validateWebhook(payload, expectedSignature, timestamp)

      expect(isValid).toBe(true)
    })

    it(`should reject invalid signature`, () => {
      const payload = `{"event": "subscription.created"}`
      const timestamp = `1234567890`
      const invalidSignature = `invalid_signature_abc123`

      const service = new PolarService(mockConfig)
      const isValid = service.validateWebhook(payload, invalidSignature, timestamp)

      expect(isValid).toBe(false)
    })

    it(`should reject tampered payload`, () => {
      const originalPayload = `{"event": "subscription.created", "amount": 1000}`
      const tamperedPayload = `{"event": "subscription.created", "amount": 9999}`
      const timestamp = `1234567890`

      const signedPayload = `${timestamp}.${originalPayload}`
      const signature = crypto
        .createHmac(`sha256`, mockConfig.wbhSecret)
        .update(signedPayload)
        .digest(`hex`)

      const service = new PolarService(mockConfig)
      const isValid = service.validateWebhook(tamperedPayload, signature, timestamp)

      expect(isValid).toBe(false)
    })

    it(`should reject tampered timestamp`, () => {
      const payload = `{"event": "subscription.created"}`
      const originalTimestamp = `1234567890`
      const tamperedTimestamp = `9999999999`

      const signedPayload = `${originalTimestamp}.${payload}`
      const signature = crypto
        .createHmac(`sha256`, mockConfig.wbhSecret)
        .update(signedPayload)
        .digest(`hex`)

      const service = new PolarService(mockConfig)
      const isValid = service.validateWebhook(payload, signature, tamperedTimestamp)

      expect(isValid).toBe(false)
    })

    it(`should handle validation errors gracefully`, () => {
      const service = new PolarService(mockConfig)

      // Pass invalid data that might cause crypto errors
      const isValid = service.validateWebhook(null as any, undefined as any, `` as any)

      expect(isValid).toBe(false)
    })
  })

  describe(`Helper methods`, () => {
    describe(`getProductIdForTier`, () => {
      it(`should return correct product ID for tier`, () => {
        const service = new PolarService(mockConfig)

        expect(service.getProductIdForTier(`free`)).toBe(`prod_free_123`)
        expect(service.getProductIdForTier(`basic`)).toBe(`prod_basic_456`)
        expect(service.getProductIdForTier(`developer`)).toBe(`prod_dev_789`)
        expect(service.getProductIdForTier(`pro`)).toBe(`prod_pro_000`)
      })

      it(`should handle case-insensitive tier names`, () => {
        const service = new PolarService(mockConfig)

        expect(service.getProductIdForTier(`FREE`)).toBe(`prod_free_123`)
        expect(service.getProductIdForTier(`Basic`)).toBe(`prod_basic_456`)
        expect(service.getProductIdForTier(`DEVELOPER`)).toBe(`prod_dev_789`)
      })

      it(`should return undefined for unknown tier`, () => {
        const service = new PolarService(mockConfig)

        expect(service.getProductIdForTier(`nonexistent`)).toBeUndefined()
        expect(service.getProductIdForTier(`enterprise`)).toBeUndefined()
      })
    })

    describe(`getTierForProductId`, () => {
      it(`should return correct tier name for product ID`, () => {
        const service = new PolarService(mockConfig)

        expect(service.getTierForProductId(`prod_free_123`)).toBe(`free`)
        expect(service.getTierForProductId(`prod_basic_456`)).toBe(`basic`)
        expect(service.getTierForProductId(`prod_dev_789`)).toBe(`developer`)
        expect(service.getTierForProductId(`prod_pro_000`)).toBe(`pro`)
      })

      it(`should return undefined for unknown product ID`, () => {
        const service = new PolarService(mockConfig)

        expect(service.getTierForProductId(`prod_unknown_999`)).toBeUndefined()
        expect(service.getTierForProductId(`invalid`)).toBeUndefined()
      })

      it(`should handle empty product ID`, () => {
        const service = new PolarService(mockConfig)

        expect(service.getTierForProductId(``)).toBeUndefined()
      })
    })
  })
})
