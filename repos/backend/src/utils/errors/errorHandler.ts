import type { NextFunction, Request, Response } from 'express'
import { Exception } from './exception'
import { logger } from '@TBE/utils/logger'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'

export const errorHandler = function errorHandler(
  error: Exception,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isCustomEx = error instanceof Exception

  const code = error.code
  const message = error.message
  const stack = error.stack || message
  const status = isCustomEx ? error.status : 500

  logger.error(stack, cleanColl({ status, code }))

  res.status(status).json({
    error: message,
    ...(code && { code }),
  })
}
