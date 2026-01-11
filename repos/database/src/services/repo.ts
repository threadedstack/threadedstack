import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBRepoSelect, TDBRepoInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { repos } from '@TDB/schemas/repos'
import { Repo as RepoModel } from '@tdsk/domain'

export type TRepoOpts = {
  db: NodePgDatabase
}

export class Repo extends Base<typeof repos, TDBRepoSelect, TDBRepoInsert, RepoModel> {
  constructor(opts: TRepoOpts) {
    super({ ...opts, table: repos })
  }

  #convert = (data: TDBRepoSelect) => new RepoModel(data)
}
