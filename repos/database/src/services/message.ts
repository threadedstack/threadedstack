import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBMessageSelect, TDBMessageInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { messages } from '@TDB/schemas/messages'
import { Message as MessageModel } from '@tdsk/domain'

export type TMessageOpts = {
  db: NodePgDatabase
}

export class Message extends Base<
  typeof messages,
  TDBMessageSelect,
  TDBMessageInsert,
  MessageModel
> {
  constructor(opts: TMessageOpts) {
    super({ ...opts, table: messages })
  }
  #convert = (data: TDBMessageSelect) => new MessageModel(data as Partial<MessageModel>)
}
