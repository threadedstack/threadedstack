import { describe, it, expect, vi, beforeEach } from 'vitest'
import { isValidId, validateIdParams } from './id'

describe(`isValidId`, () => {
  it(`should accept valid 10-char nanoid sid`, () => {
    expect(isValidId(`V1StGXR8_Z`)).toBe(true)
  })

  it(`should accept nanoid with hyphens and underscores`, () => {
    expect(isValidId(`xK9-B2nQ_p`)).toBe(true)
  })

  it(`should accept prefixed entity IDs`, () => {
    expect(isValidId(`ag_0000001`)).toBe(true)
    expect(isValidId(`sc_abc1234`)).toBe(true)
    expect(isValidId(`sb_xyz9876`)).toBe(true)
    expect(isValidId(`og_Kx9B2nQ`)).toBe(true)
  })

  it(`should reject strings shorter than 10 chars (non-UUID)`, () => {
    expect(isValidId(`abc`)).toBe(false)
  })

  it(`should reject strings longer than 10 chars (non-UUID)`, () => {
    expect(isValidId(`V1StGXR8_Zextra`)).toBe(false)
  })

  it(`should reject empty string`, () => {
    expect(isValidId(``)).toBe(false)
  })

  it(`should reject UUID format`, () => {
    expect(isValidId(`550e8400-e29b-41d4-a716-446655440000`)).toBe(false)
  })
})

describe(`validateIdParams`, () => {
  const mockRes = {} as any
  const mockNext = vi.fn()

  beforeEach(() => {
    mockNext.mockClear()
  })

  it(`should call next for valid sid params`, () => {
    const req = { params: { orgId: `V1StGXR8_Z` } } as any
    validateIdParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should call next for prefixed entity ID params`, () => {
    const req = {
      params: {
        orgId: `og_Kx9B2nQ`,
        agentId: `ag_abc1234`,
      },
    } as any
    validateIdParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should call next for mixed valid ID params`, () => {
    const req = {
      params: {
        orgId: `V1StGXR8_Z`,
        agentId: `V2StGXR8_A`,
      },
    } as any
    validateIdParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should throw 400 for invalid format`, () => {
    const req = { params: { orgId: `bad` } } as any
    expect(() => validateIdParams(req, mockRes, mockNext)).toThrow(`Invalid orgId format`)
  })

  it(`should throw 400 for empty-string ID param`, () => {
    const req = { params: { orgId: `` } } as any
    expect(() => validateIdParams(req, mockRes, mockNext)).toThrow(`Invalid orgId format`)
  })

  it(`should validate bare "id" param key`, () => {
    const req = { params: { id: `bad` } } as any
    expect(() => validateIdParams(req, mockRes, mockNext)).toThrow(`Invalid id format`)
  })

  it(`should call next for valid bare "id" param`, () => {
    const req = { params: { id: `V1StGXR8_Z` } } as any
    validateIdParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should not call next when validation throws`, () => {
    const req = { params: { orgId: `bad` } } as any
    expect(() => validateIdParams(req, mockRes, mockNext)).toThrow()
    expect(mockNext).not.toHaveBeenCalled()
  })

  it(`should skip non-ID-named params`, () => {
    const req = {
      params: { name: `anything`, orgId: `V1StGXR8_Z` },
    } as any
    validateIdParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should accept UUID format for any ID param`, () => {
    const req = {
      params: { id: `550e8400-e29b-41d4-a716-446655440000` },
    } as any
    validateIdParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })

  it(`should accept UUID format for suffixed ID params`, () => {
    const req = {
      params: { orgId: `V1StGXR8_Z`, userId: `550e8400-e29b-41d4-a716-446655440000` },
    } as any
    validateIdParams(req, mockRes, mockNext)
    expect(mockNext).toHaveBeenCalledOnce()
  })
})
