import { featureGate } from './featureGate'
import { describe, it, expect, vi } from 'vitest'

vi.mock(`@tdsk/domain`, () => ({
  isFeatureEnabled: vi.fn((flag: string) => {
    if (flag === `terminalGui`) return true
    return false
  }),
}))

describe(`featureGate`, () => {
  const mockReq = {} as any
  const mockNext = vi.fn()

  const buildRes = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any
    return res
  }

  it(`should call next() when the flag is enabled`, () => {
    const middleware = featureGate(`terminalGui`)
    const res = buildRes()
    middleware(mockReq, res, mockNext)
    expect(mockNext).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it(`should return 404 when the flag is disabled`, () => {
    const middleware = featureGate(`skills`)
    const res = buildRes()
    mockNext.mockClear()
    middleware(mockReq, res, mockNext)
    expect(mockNext).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: `Not found` })
  })
})
