import { base } from '@TDB/utils/schema/base'
import { users } from '@TDB/schemas/users'
import { relations } from 'drizzle-orm'
import { pgTable, text, timestamp, boolean, uuid, integer } from 'drizzle-orm/pg-core'

export const subscriptions = pgTable('subscriptions', {
  ...base,
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull()
    .unique(),

  // Subscription Details
  tier: text('tier').notNull().default('free'),
  status: text('status').notNull().default('active'),

  // Polar.sh Integration
  polarId: text('polar_id'),
  polarCustomerId: text('polar_customer_id'),
  polarPriceId: text('polar_price_id'),

  // Period Tracking
  currentPeriodStart: timestamp('current_period_start', { mode: 'string' }),
  currentPeriodEnd: timestamp('current_period_end', { mode: 'string' }),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),

  seats: integer('seats').default(0),
})

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}))
