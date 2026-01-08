import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBMessageSelect, TDBMessageInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { messages } from '@TDB/schemas/messages'

export type TMessageOpts = {
  db: NodePgDatabase
}

export class Message extends Base<typeof messages, TDBMessageSelect, TDBMessageInsert> {
  constructor(opts: TMessageOpts) {
    super({ ...opts, schema: messages })
  }
}
