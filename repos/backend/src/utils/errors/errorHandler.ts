import type { NextFunction, Request, Response } from 'express'
import { Exception } from './exception'
import { logger } from '@TBE/utils/logger'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'

const label = `--------- ERROR STACK ---------\n`

export const errorHandler = function errorHandler(
  error: Exception,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isCustomEx = error instanceof Exception

  const code = error.code
  const message = error.message
  const status = isCustomEx ? error.status : 500
  const stack = `${label}${error.stack || message}\n${label}`

  logger.error(stack, cleanColl({ status, code }))

  res.status(status).json({
    error: message,
    ...(code && { code }),
  })
}
