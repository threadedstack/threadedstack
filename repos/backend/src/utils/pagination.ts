import type { TRequest } from '@TBE/types'

import { DBPaging } from '@TBE/constants/values'

export type TPaginationParams = {
  limit: number
  offset: number
}

export type TPaginatedResponse<T> = {
  data: T[]
  total?: number
  limit: number
  offset: number
}

/**
 * Parse pagination parameters from request query string
 * Returns sanitized limit and offset values with defaults
 */
export const parsePagination = (req: TRequest): TPaginationParams => {
  const rawLimit = Number.parseInt(req.query.limit as string, 10)
  const rawOffset = Number.parseInt(req.query.offset as string, 10)

  const limit =
    !isNaN(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, DBPaging.max) : DBPaging.default

  const offset = !isNaN(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  return { limit, offset }
}

export type TAuthorizedPageFetch<T> = (page: {
  limit: number
  offset: number
}) => Promise<{ data?: T[]; error?: any }>

export type TAuthorizedPageOpts<T> = {
  limit: number
  offset: number
  fetchPage: TAuthorizedPageFetch<T>
  isAuthorized: (item: T) => boolean
}

export type TAuthorizedPageResult<T> = {
  data?: T[]
  error?: any
}

// Hard cap on raw rows scanned while reconciling DB-level pagination against an
// in-memory access filter -- without a DB-side join, matching an access-filtered
// page can require scanning past the requested offset; this bounds that scan.
const MAX_SCAN_ROWS = DBPaging.max * 10

/**
 * Fetches a page of DB-paginated, then access-filtered, data such that the
 * returned page always has `limit` items (or fewer only when the underlying
 * data is truly exhausted or the scan cap is hit) -- rather than silently
 * returning a short page because filtered-out rows consumed slots in the
 * DB-level page.
 */
export const fetchAuthorizedPage = async <T>(
  opts: TAuthorizedPageOpts<T>
): Promise<TAuthorizedPageResult<T>> => {
  const { limit, offset, fetchPage, isAuthorized } = opts
  const needed = offset + limit

  const authorized: T[] = []
  let rawOffset = 0
  let rawLimit = Math.min(needed, MAX_SCAN_ROWS)

  while (true) {
    const { data, error } = await fetchPage({ limit: rawLimit, offset: rawOffset })
    if (error) return { error }

    const rows = data || []
    for (const row of rows) {
      if (isAuthorized(row)) authorized.push(row)
    }

    const scanned = rawOffset + rows.length
    const exhausted = rows.length < rawLimit
    if (exhausted || authorized.length >= needed || scanned >= MAX_SCAN_ROWS) break

    rawOffset = scanned
    rawLimit = Math.min(rawLimit * 2, MAX_SCAN_ROWS - scanned)
  }

  return { data: authorized.slice(offset, offset + limit) }
}
