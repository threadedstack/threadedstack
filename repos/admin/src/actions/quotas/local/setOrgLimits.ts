import type { TLimitsData } from '@TAF/types'
import { setOrgLimits as setLimits } from '@TAF/state/accessors'

export const setOrgLimits = (data: TLimitsData) => {
  setLimits(data)
}
