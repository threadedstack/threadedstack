import type { Invoice } from '@tdsk/domain'
import { setInvoices as set } from '@TAF/state/accessors'

export const setInvoices = (invoices: Invoice[]) => set(invoices)
