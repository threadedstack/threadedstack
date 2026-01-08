import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBRoleSelect, TDBRoleInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { roles } from '@TDB/schemas/roles'

export type TRoleOpts = {
  db: NodePgDatabase
}

export class Role extends Base<typeof roles, TDBRoleSelect, TDBRoleInsert> {
  constructor(opts: TRoleOpts) {
    super({ ...opts, schema: roles })
  }
}
