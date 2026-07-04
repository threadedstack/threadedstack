import type {
  TServiceOpts,
  TDBMessageSelect,
  TDBMessageInsert,
  TDBApiRes,
} from '@TDB/types'

import { eq, asc, desc } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { threads } from '@TDB/schemas/threads'
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

  /**
   * Most recent messages across ALL of an agent's threads (cross-thread recall).
   * Joins threads on messages.threadId and filters by threads.agentId.
   */
  async listRecentByAgent(
    agentId: string,
    limit = 50
  ): Promise<TDBApiRes<MessageModel[]>> {
    try {
      const rows = await this.db
        .select({ message: messages })
        .from(messages)
        .innerJoin(threads, eq(messages.threadId, threads.id))
        .where(eq(threads.agentId, agentId))
        .orderBy(desc(messages.createdAt))
        .limit(limit)

      return { data: rows.map((row) => this.model(row.message as TDBMessageSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  async createBatch(data: TDBMessageInsert[]): Promise<TDBApiRes<MessageModel[]>> {
    try {
      const resp = await this.db
        .insert(messages)
        .values(data as (typeof messages.$inferInsert)[])
        .returning()
      return { data: resp.map((row) => this.model(row as TDBMessageSelect)) }
    } catch (error: any) {
      return { error }
    }
  }
}
