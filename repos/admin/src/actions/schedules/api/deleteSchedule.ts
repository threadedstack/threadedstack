import { schedulesApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeSchedule } from '@TAF/actions/schedules/local/removeSchedule'

export const deleteSchedule = async (orgId: string, projectId: string, id: string) => {
  const resp = await schedulesApi.delete(orgId, projectId, id)
  if (resp.error) return { error: resp.error }
  removeSchedule(projectId, id)
  query.removeFromListCache(schedulesApi.cache.list(orgId, projectId), id)
  query.client.removeQueries({ queryKey: schedulesApi.cache.detail(id) })
  return resp
}
