import type { TSetupLogger, TWLogger } from './types'

import './stdio'
import { buildLogger } from './utils/buildLogger'
import { isStr, isColl, exists } from './utils/helpers'

let __logger: TWLogger
let __logLabel: string = `TDSK Logger`

export const setupLogger = ({ tag, label = tag, ...opts }: TSetupLogger) => {
  if (label) __logLabel = label

  __logger = buildLogger({ label: __logLabel, ...opts }) as TWLogger
}

const autoInit = (logger: TWLogger = __logger, label: string = __logLabel) => {
  if (logger && label) return
  setupLogger({ label, tag: label })
}

const loggerWrap = (
  method: string = `info`,
  logger: TWLogger = __logger,
  label: string = __logLabel
) => {
  return (...args: any[]) => {
    autoInit(logger, label)
    const toLog =
      args.length <= 1 && isStr(args[0])
        ? {
            message: args[0],
            label,
          }
        : args.reduce(
            (obj, arg) => {
              if (!exists(arg)) return obj

              isColl(arg)
                ? !obj.data
                  ? (obj.data = arg)
                  : (obj.data = [...obj.data, arg])
                : (obj.message = `${obj.message} ${arg}`)

              return obj
            },
            { message: ``, label }
          )

    logger?.[method]?.(toLog)
  }
}

const empty = () => console.log(`\n`)

export const buildApiLogger = (
  label: string = __logLabel,
  level: string = `info`,
  logger: TWLogger = __logger
) => {
  logger = logger || buildLogger({ label, level }, false)

  return {
    empty,
    pair: loggerWrap(`info`, logger, label),
    highlight: loggerWrap(`info`, logger, label),
    error: loggerWrap(`error`, logger, label),
    warn: loggerWrap(`warn`, logger, label),
    data: loggerWrap(`data`, logger, label),
    log: loggerWrap(`info`, logger, label),
    info: loggerWrap(`info`, logger, label),
    debug: loggerWrap(`info`, logger, label),
    verbose: loggerWrap(`info`, logger, label),
    silly: loggerWrap(`info`, logger, label),
    success: loggerWrap(`info`, logger, label),
  }
}

export const ApiLogger = buildApiLogger()
