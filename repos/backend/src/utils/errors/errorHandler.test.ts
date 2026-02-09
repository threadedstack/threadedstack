import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { errorHandler } from './errorHandler'
import { Exception } from './exception'
import { logger } from '@TBE/utils/logger'

describe(`errorHandler`, () => {
  let mockReq: any
  let mockRes: any
  let mockNext: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockReq = {}
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
    mockNext = vi.fn()
  })

  it(`should handle Exception with correct status`, () => {
    const error = new Exception(400, `Bad request`)
    errorHandler(error, mockReq, mockRes, mockNext)
    expect(mockRes.status).toHaveBeenCalledWith(400)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Bad request` })
  })

  it(`should include code when present on Exception`, () => {
    const error = new Exception(403, `Forbidden`, `FORBIDDEN`)
    errorHandler(error, mockReq, mockRes, mockNext)
    expect(mockRes.status).toHaveBeenCalledWith(403)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Forbidden`, code: `FORBIDDEN` })
  })

  it(`should default to 500 for non-Exception errors`, () => {
    const error = new Error(`Something failed`) as any
    errorHandler(error, mockReq, mockRes, mockNext)
    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `Something failed` })
  })

  it(`should log the error via logger.error`, () => {
    const error = new Exception(500, `Server error`)
    errorHandler(error, mockReq, mockRes, mockNext)
    expect(logger.error).toHaveBeenCalled()
  })

  it(`should not include code in response when absent`, () => {
    const error = new Exception(400, `Bad request`)
    errorHandler(error, mockReq, mockRes, mockNext)
    const jsonArg = mockRes.json.mock.calls[0][0]
    expect(jsonArg).not.toHaveProperty(`code`)
  })

  it(`should include code from a generic Error when present`, () => {
    const error = Object.assign(new Error(`fail`), { code: `ERR_CODE` }) as any
    errorHandler(error, mockReq, mockRes, mockNext)
    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `fail`, code: `ERR_CODE` })
  })
})
