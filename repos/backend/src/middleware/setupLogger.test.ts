import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { requestLogger } from './setupLogger'
import { logger } from '@TBE/utils/logger'

describe(`requestLogger middleware`, () => {
  let mockNext: ReturnType<typeof vi.fn>
  let finishHandlers: Array<() => void>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      method: `GET`,
      path: `/api/test`,
      query: {},
      ip: `127.0.0.1`,
      get: vi.fn().mockReturnValue(`test-agent`),
      headers: {},
      ...overrides,
    } as unknown as Request
  }

  const buildMockRes = () => {
    finishHandlers = []
    return {
      statusCode: 200,
      on: vi.fn((event: string, handler: () => void) => {
        if (event === `finish`) finishHandlers.push(handler)
      }),
    } as unknown as Response
  }

  beforeEach(() => {
    mockNext = vi.fn()
    finishHandlers = []
    vi.clearAllMocks()
  })

  it(`should use existing X-Request-Id header if present`, () => {
    const existingId = `req-abc-123`
    const req = buildMockReq({
      headers: { 'x-request-id': existingId },
    })
    const res = buildMockRes()

    requestLogger(req, res, mockNext as NextFunction)

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(`GET /api/test`),
      expect.objectContaining({ requestId: existingId })
    )
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should generate new UUID if no X-Request-Id header`, () => {
    const req = buildMockReq({ headers: {} })
    const res = buildMockRes()

    requestLogger(req, res, mockNext as NextFunction)

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(`GET /api/test`),
      expect.objectContaining({
        requestId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
        ),
      })
    )
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should include requestId in log metadata`, () => {
    const customId = `correlation-id-456`
    const req = buildMockReq({
      headers: { 'x-request-id': customId },
    })
    const res = buildMockRes()

    requestLogger(req, res, mockNext as NextFunction)

    const logCall = vi.mocked(logger.info).mock.calls[0]
    const metadata = logCall[1] as Record<string, unknown>
    expect(metadata.requestId).toBe(customId)
    expect(metadata.method).toBe(`GET`)
    expect(metadata.path).toBe(`/api/test`)
  })

  it(`should include requestId in response finish log`, () => {
    const requestId = `finish-log-id`
    const req = buildMockReq({
      headers: { 'x-request-id': requestId },
    })
    const res = buildMockRes()

    requestLogger(req, res, mockNext as NextFunction)

    // Trigger response finish
    expect(finishHandlers.length).toBe(1)
    finishHandlers[0]()

    // Second logger.info call is the response log
    const responseCalls = vi.mocked(logger.info).mock.calls
    expect(responseCalls.length).toBe(2)

    const responseMetadata = responseCalls[1][1] as Record<string, unknown>
    expect(responseMetadata.requestId).toBe(requestId)
    expect(responseMetadata.statusCode).toBe(200)
    expect(responseMetadata.duration).toBeGreaterThanOrEqual(0)
  })

  it(`should skip logging for OPTIONS requests`, () => {
    const req = buildMockReq({ method: `OPTIONS` })
    const res = buildMockRes()

    requestLogger(req, res, mockNext as NextFunction)

    expect(logger.info).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should skip logging for ignored routes`, () => {
    const req = buildMockReq({
      path: `/.well-known/appspecific/com.chrome.devtools.json`,
    })
    const res = buildMockRes()

    requestLogger(req, res, mockNext as NextFunction)

    expect(logger.info).not.toHaveBeenCalled()
    expect(mockNext).toHaveBeenCalled()
  })

  it(`should use warn level for 4xx responses`, () => {
    const req = buildMockReq({
      headers: { 'x-request-id': `warn-test` },
    })
    const res = buildMockRes()
    ;(res as any).statusCode = 404

    requestLogger(req, res, mockNext as NextFunction)
    finishHandlers[0]()

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`404`),
      expect.objectContaining({ requestId: `warn-test` })
    )
  })

  it(`should use error level for 5xx responses`, () => {
    const req = buildMockReq({
      headers: { 'x-request-id': `error-test` },
    })
    const res = buildMockRes()
    ;(res as any).statusCode = 500

    requestLogger(req, res, mockNext as NextFunction)
    finishHandlers[0]()

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`500`),
      expect.objectContaining({ requestId: `error-test` })
    )
  })
})
