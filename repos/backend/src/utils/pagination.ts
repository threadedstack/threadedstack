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
