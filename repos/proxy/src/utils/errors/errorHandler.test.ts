import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { Exception } from './exception'

vi.mock('@TPX/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { logger } from '@TPX/utils/logger'
import { errorHandler } from './errorHandler'

describe('errorHandler', () => {
  let mockReq: Request
  let mockRes: Response
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    mockReq = { method: 'GET', path: '/test' } as Request
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response
    mockNext = vi.fn() as unknown as NextFunction
  })

  it('should return custom Exception status, message, and errorCode', () => {
    const error = new Exception(404, 'Not found', 'NOT_FOUND')

    errorHandler(error, mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(404)
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 404,
      message: 'Not found',
      errorCode: 'NOT_FOUND',
    })
  })

  it('should return 500 for non-Exception errors', () => {
    const error = new Error('something') as Exception

    errorHandler(error, mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 500,
      message: 'something',
      errorCode: undefined,
    })
  })

  it('should return default message when error has no message', () => {
    const error = new Error() as Exception

    errorHandler(error, mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({
      status: 500,
      message: 'Something went wrong',
      errorCode: undefined,
    })
  })

  it('should log the error via logger.error before responding', () => {
    const error = new Exception(403, 'Forbidden', 'FORBIDDEN')

    errorHandler(error, mockReq, mockRes, mockNext)

    expect(logger.error).toHaveBeenCalledWith('GET /test → 403: Forbidden', {
      errorCode: 'FORBIDDEN',
      stack: error.stack,
    })
    expect(logger.error).toHaveBeenCalledTimes(1)
  })

  it('should include errorCode in the response body', () => {
    const error = new Exception(422, 'Validation failed', 'VALIDATION_ERROR')

    errorHandler(error, mockReq, mockRes, mockNext)

    const jsonCall = vi.mocked(mockRes.json).mock.calls[0][0]
    expect(jsonCall).toHaveProperty('errorCode', 'VALIDATION_ERROR')
  })
})
