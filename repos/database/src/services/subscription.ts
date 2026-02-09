import type {
  TServiceOpts,
  TDBSubscriptionSelect,
  TDBSubscriptionInsert,
} from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { DBError } from '@TDB/utils/error/error'
import { subscriptions } from '@TDB/schemas/subscriptions'
import { Subscription as SubscriptionModel } from '@tdsk/domain'

type TDBSubscription = typeof subscriptions.$inferInsert

export class Subscription extends Base<
  typeof subscriptions,
  TDBSubscriptionSelect,
  TDBSubscriptionInsert
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: subscriptions })
  }

  model = (data: TDBSubscriptionSelect) => new SubscriptionModel(data)

  /**
   * Find a subscription by user ID
   */
  findByUser = async (userId: string) => {
    try {
      const [data] = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.userId, userId))

      if (!data) return { error: new DBError(`Subscription not found`) }

      return { data: this.model(data) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  /**
   * Find a subscription by Polar ID
   */
  findByPolarId = async (polarId: string) => {
    try {
      const [data] = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.polarId, polarId))

      if (!data) return { error: new DBError(`Subscription not found`) }

      return { data: this.model(data) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  /**
   * Upsert a subscription by userId - finds existing by userId, then creates or updates
   */
  upsertByUser = async (data: TDBSubscriptionInsert & { userId: string }) => {
    try {
      const { userId, ...rest } = data
      if (!userId) return { error: new DBError(`userId is required for upsertByUser`) }

      // Try to find existing subscription for this user
      const [existing] = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.userId, userId))

      if (existing) {
        // Update existing
        const resp = await this.db
          .update(this.table)
          .set({ ...rest, userId, updatedAt: new Date() } as TDBSubscription)

          .where(eq(this.table.userId, userId))
          .returning()

        if (!resp[0]) return { error: new DBError(`Failed to update subscription`) }
        return { data: this.model(resp[0]) }
      }
      // Create new
      const resp = await this.db
        .insert(this.table)
        .values({ ...rest, userId } as TDBSubscription)
        .returning()

      if (!resp[0]) return { error: new DBError(`Failed to create subscription`) }
      return { data: this.model(resp[0]) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
}
