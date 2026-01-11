import type { TDBConfig, TDatabase, TDBServices } from '@TDB/types'

import { Pool } from 'pg'
import { users } from '@TDB/schemas/users'
import * as DBservices from '@TDB/services'
import * as schema from '@TDB/schemas/schemas'
import { config } from '@TDB/configs/db.config'
import { drizzle } from 'drizzle-orm/node-postgres'

let _database: TDatabase

export const database = (cfg: TDBConfig = config) => {
  if (!_database) {
    _database = drizzle({
      schema: { users, ...schema },
      client: new Pool({ connectionString: config.url }),
    }) as unknown as TDatabase

    _database.services = Object.entries(DBservices).reduce((acc, [name, Service]) => {
      acc[name] = new Service({ db: _database, table: undefined, config: cfg })
      return acc
    }, {} as TDBServices)
  }

  return _database
}
