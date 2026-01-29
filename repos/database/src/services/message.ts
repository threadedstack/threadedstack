import type { TServiceOpts, TDBMessageSelect, TDBMessageInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { messages } from '@TDB/schemas/messages'
import { Message as MessageModel } from '@tdsk/domain'

export class Message extends Base<
  typeof messages,
  TDBMessageSelect,
  TDBMessageInsert,
  MessageModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: messages })
  }
  model = (data: TDBMessageSelect) => new MessageModel(data as Partial<MessageModel>)
}
