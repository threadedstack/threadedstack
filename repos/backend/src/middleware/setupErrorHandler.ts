import type { TApp } from '@tdsk/domain'

import { errorHandler } from '@TBE/utils/errors/errorHandler'

/**
 * Error handler middleware to respond with prop API error status codes
 */
export const setupErrorHandler = (app:TApp): void => {
  app.use(errorHandler)
}
