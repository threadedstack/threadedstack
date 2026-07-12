import { describe, it, expect, vi } from 'vitest'
import type { TRequest } from '@TBE/types'
import { parsePagination, fetchAuthorizedPage } from './pagination'

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

describe(`fetchAuthorizedPage`, () => {
  const buildFetchPage =
    (all: number[]) =>
    async ({ limit, offset }: { limit: number; offset: number }) => ({
      data: all.slice(offset, offset + limit),
    })

  it(`returns exactly limit items when unfiltered`, async () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = await fetchAuthorizedPage({
      limit: 3,
      offset: 0,
      fetchPage: buildFetchPage(all),
      isAuthorized: () => true,
    })
    expect(result.data).toEqual([1, 2, 3])
  })

  it(`makes exactly one fetchPage call when the first raw page already has enough authorized items`, async () => {
    const fetchPage = vi.fn(buildFetchPage([1, 2, 3, 4, 5]))
    const result = await fetchAuthorizedPage({
      limit: 3,
      offset: 0,
      fetchPage,
      isAuthorized: () => true,
    })
    expect(result.data).toEqual([1, 2, 3])
    expect(fetchPage).toHaveBeenCalledOnce()
    expect(fetchPage).toHaveBeenCalledWith({ limit: 3, offset: 0 })
  })

  it(`over-fetches to fill a page when access filtering shrinks the DB-level page`, async () => {
    // odd numbers are "authorized", evens are not -- only 1,3,5,7 pass
    const all = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = await fetchAuthorizedPage({
      limit: 3,
      offset: 0,
      fetchPage: buildFetchPage(all),
      isAuthorized: (n) => n % 2 === 1,
    })
    expect(result.data).toEqual([1, 3, 5])
  })

  it(`returns a short page only when the underlying data is truly exhausted`, async () => {
    const all = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = await fetchAuthorizedPage({
      limit: 3,
      offset: 3,
      fetchPage: buildFetchPage(all),
      isAuthorized: (n) => n % 2 === 1,
    })
    // only 4 authorized items total (1,3,5,7) -- offset 3 leaves just 1
    expect(result.data).toEqual([7])
  })

  it(`propagates a fetchPage error without swallowing it`, async () => {
    const error = new Error(`db down`)
    const result = await fetchAuthorizedPage({
      limit: 3,
      offset: 0,
      fetchPage: async () => ({ error }),
      isAuthorized: () => true,
    })
    expect(result.error).toBe(error)
  })
})
