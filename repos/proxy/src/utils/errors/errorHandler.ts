import type { NextFunction, Request, Response } from 'express'

import { Exception } from '@tdsk/domain'
import { logger } from '@TPX/utils/logger'

export const errorHandler = function errorHandler(
  error: Exception,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isCustomEx = error instanceof Exception

  const status = isCustomEx ? error.status : 500
  const code = isCustomEx ? error.code : `Unknown`
  const message = error.message || `Something went wrong`

  logger.error(`${req.method} ${req.path} → ${status}: ${message}`, {
    code: error.code,
    stack: error.stack,
  })

  res.status(status).json({
    error: message,
    ...(code && { code }),
  })
}
