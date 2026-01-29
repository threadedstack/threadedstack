import type {
  TServiceOpts,
  TDBSubscriptionSelect,
  TDBSubscriptionInsert,
} from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { subscriptions } from '@TDB/schemas/subscriptions'
import { Subscription as SubscriptionModel } from '@tdsk/domain'

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

      return { data: this.model(data) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
}
