import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBOrgSelect, TDBOrgInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { orgs } from '@TDB/schemas/orgs'
import { Organization as OrgModel } from '@tdsk/domain'

export type TOrgOpts = {
  db: NodePgDatabase
}

export class Org extends Base<typeof orgs, TDBOrgSelect, TDBOrgInsert, OrgModel> {
  constructor(opts: TOrgOpts) {
    super({ ...opts, table: orgs })
  }

  model = (data: TDBOrgSelect) => new OrgModel(data)
}
