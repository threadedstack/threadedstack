import type { TServiceOpts, TDBThreadSelect, TDBThreadInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { threads } from '@TDB/schemas/threads'
import { Thread as ThreadModel } from '@tdsk/domain'

export class Thread extends Base<
  typeof threads,
  TDBThreadSelect,
  TDBThreadInsert,
  ThreadModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: threads })
  }

  model = (data: TDBThreadSelect) => new ThreadModel(data as ThreadModel)
}
