import { schedulesApi } from '@TAF/services'

export const triggerSchedule = async (orgId: string, id: string) => {
  return schedulesApi.trigger(orgId, id)
}
