import type { TLogOpts } from './types'
import { npmLevels } from './utils/levels'
import expressWinston from 'express-winston'
import { buildLogger } from './utils/buildLogger'
import { noOpObj } from '@keg-hub/jsutils/noOpObj'

type TExpressApp = {
  locals: Record<string, any>
  [key: string]: any
}

const getLoggerConfig = (app: TExpressApp) => {
  const loggerOpts = app.locals.config.logger || (noOpObj as TLogOpts)
  const logger = buildLogger(loggerOpts as TLogOpts)
  const meta = Boolean(npmLevels[loggerOpts.level || 'info'] >= npmLevels.verbose)
  return { logger, meta }
}

/**
 * Adds middleware logging for requests
 * @function
 *
 * @return {void}
 */
export const setupLoggerReq = (app: TExpressApp, middlewareOpts?: Record<any, any>) => {
  const { logger, meta } = getLoggerConfig(app)

  app.use(
    expressWinston.logger({
      colorize: false,
      expressFormat: true,
      winstonInstance: logger,
      meta,
      ...(middlewareOpts || noOpObj),
    })
  )
}

/**
 * Adds middleware logging for errors
 * @function
 *
 * @return {void}
 */
export const setupLoggerErr = (app: TExpressApp, middlewareOpts?: Record<any, any>) => {
  const { logger, meta } = getLoggerConfig(app)

  app.use(
    expressWinston.errorLogger({
      winstonInstance: logger,
      meta,
      ...(middlewareOpts || noOpObj),
    })
  )
}
