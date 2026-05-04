import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { Exception } from '@tdsk/domain'

const SidRegex = /^[A-Za-z0-9_-]{10}$/
const UuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Checks if a string is a valid entity identifier (10-char nanoid sid)
 */
export const isValidId = (value: string): boolean => SidRegex.test(value)

/**
 * Middleware that validates all ID-shaped route params.
 * Any param named "id" or ending in "Id" is checked for valid format.
 * Accepts both nanoid(10) and UUID formats — user IDs are UUIDs from Neon Auth,
 * all other entity IDs are nanoid(10).
 * Throws 400 if any param fails validation.
 */
export const validateIdParams = (req: TRequest, res: TResponse, next: NextFunction) => {
  for (const [key, value] of Object.entries(req.params)) {
    if (
      (key === `id` || key.endsWith(`Id`)) &&
      !isValidId(value as string) &&
      !UuidRegex.test(value as string)
    )
      throw new Exception(400, `Invalid ${key} format — expected a valid ID`)
  }

  next()
}
