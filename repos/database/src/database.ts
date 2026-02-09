import type { TDBConfig, TDatabase, TDBServices } from '@TDB/types'

import { Pool } from 'pg'
import * as schema from '@TDB/schemas'
import * as DBservices from '@TDB/services'
import { config } from '@TDB/configs/db.config'
import { drizzle } from 'drizzle-orm/node-postgres'

let _pool: Pool | null = null
let _database: TDatabase | null = null

export const database = (cfg: TDBConfig = config) => {
  if (!_database) {
    /**
     * neon calls the users table user
     * which causes issues with how the rest of the app reference table names
     * for consistency, we users by default, but drizzle needs the real name of the table
     */
    const { users, orgs, ...rest } = schema
    _pool = new Pool({ connectionString: cfg.url })
    _database = drizzle({
      client: _pool,
      schema: {
        ...rest,
        user: users,
        organizations: orgs,
      },
    }) as unknown as TDatabase

    _database.services = Object.entries(DBservices).reduce((acc, [name, Service]) => {
      acc[name] = new Service({ db: _database, config: cfg })
      return acc
    }, {} as TDBServices)
  }

  return _database
}

export const disconnectDatabase = async () => {
  if (_pool) {
    await _pool.end()
    _pool = null
  }
  _database = null
}
