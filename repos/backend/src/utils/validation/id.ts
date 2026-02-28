import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { Exception } from '@TBE/utils/errors/exception'

const SidRegex = /^[A-Za-z0-9_-]{10}$/

/**
 * Checks if a string is a valid entity identifier (10-char nanoid sid)
 */
export const isValidId = (value: string): boolean => SidRegex.test(value)

/**
 * Middleware that validates all ID-shaped route params.
 * Any param named "id" or ending in "Id" is checked for valid ID format.
 * Throws 400 if any param fails validation.
 */
export const validateIdParams = (req: TRequest, res: TResponse, next: NextFunction) => {
  for (const [key, value] of Object.entries(req.params)) {
    if ((key === `id` || key.endsWith(`Id`)) && !isValidId(value))
      throw new Exception(400, `Invalid ${key} format — expected a valid ID`)
  }

  next()
}
