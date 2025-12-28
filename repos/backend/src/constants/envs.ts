import type { TLogLevel } from '../types'

export const LOG_LEVEL: TLogLevel = (process.env.TDSK_BE_LOG_LEVEL as TLogLevel) || `info`
