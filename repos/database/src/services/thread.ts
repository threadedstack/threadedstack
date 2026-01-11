import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBThreadSelect, TDBThreadInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { threads } from '@TDB/schemas/threads'
import { Thread as ThreadModel } from '@tdsk/domain'

export type TThreadOpts = {
  db: NodePgDatabase
}

export class Thread extends Base<
  typeof threads,
  TDBThreadSelect,
  TDBThreadInsert,
  ThreadModel
> {
  constructor(opts: TThreadOpts) {
    super({ ...opts, table: threads })
  }

  model = (data: TDBThreadSelect) => new ThreadModel(data)
}
