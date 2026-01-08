import type { TDBConfig, TDatabase, TDBServices } from '@TDB/types'

import { Pool } from 'pg'
import * as DBservices from '@TDB/services'
import { config } from '@TDB/configs/db.config'
import { drizzle } from 'drizzle-orm/node-postgres'

let _database: TDatabase

export const database = (cfg: TDBConfig = config) => {
  if (!_database) {
    _database = drizzle({
      client: new Pool({
        connectionString: config.url,
      }),
    }) as unknown as TDatabase

    _database.services = Object.entries(DBservices).reduce((acc, [name, Service]) => {
      acc[name] = new Service({ db: _database, schema: undefined, config: cfg })
      return acc
    }, {} as TDBServices)
  }

  return _database
}
