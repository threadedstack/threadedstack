import type { TLogLevel } from '../types'

export const LOG_LEVEL: TLogLevel = (process.env.TDSK_PX_LOG_LEVEL as TLogLevel) || `info`
