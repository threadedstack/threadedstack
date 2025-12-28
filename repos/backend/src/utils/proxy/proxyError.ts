import type { ServerResponse, IncomingMessage } from 'node:http'

import { logger } from '@TBE/utils/logger'

/**
 * Helper to log an error when a proxied request fails
 */
export const proxyError = (
  err: Error,
  req: IncomingMessage,
  res: ServerResponse
): void => {
  logger.error({
    url: req.url,
    method: req.method,
    error: err.message,
    headers: req.headers,
    code: res.statusCode || req.statusCode,
    message: res.statusMessage || req.statusMessage,
  })
}
