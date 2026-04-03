import { skillsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { removeSkill } from '@TAF/actions/skills/local/removeSkill'

export const deleteSkill = async (orgId: string, id: string) => {
  const resp = await skillsApi.delete(orgId, id)
  if (resp.error) return { error: resp.error }
  removeSkill(id)
  query.removeFromListCache(skillsApi.cache.list(orgId), id)
  query.client.removeQueries({ queryKey: skillsApi.cache.detail(id) })

  return resp
}
