import type {
  TDBApiRes,
  TServiceOpts,
  TDBThreadSelect,
  TDBThreadInsert,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { eq, desc, asc } from 'drizzle-orm'
import { threads } from '@TDB/schemas/threads'
import { messages } from '@TDB/schemas/messages'
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

  async listByAgent(
    agentId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TDBApiRes<ThreadModel[]>> {
    try {
      const found = await this.db.query.threads.findMany({
        where: eq(threads.agentId, agentId),
        orderBy: desc(threads.createdAt),
        limit: opts?.limit,
        offset: opts?.offset,
      })
      return { data: found.map((row) => this.model(row)) }
    } catch (error: any) {
      return { error }
    }
  }

  async listByUser(
    userId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TDBApiRes<ThreadModel[]>> {
    try {
      const found = await this.db.query.threads.findMany({
        where: eq(threads.userId, userId),
        orderBy: desc(threads.createdAt),
        limit: opts?.limit,
        offset: opts?.offset,
      })
      return { data: found.map((row) => this.model(row)) }
    } catch (error: any) {
      return { error }
    }
  }

  async getWithMessages(id: string): Promise<TDBApiRes<ThreadModel>> {
    try {
      const row = await this.db.query.threads.findFirst({
        where: eq(threads.id, id),
        with: { messages: true },
      })
      return row ? { data: this.model(row) } : { error: new Error(`Thread not found`) }
    } catch (error: any) {
      return { error }
    }
  }

  async listBranches(
    threadId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TDBApiRes<ThreadModel[]>> {
    try {
      const found = await this.db.query.threads.findMany({
        where: eq(threads.parentThreadId, threadId),
        orderBy: desc(threads.createdAt),
        limit: opts?.limit,
        offset: opts?.offset,
      })
      return { data: found.map((row) => this.model(row)) }
    } catch (error: any) {
      return { error }
    }
  }

  async branchThread(
    threadId: string,
    messageId: string,
    userId: string
  ): Promise<TDBApiRes<ThreadModel & { messages?: any[] }>> {
    try {
      return await this.db.transaction(async (tx) => {
        const original = await tx.query.threads.findFirst({
          where: eq(threads.id, threadId),
        })
        if (!original) return {}

        const threadMessages = await tx.query.messages.findMany({
          where: eq(messages.threadId, threadId),
          orderBy: asc(messages.createdAt),
        })

        const branchIdx = threadMessages.findIndex((m) => m.id === messageId)
        if (branchIdx === -1) return {}

        const messagesToCopy = threadMessages.slice(0, branchIdx + 1)

        const [newThread] = await tx
          .insert(threads)
          .values({
            userId,
            meta: original.meta,
            public: original.public,
            orgId: original.orgId,
            parentThreadId: threadId,
            agentId: original.agentId,
            branchMessageId: messageId,
            projectId: original.projectId,
            providerId: original.providerId,
            name: `${original.name || `Untitled`} (branch)`,
          })
          .returning()

        let copiedMessages: any[] = []
        if (messagesToCopy.length > 0) {
          copiedMessages = await tx
            .insert(messages)
            .values(
              messagesToCopy.map((m) => ({
                type: m.type,
                meta: m.meta,
                orgId: m.orgId,
                content: m.content,
                projectId: m.projectId,
                threadId: newThread.id,
              }))
            )
            .returning()
        }

        const model = this.model(newThread as TDBThreadSelect)
        return { data: Object.assign(model, { messages: copiedMessages }) }
      })
    } catch (error: any) {
      return { error }
    }
  }
}
