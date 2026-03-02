import type { NextFunction, Request, Response } from 'express'
import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'

const label = `--------- ERROR STACK ---------\n`

const SQLPatterns = [
  `Failed query:`,
  `select `,
  `insert into `,
  `update `,
  `delete from `,
  `params:`,
]

/**
 * Detects if an error message contains raw SQL and returns a sanitized
 * message + appropriate status code.
 */
const sanitizeDBError = (message: string, status: number) => {
  const lower = message.toLowerCase()

  if (lower.includes(`invalid input syntax for type uuid`))
    return { status: 400, message: `Invalid ID format — expected a valid UUID` }

  if (SQLPatterns.some((p) => lower.includes(p.toLowerCase())))
    return { status: status === 500 ? 500 : status, message: `Database operation failed` }

  return null
}

export const errorHandler = function errorHandler(
  error: Exception,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const isCustomEx = error instanceof Exception

  const message = error.message
  const code = isCustomEx ? error.code : `Unknown`
  const rawStatus = isCustomEx ? error.status : 500
  const stack = `${label}${error.stack || message}\n${label}`

  // Always log the full error server-side
  logger.error(stack, cleanColl({ status: rawStatus, code: error.code }))

  // Sanitize DB/SQL errors before sending to client
  const sanitized = sanitizeDBError(message, rawStatus)
  const status = sanitized?.status ?? rawStatus
  const clientMessage = sanitized?.message ?? message

  res.status(status).json({
    error: clientMessage,
    ...(code && { code }),
  })
}
