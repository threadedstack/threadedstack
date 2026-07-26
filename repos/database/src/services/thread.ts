import type {
  TDBApiRes,
  TServiceOpts,
  TDBThreadSelect,
  TDBThreadInsert,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { eq, lt, and, desc, asc } from 'drizzle-orm'
import { threads } from '@TDB/schemas/threads'
import { messages } from '@TDB/schemas/messages'
import { PlanLimits, ESubscriptionTier, Thread as ThreadModel } from '@tdsk/domain'

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

  /**
   * Enforce plan-tier thread retention (PlanLimits[tier].retention, in days):
   * for every org, delete threads created before its owner's plan retention
   * cutoff. An org with no owner or no subscription row defaults to the free
   * tier's window. Messages cascade-delete via the threads FK (schemas/
   * messages.ts threadId onDelete: cascade) -- no separate message-pruning
   * step is needed.
   */
  async pruneExpiredThreads(): Promise<{ orgId: string; deletedThreadIds: string[] }[]> {
    const results: { orgId: string; deletedThreadIds: string[] }[] = []

    const orgsRes = await this.db.services.org.list()
    if (orgsRes.error || !orgsRes.data?.length) return results

    for (const org of orgsRes.data) {
      let tier = ESubscriptionTier.free
      if (org.ownerId) {
        const subRes = await this.db.services.subscription.findByUser(org.ownerId)
        if (subRes.data?.tier) tier = subRes.data.tier as ESubscriptionTier
      }

      const retentionDays =
        PlanLimits[tier]?.retention ?? PlanLimits[ESubscriptionTier.free].retention
      const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

      const deleted = await this.db
        .delete(threads)
        .where(and(eq(threads.orgId, org.id), lt(threads.createdAt, cutoff)))
        .returning({ id: threads.id })

      if (deleted.length)
        results.push({ orgId: org.id, deletedThreadIds: deleted.map((row) => row.id) })
    }

    return results
  }
}
