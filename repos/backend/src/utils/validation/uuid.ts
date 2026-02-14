import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { Exception } from '@TBE/utils/errors/exception'

const UUIDRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Checks if a string is a valid UUID v4 format
 */
export const isValidUUID = (value: string): boolean => UUIDRegex.test(value)

/**
 * Middleware that validates all UUID-shaped route params.
 * Any param named "id" or ending in "Id" is checked for valid UUID format.
 * Throws 400 if any param fails validation.
 */
export const validateUUIDParams = (req: TRequest, res: TResponse, next: NextFunction) => {
  for (const [key, value] of Object.entries(req.params)) {
    if ((key === `id` || key.endsWith(`Id`)) && value && !isValidUUID(value))
      throw new Exception(400, `Invalid ${key} format — expected a valid UUID`)
  }

  next()
}
