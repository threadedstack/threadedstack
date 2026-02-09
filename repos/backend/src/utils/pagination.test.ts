import { describe, it, expect } from 'vitest'
import type { TRequest } from '@TBE/types'
import { parsePagination } from './pagination'

describe(`parsePagination`, () => {
  const buildReq = (query: Record<string, string> = {}) =>
    ({ query }) as unknown as TRequest

  it(`should return default limit (50) when no limit provided`, () => {
    const result = parsePagination(buildReq())
    expect(result.limit).toBe(50)
  })

  it(`should return default offset (0) when no offset provided`, () => {
    const result = parsePagination(buildReq())
    expect(result.offset).toBe(0)
  })

  it(`should cap limit at MAX_LIMIT (200) when exceeding`, () => {
    const result = parsePagination(buildReq({ limit: `500` }))
    expect(result.limit).toBe(200)
  })

  it(`should return parsed limit when valid`, () => {
    const result = parsePagination(buildReq({ limit: `25` }))
    expect(result.limit).toBe(25)
  })

  it(`should return parsed offset when valid`, () => {
    const result = parsePagination(buildReq({ offset: `10` }))
    expect(result.offset).toBe(10)
  })

  it(`should handle negative limit by falling back to default`, () => {
    const result = parsePagination(buildReq({ limit: `-5` }))
    expect(result.limit).toBe(50)
  })

  it(`should handle negative offset by falling back to default`, () => {
    const result = parsePagination(buildReq({ offset: `-1` }))
    expect(result.offset).toBe(0)
  })

  it(`should handle non-numeric values by falling back to defaults`, () => {
    const result = parsePagination(buildReq({ limit: `abc`, offset: `xyz` }))
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  it(`should handle zero limit by falling back to default`, () => {
    const result = parsePagination(buildReq({ limit: `0` }))
    expect(result.limit).toBe(50)
  })

  it(`should handle zero offset as valid`, () => {
    const result = parsePagination(buildReq({ offset: `0` }))
    expect(result.offset).toBe(0)
  })
})
