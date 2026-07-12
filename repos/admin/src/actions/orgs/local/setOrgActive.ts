import { nav } from '@TAF/services/nav'
import {
  setActiveOrgId,
  getActiveOrgId,
  resetApiKeys,
  resetOrgQuota,
  resetOrgLimits,
  resetSubscription,
  resetInvoices,
  resetPaymentPlans,
} from '@TAF/state/accessors'
import { unsetActiveProject } from '@TAF/actions/projects/local/unsetActiveProject'

export const setOrgActive = (
  orgId: string,
  navigate: boolean = true,
  force?: boolean
) => {
  const current = getActiveOrgId()
  if (force || current !== orgId) {
    unsetActiveProject()
    resetApiKeys()
    resetOrgQuota()
    resetOrgLimits()
    resetSubscription()
    resetInvoices()
    resetPaymentPlans()
    setActiveOrgId(orgId)
  }

  if (navigate) orgId ? nav.to(`/orgs/${orgId}`) : nav.to(`/orgs`)
}
