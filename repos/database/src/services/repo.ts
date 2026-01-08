import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBRepoSelect, TDBRepoInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { repos } from '@TDB/schemas/repos'

export type TRepoOpts = {
  db: NodePgDatabase
}

export class Repo extends Base<typeof repos, TDBRepoSelect, TDBRepoInsert> {
  constructor(opts: TRepoOpts) {
    super({ ...opts, schema: repos })
  }
}
