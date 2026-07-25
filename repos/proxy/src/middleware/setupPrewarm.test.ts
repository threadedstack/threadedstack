import type { Request, Response, NextFunction } from 'express'

import { prewarm } from './setupPrewarm'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createMockRes = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response

describe(`prewarm`, () => {
  let mockRes: Response
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()
    mockRes = createMockRes()
    mockNext = vi.fn() as unknown as NextFunction
  })

  it(`should be a function`, () => {
    expect(typeof prewarm).toBe(`function`)
  })

  it(`should return a 200 warmed response and NOT call next when the prewarm header is present`, () => {
    const mockReq = {
      app: {
        locals: {
          config: {
            domains: { prewarmHeader: `x-threaded-stack-prewarm` },
          },
        },
      },
      headers: { 'x-threaded-stack-prewarm': `1` },
    } as unknown as Request

    prewarm(mockReq, mockRes, mockNext)

    expect(mockRes.status).toHaveBeenCalledWith(200)
    expect(mockRes.json).toHaveBeenCalledWith({
      status: `warmed`,
      message: `Certificate generation triggered`,
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should call next and NOT respond when the prewarm header is absent`, () => {
    const mockReq = {
      app: {
        locals: {
          config: {
            domains: { prewarmHeader: `x-threaded-stack-prewarm` },
          },
        },
      },
      headers: {},
    } as unknown as Request

    prewarm(mockReq, mockRes, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockRes.status).not.toHaveBeenCalled()
    expect(mockRes.json).not.toHaveBeenCalled()
  })
})
