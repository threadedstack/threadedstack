import type { Plan } from '@tdsk/domain'
import { setPaymentPlans } from '@TAF/state/accessors'

export const setPlans = (plans: Plan[]) => {
  setPaymentPlans(plans)
}
