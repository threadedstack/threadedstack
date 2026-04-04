import type { TServiceOpts, TDBInvoiceSelect, TDBInvoiceInsert } from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { invoices } from '@TDB/schemas/invoices'
import { Invoice as InvoiceModel } from '@tdsk/domain'

type TDBInvoice = typeof invoices.$inferInsert

export class Invoice extends Base<typeof invoices, TDBInvoiceSelect, TDBInvoiceInsert> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: invoices })
  }

  model = (data: TDBInvoiceSelect) => new InvoiceModel(data as Partial<InvoiceModel>)

  async findByUserId(userId: string) {
    try {
      const data = await this.db
        .select()
        .from(this.table)
        .where(eq(this.table.userId, userId))
        .orderBy(this.table.createdAt)

      return { data: data.map((row) => this.model(row as TDBInvoiceSelect)) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  async upsertByStripeId(stripeInvoiceId: string, data: Partial<TDBInvoiceInsert>) {
    try {
      const [result] = await this.db
        .insert(this.table)
        .values({ ...data, stripeInvoiceId } as TDBInvoice)
        .onConflictDoUpdate({
          target: [this.table.stripeInvoiceId],
          set: { ...data, updatedAt: new Date() } as TDBInvoice,
        })
        .returning()

      return { data: this.model(result as TDBInvoiceSelect) }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }
}
