import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBRoleSelect, TDBRoleInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { roles } from '@TDB/schemas/roles'
import { Role as RoleModel } from '@tdsk/domain'

export type TRoleOpts = {
  db: NodePgDatabase
}

export class Role extends Base<typeof roles, TDBRoleSelect, TDBRoleInsert, RoleModel> {
  constructor(opts: TRoleOpts) {
    super({ ...opts, table: roles })
  }

  model = (data: TDBRoleSelect) => new RoleModel(data)
}
