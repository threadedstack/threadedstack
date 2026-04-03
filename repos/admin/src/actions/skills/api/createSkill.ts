import type { Skill } from '@tdsk/domain'
import { skillsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertSkill } from '@TAF/actions/skills/local/upsertSkill'

export const createSkill = async (orgId: string, data: Partial<Skill>) => {
  const resp = await skillsApi.create(orgId, data)
  if (resp.error) return { error: resp.error }
  resp.data && upsertSkill(resp.data)
  resp.data && query.upsertListCache(skillsApi.cache.list(orgId), resp.data)

  return resp
}
