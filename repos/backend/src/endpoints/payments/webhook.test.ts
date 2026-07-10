import type { Response } from 'express'
import type { TApp, TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { webhook } from './webhook'
import { config } from '@TBE/configs/backend.config'
import { PaymentsService } from '@TBE/services/payments/payments'

vi.mock('@TBE/services/payments/payments', () => ({
  PaymentsService: vi.fn().mockImplementation(() => ({
    service: {
      constructWebhookEvent: vi.fn(),
      webhook: vi.fn().mockResolvedValue(undefined),
    },
  })),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe(`POST /payments/webhooks - Stripe webhook handler`, () => {
  let mockReq: Partial<TRequest>
  let mockRes: Partial<Response>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockPayments: PaymentsService

  const mockEvent = { id: `evt_123`, type: `customer.subscription.updated` }

  beforeEach(() => {
    mockJson = vi.fn()
    mockStatus = vi.fn(() => mockRes as Response) as any

    mockRes = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>

    mockPayments = new PaymentsService(config.payments)

    mockReq = {
      app: {
        locals: {
          config,
          payments: mockPayments,
        },
      } as unknown as TApp,
      headers: {},
      body: {},
    }

    vi.clearAllMocks()
  })

  it(`should return 400 if stripe-signature header is missing`, async () => {
    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalledWith({ error: `Missing stripe-signature header` })
    expect(mockPayments.service.constructWebhookEvent).not.toHaveBeenCalled()
  })

  it(`should return 400 with the error message when signature verification throws an Error`, async () => {
    mockReq.headers = { 'stripe-signature': `sig_valid` }
    ;(
      mockPayments.service.constructWebhookEvent as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw new Error(`Invalid signature`)
    })

    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalledWith({ error: `Invalid signature` })
    expect(mockPayments.service.webhook).not.toHaveBeenCalled()
  })

  it(`should return 400 with a generic message when signature verification throws a non-Error`, async () => {
    mockReq.headers = { 'stripe-signature': `sig_valid` }
    ;(
      mockPayments.service.constructWebhookEvent as ReturnType<typeof vi.fn>
    ).mockImplementation(() => {
      throw `not an Error instance`
    })

    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(400)
    expect(mockJson).toHaveBeenCalledWith({
      error: `Webhook signature verification failed`,
    })
  })

  it(`should use req.rawBody for signature verification when present`, async () => {
    const rawBody = Buffer.from(`{"id":"evt_123"}`)
    mockReq.headers = { 'stripe-signature': `sig_valid` }
    ;(mockReq as any).rawBody = rawBody
    mockReq.body = { id: `evt_123` }
    ;(
      mockPayments.service.constructWebhookEvent as ReturnType<typeof vi.fn>
    ).mockReturnValue(mockEvent)

    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockPayments.service.constructWebhookEvent).toHaveBeenCalledWith(
      rawBody,
      `sig_valid`
    )
  })

  it(`should fall back to req.body when rawBody is not set`, async () => {
    mockReq.headers = { 'stripe-signature': `sig_valid` }
    mockReq.body = { id: `evt_123` }
    ;(
      mockPayments.service.constructWebhookEvent as ReturnType<typeof vi.fn>
    ).mockReturnValue(mockEvent)

    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockPayments.service.constructWebhookEvent).toHaveBeenCalledWith(
      mockReq.body,
      `sig_valid`
    )
  })

  it(`should return 200 with received:true on successful processing`, async () => {
    mockReq.headers = { 'stripe-signature': `sig_valid` }
    ;(
      mockPayments.service.constructWebhookEvent as ReturnType<typeof vi.fn>
    ).mockReturnValue(mockEvent)

    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockPayments.service.webhook).toHaveBeenCalledWith(mockReq.app, mockEvent)
    expect(mockStatus).toHaveBeenCalledWith(200)
    expect(mockJson).toHaveBeenCalledWith({ received: true })
  })

  it(`should return 500 with the error message when webhook processing throws an Error`, async () => {
    mockReq.headers = { 'stripe-signature': `sig_valid` }
    ;(
      mockPayments.service.constructWebhookEvent as ReturnType<typeof vi.fn>
    ).mockReturnValue(mockEvent)
    ;(mockPayments.service.webhook as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error(`Processing failed`)
    )

    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(500)
    expect(mockJson).toHaveBeenCalledWith({ error: `Processing failed` })
  })

  it(`should return 500 with a generic message when webhook processing throws a non-Error`, async () => {
    mockReq.headers = { 'stripe-signature': `sig_valid` }
    ;(
      mockPayments.service.constructWebhookEvent as ReturnType<typeof vi.fn>
    ).mockReturnValue(mockEvent)
    ;(mockPayments.service.webhook as ReturnType<typeof vi.fn>).mockRejectedValue(
      `not an Error instance`
    )

    await webhook.action(mockReq as TRequest, mockRes as Response)

    expect(mockStatus).toHaveBeenCalledWith(500)
    expect(mockJson).toHaveBeenCalledWith({ error: `Webhook processing failed` })
  })

  it(`should have correct endpoint configuration`, () => {
    expect(webhook.path).toBe(`/webhooks`)
    expect(webhook.method).toBe(`post`)
  })
})
