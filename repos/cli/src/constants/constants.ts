import type { TEnvFilter } from '@TSCL/types'

export const DBEnvFilter: TEnvFilter = {
  add: [],
  ends: [],
  exclude: [],
  contains: [],
  starts: [`STL_FORCE_DISABLE_SAFE`, `TDSK_DB_`, `TDSK_LOG_LEVEL`],
}
