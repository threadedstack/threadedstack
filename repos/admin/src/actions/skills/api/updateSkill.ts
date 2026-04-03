import type { Skill } from '@tdsk/domain'
import { skillsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertSkill } from '@TAF/actions/skills/local/upsertSkill'

export const updateSkill = async (orgId: string, id: string, data: Partial<Skill>) => {
  const resp = await skillsApi.update(orgId, id, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertSkill(resp.data)
  resp.data && query.upsertListCache(skillsApi.cache.list(orgId), resp.data)
  resp.data && query.updateDetailCache(skillsApi.cache.detail(id), resp.data)

  return resp
}
