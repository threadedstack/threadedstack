import type { TLogOpts } from '../types'

import winston from 'winston'
import { noOpObj } from '@keg-hub/jsutils/noOpObj'
const { createLogger, transports, format } = winston
const { json, splat, simple, combine, timestamp, prettyPrint, label: logLabel } = format

let __LOGGER: winston.Logger

/**
 * Winston transform helper to filter out OPTIONS requests from the browser
 */
const filterOptionsReq = () => {
  return format((info) => {
    return (info?.message as string)?.startsWith?.(`OPTIONS `) ? null : info
  })()
}

const getFormatter = (label: string) => {
  return process.env.NODE_ENV !== 'production'
    ? combine(
        filterOptionsReq(),
        timestamp(),
        logLabel({ label }),
        simple(),
        json(),
        prettyPrint({ colorize: true })
      )
    : combine(filterOptionsReq(), splat(), timestamp(), logLabel({ label }), json())
}

export const buildLogger = (
  options: TLogOpts = noOpObj as TLogOpts,
  defaultLogger: boolean = true
) => {
  if (defaultLogger && __LOGGER) return __LOGGER

  const {
    silent = false,
    level = `silly`,
    label = `TDSK`,
    exitOnError = false,
    handleExceptions = true,
  } = options

  const logger = createLogger({
    silent: silent,
    exitOnError: exitOnError,
    transports: [
      new transports.Console({
        level,
        format: getFormatter(label),
        handleExceptions: handleExceptions,
      }),
    ],
  })

  if (!defaultLogger) return logger

  __LOGGER = logger
  return __LOGGER
}
