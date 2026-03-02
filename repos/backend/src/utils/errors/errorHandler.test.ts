import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { errorHandler } from './errorHandler'

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
    expect(mockRes.json).toHaveBeenCalledWith({
      error: `Something failed`,
      code: `Unknown`,
    })
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

  it(`should use Unknown code for non-Exception errors even when error.code is set`, () => {
    const error = Object.assign(new Error(`fail`), { code: `ERR_CODE` }) as any
    errorHandler(error, mockReq, mockRes, mockNext)
    expect(mockRes.status).toHaveBeenCalledWith(500)
    expect(mockRes.json).toHaveBeenCalledWith({ error: `fail`, code: `Unknown` })
  })

  describe(`SQL sanitization`, () => {
    it(`should sanitize "Failed query:" errors`, () => {
      const sqlError = `Failed query: select "agents"."id" from "agents" where "agents"."org_id" = $1 params: invalid-org-id`
      const error = new Exception(500, sqlError)
      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(500)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Database operation failed`,
      })
    })

    it(`should sanitize raw SQL select statements`, () => {
      const error = new Exception(500, `select * from users where id = 'test'`)
      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Database operation failed`,
      })
    })

    it(`should return 400 for UUID format errors`, () => {
      const error = new Exception(500, `invalid input syntax for type uuid: "not-a-uuid"`)
      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(400)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Invalid ID format — expected a valid UUID`,
      })
    })

    it(`should not sanitize normal error messages`, () => {
      const error = new Exception(403, `Access denied`)
      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(403)
      expect(mockRes.json).toHaveBeenCalledWith({ error: `Access denied` })
    })

    it(`should preserve non-500 status for SQL errors`, () => {
      const error = new Exception(422, `Failed query: insert into "users" values ($1)`)
      errorHandler(error, mockReq, mockRes, mockNext)

      expect(mockRes.status).toHaveBeenCalledWith(422)
      expect(mockRes.json).toHaveBeenCalledWith({
        error: `Database operation failed`,
      })
    })

    it(`should still log the full unsanitized error server-side`, () => {
      const sqlError = `Failed query: select * from users`
      const error = new Exception(500, sqlError)
      errorHandler(error, mockReq, mockRes, mockNext)

      const logCall = (logger.error as any).mock.calls[0][0]
      expect(logCall).toContain(sqlError)
    })
  })
})
