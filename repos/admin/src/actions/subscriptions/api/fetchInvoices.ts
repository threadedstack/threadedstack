import { subscriptionsApi } from '@TAF/services/subscriptionsApi'
import { setInvoices } from '@TAF/actions/subscriptions/local/setInvoices'

/**
 * Fetch invoices for the current user and update state
 */
export const fetchInvoices = async () => {
  const resp = await subscriptionsApi.invoices()
  resp.data && setInvoices(resp.data)

  return resp
}
