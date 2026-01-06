import { Exception } from './exception'
import type { NextFunction, Request, Response } from 'express'

export const errorHandler = function errorHandler(
  error: Exception,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isCustomEx = error instanceof Exception

  const errorCode = error.errorCode
  const status = isCustomEx ? error.status : 500
  const message = error.message || `Something went wrong`

  res.status(status).json({
    status,
    message,
    errorCode,
  })
}
