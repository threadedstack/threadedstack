import { skillsApi } from '@TAF/services'
import { removeSkill } from '@TAF/actions/skills/local/removeSkill'

export const deleteSkill = async (orgId: string, id: string) => {
  const resp = await skillsApi.delete(orgId, id)
  if (resp.error) return { error: resp.error }
  removeSkill(id)

  return resp
}
