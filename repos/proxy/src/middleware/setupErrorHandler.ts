import type { TProxyApp } from '@TPX/types'
import { errorHandler } from '@TPX/utils/errors/errorHandler'

/**
 * Error handler middleware to respond with prop API error status codes
 */
export const setupErrorHandler = (app: TProxyApp): void => {
  app.use(errorHandler)
}
