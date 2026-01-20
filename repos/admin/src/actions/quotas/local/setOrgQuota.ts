import type { TQuotaData } from '@TAF/types'
import { setOrgQuota as setQuota } from '@TAF/state/accessors'

export const setOrgQuota = (data: TQuotaData) => {
  setQuota(data)
}
