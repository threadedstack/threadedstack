import type { TDBConfig } from '@TDB/types'

import { neon } from '@TDB/providers'
import { config } from '@TDB/configs/db.config'

const databases = {
  neon,
}

export const database = (cfg:TDBConfig=config) => {
  const { type } = config
  return databases[type](config)
}



