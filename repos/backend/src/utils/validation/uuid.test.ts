import { describe, it, expect, vi } from 'vitest'
import { isValidUUID, validateUUIDParams } from './uuid'

describe(`isValidUUID`, () => {
  it(`should accept valid UUID v4`, () => {
    expect(isValidUUID(`22f40206-fd94-4da9-9e6e-b3e860798e0a`)).toBe(true)
  })

  it(`should accept uppercase UUIDs`, () => {
    expect(isValidUUID(`22F40206-FD94-4DA9-9E6E-B3E860798E0A`)).toBe(true)
  })

  it(`should reject non-UUID strings`, () => {
    expect(isValidUUID(`invalid-org-id`)).toBe(false)
    expect(isValidUUID(`hello`)).toBe(false)
    expect(isValidUUID(``)).toBe(false)
    expect(isValidUUID(`12345`)).toBe(false)
  })

  it(`should reject UUIDs with wrong length segments`, () => {
    expect(isValidUUID(`22f40206-fd94-4da9-9e6e-b3e860798e0`)).toBe(false)
    expect(isValidUUID(`22f40206-fd94-4da9-9e6e`)).toBe(false)
  })

  it(`should reject UUIDs with invalid characters`, () => {
    expect(isValidUUID(`22f40206-fd94-4da9-9e6e-b3e860798xyz`)).toBe(false)
  })
})

describe(`validateUUIDParams`, () => {
  const mockRes = {} as any
  const mockNext = vi.fn()

  beforeEach(() => {
    mockNext.mockClear()
  })

  it(`should call next for valid UUID params`, () => {
    const req = {
      params: { orgId: `22f40206-fd94-4da9-9e6e-b3e860798e0a` },
    } as any

    validateUUIDParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should call next when no UUID params exist`, () => {
    const req = { params: { name: `test` } } as any
    validateUUIDParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should call next when params is empty`, () => {
    const req = { params: {} } as any
    validateUUIDParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should throw 400 for invalid orgId`, () => {
    const req = { params: { orgId: `invalid-org-id` } } as any
    expect(() => validateUUIDParams(req, mockRes, mockNext)).toThrow(
      `Invalid orgId format`
    )
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should throw 400 for invalid id param`, () => {
    const req = { params: { id: `not-a-uuid` } } as any
    expect(() => validateUUIDParams(req, mockRes, mockNext)).toThrow(`Invalid id format`)
  })

  it(`should throw 400 for invalid agentId`, () => {
    const req = { params: { agentId: `bad` } } as any
    expect(() => validateUUIDParams(req, mockRes, mockNext)).toThrow(
      `Invalid agentId format`
    )
  })

  it(`should validate multiple UUID params`, () => {
    const req = {
      params: {
        orgId: `22f40206-fd94-4da9-9e6e-b3e860798e0a`,
        agentId: `fbb29674-33fb-40e9-a271-a52ca8a14ac3`,
      },
    } as any

    validateUUIDParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should reject if any UUID param is invalid`, () => {
    const req = {
      params: {
        orgId: `22f40206-fd94-4da9-9e6e-b3e860798e0a`,
        agentId: `not-valid`,
      },
    } as any

    expect(() => validateUUIDParams(req, mockRes, mockNext)).toThrow(
      `Invalid agentId format`
    )
  })

  it(`should skip non-UUID-named params`, () => {
    const req = {
      params: {
        name: `anything`,
        orgId: `22f40206-fd94-4da9-9e6e-b3e860798e0a`,
      },
    } as any

    validateUUIDParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })
})
