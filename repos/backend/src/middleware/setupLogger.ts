import type { Request, Response, NextFunction } from 'express'
import type { TApp } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { LoggerIgnore } from '@TBE/constants/values'

const ignore = (req: Request) => {
  if (LoggerIgnore.methods.includes(req.method)) return true
  return LoggerIgnore.routes.some((route) => req.path.startsWith(route))
}

/**
 * Request/Response logging middleware
 * Logs incoming requests and outgoing responses with timing information
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  if (ignore(req)) return next()

  logger.info(`→ ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get(`User-Agent`),
  })

  res.on(`finish`, () => {
    const duration = Date.now() - startTime
    const statusCode = res.statusCode

    const logLevel = statusCode >= 500 ? `error` : statusCode >= 400 ? `warn` : `info`

    logger[logLevel](`← ${req.method} ${req.path} ${statusCode} ${duration}ms`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode,
      duration,
    })
  })

  next()
}

export const setupLogger = (app: TApp) => {
  app.use(requestLogger)
}
