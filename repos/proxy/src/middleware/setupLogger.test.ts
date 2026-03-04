import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requestLogger } from './setupLogger'
import { logger } from '@TPX/utils/logger'

vi.mock('@TPX/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const mockReq = (overrides: Partial<Request> = {}) =>
  ({
    method: 'GET',
    path: '/test',
    query: {},
    ip: '127.0.0.1',
    headers: {},
    get: vi.fn().mockReturnValue('test-agent'),
    ...overrides,
  }) as unknown as Request

const mockRes = () => {
  const listeners: Record<string, Function> = {}
  const res = {
    statusCode: 200,
    on: vi.fn((event: string, cb: Function) => {
      listeners[event] = cb
    }),
  } as unknown as Response
  return { res, listeners }
}

describe('requestLogger middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should skip OPTIONS requests and call next without logging', () => {
    const req = mockReq({ method: 'OPTIONS' })
    const { res } = mockRes()
    const next = vi.fn() as unknown as NextFunction

    requestLogger(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
    expect(res.on).not.toHaveBeenCalled()
  })

  it('should log the incoming request with method and path', () => {
    const req = mockReq({ method: 'POST', path: '/api/data' })
    const { res } = mockRes()
    const next = vi.fn() as unknown as NextFunction

    requestLogger(req, res, next)

    expect(logger.info).toHaveBeenCalledWith(
      '→ POST /api/data',
      expect.objectContaining({
        requestId: expect.any(String),
        method: 'POST',
        path: '/api/data',
      })
    )
    expect(next).toHaveBeenCalled()
  })

  it('should log response status and duration on finish event', () => {
    const req = mockReq({ method: 'GET', path: '/items' })
    const { res, listeners } = mockRes()
    const next = vi.fn() as unknown as NextFunction

    requestLogger(req, res, next)

    // Simulate the response finishing
    listeners['finish']()

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringMatching(/^← GET \/items 200 \d+ms$/),
      expect.objectContaining({
        requestId: expect.any(String),
        method: 'GET',
        path: '/items',
        statusCode: 200,
        duration: expect.any(Number),
      })
    )
  })

  it('should generate a valid UUID v4 format for requestId', () => {
    const req = mockReq()
    const { res } = mockRes()
    const next = vi.fn() as unknown as NextFunction

    requestLogger(req, res, next)

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const infoCall = vi.mocked(logger.info).mock.calls[0]
    const meta = infoCall[1] as Record<string, unknown>

    expect(meta.requestId).toMatch(uuidRegex)
  })

  describe('X-Request-Id header forwarding', () => {
    it('should forward generated request ID in req.headers[x-request-id]', () => {
      const req = mockReq({ headers: {} })
      const { res } = mockRes()
      const next = vi.fn() as unknown as NextFunction

      requestLogger(req, res, next)

      // After middleware runs, the request should have x-request-id set
      expect(req.headers['x-request-id']).toBeDefined()
      expect(typeof req.headers['x-request-id']).toBe('string')
      expect(req.headers['x-request-id']).not.toBe('')
    })

    it('should use existing X-Request-Id from incoming request if present', () => {
      const existingId = 'incoming-request-id-12345'
      const req = mockReq({ headers: { 'x-request-id': existingId } })
      const { res } = mockRes()
      const next = vi.fn() as unknown as NextFunction

      requestLogger(req, res, next)

      // Should preserve the existing request ID, not overwrite it
      expect(req.headers['x-request-id']).toBe(existingId)

      // The logged requestId should match the incoming one
      const infoCall = vi.mocked(logger.info).mock.calls[0]
      const meta = infoCall[1] as Record<string, unknown>
      expect(meta.requestId).toBe(existingId)
    })

    it('should generate new UUID when no X-Request-Id header exists', () => {
      const req = mockReq({ headers: {} })
      const { res } = mockRes()
      const next = vi.fn() as unknown as NextFunction

      requestLogger(req, res, next)

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(req.headers['x-request-id']).toMatch(uuidRegex)
    })

    it('should use the same requestId in both request and response logs', () => {
      const req = mockReq({ headers: {} })
      const { res, listeners } = mockRes()
      const next = vi.fn() as unknown as NextFunction

      requestLogger(req, res, next)
      listeners['finish']()

      const requestLog = vi.mocked(logger.info).mock.calls[0]
      const responseLog = vi.mocked(logger.info).mock.calls[1]
      const reqMeta = requestLog[1] as Record<string, unknown>
      const resMeta = responseLog[1] as Record<string, unknown>

      expect(reqMeta.requestId).toBe(resMeta.requestId)
      expect(req.headers['x-request-id']).toBe(reqMeta.requestId)
    })
  })
})
