import { relations } from 'drizzle-orm'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { InvoiceIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { pgTable, text, integer, uuid } from 'drizzle-orm/pg-core'

export const invoices = pgTable(`invoices`, {
  ...base,
  id: entityId(InvoiceIdPrefix),
  userId: uuid(`user_id`)
    .references(() => users.id, { onDelete: `cascade` })
    .notNull(),
  stripeInvoiceId: text(`stripe_invoice_id`).notNull().unique(),
  amount: integer(`amount`).default(0).notNull(),
  currency: text(`currency`).default(`usd`).notNull(),
  status: text(`status`).notNull(),
  invoiceUrl: text(`invoice_url`),
  period: text(`period`).notNull(),
})

export const invoicesRelations = relations(invoices, ({ one }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
}))
