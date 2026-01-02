import type { TDBConfig } from '@TDB/types'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

import { drizzle } from 'drizzle-orm/neon-http'

let _neon:NeonHttpDatabase

export const neon = (config:TDBConfig) => {
  if(!_neon) _neon = drizzle(config.url)
  return _neon
}