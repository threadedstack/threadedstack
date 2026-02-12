import type {
  TServiceOpts,
  TDBMessageSelect,
  TDBMessageInsert,
  TDBApiRes,
} from '@TDB/types'

import { eq, asc } from 'drizzle-orm'
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

  async listByThread(
    threadId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TDBApiRes<MessageModel[]>> {
    try {
      const found = await this.db.query.messages.findMany({
        where: eq(messages.threadId, threadId),
        orderBy: asc(messages.createdAt),
        limit: opts?.limit,
        offset: opts?.offset,
      })
      return { data: found.map((row) => this.model(row)) }
    } catch (error: any) {
      return { error }
    }
  }

  async createBatch(data: TDBMessageInsert[]): Promise<TDBApiRes<MessageModel[]>> {
    try {
      const resp = await this.db.insert(messages).values(data).returning()
      return { data: resp.map((row) => this.model(row as TDBMessageSelect)) }
    } catch (error: any) {
      return { error }
    }
  }
}
