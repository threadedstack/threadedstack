import type { TSetupLogger, TWLogger } from './types'

import './stdio'
import { buildLogger } from './utils/buildLogger'
import { isStr, isColl, exists } from './utils/helpers'


let __logger:TWLogger
let __logLabel:string= `TDSK Logger`

export const setupLogger = ({
  tag,
  label=tag,
  ...opts
}:TSetupLogger) => {
  if(label) __logLabel = label

  __logger = buildLogger({ label: __logLabel, ...opts }) as TWLogger
}

const autoInit = () => {
  if(__logger && __logLabel) return

  setupLogger({ tag: __logLabel, label: __logLabel })
}

const loggerWrap = (method:string=`info`) => {
  return (...args:any[]) => {
    autoInit()
    const toLog = args.length <= 1 && isStr(args[0])
      ? {
          message: args[0],
          label: __logLabel
        }
      : args.reduce((obj, arg) => {
          if(!exists(arg)) return obj
        
          isColl(arg)
            ? !obj.data ? (obj.data = arg) : (obj.data = [...obj.data, arg])
            : (obj.message = `${obj.message} ${arg}`)

          return obj
        }, { message: ``, label: __logLabel })

    __logger?.[method]?.(toLog)
  }
}

const empty = () => console.log(`\n`)

export const ApiLogger = {
  empty,
  pair: loggerWrap(`info`),
  highlight: loggerWrap(`info`),
  error: loggerWrap(`error`),
  warn: loggerWrap(`warn`),
  data: loggerWrap(`data`),
  log: loggerWrap(`info`),
  info: loggerWrap(`info`),
  debug: loggerWrap(`info`),
  verbose: loggerWrap(`info`),
  silly: loggerWrap(`info`),
  success: loggerWrap(`info`),
}
