import type { TDBConfig } from '@TDB/types'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { Pool } from 'pg'
import { config } from '@TDB/configs/db.config'
import { drizzle } from 'drizzle-orm/node-postgres'

let _database: NodePgDatabase

export const database = (cfg: TDBConfig = config) => {
  if (!_database)
    _database = drizzle({
      client: new Pool({
        connectionString: config.url,
      }),
    })

  return _database
}
