import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBSubscriptionSelect, TDBSubscriptionInsert } from '@TDB/types'
import { Base } from '@TDB/services/base'
import { subscriptions } from '@TDB/schemas/subscriptions'
import { eq } from 'drizzle-orm'

export type TSubscriptionOpts = {
  db: NodePgDatabase
}

export class Subscription extends Base<
  typeof subscriptions,
  TDBSubscriptionSelect,
  TDBSubscriptionInsert
> {
  constructor(opts: TSubscriptionOpts) {
    super({ ...opts, table: subscriptions })
  }

  /**
   * Find a subscription by user ID
   */
  async findByUser(userId: string) {
    try {
      const [data] = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.userId, userId))

      return { data }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  /**
   * Find a subscription by Polar ID
   */
  async findByPolarId(polarId: string) {
    try {
      const [data] = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.polarId, polarId))

      return { data }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
}
