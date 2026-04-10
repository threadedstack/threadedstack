import { Base } from '@TDM/models/base'

export class Invoice extends Base {
  userId: string
  stripeInvoiceId: string
  amount: number = 0
  currency: string = `usd`
  status: string = `draft`
  invoiceUrl?: string
  period: string

  constructor(invoice: Partial<Invoice>) {
    super()
    Object.assign(this, invoice)
  }
}
