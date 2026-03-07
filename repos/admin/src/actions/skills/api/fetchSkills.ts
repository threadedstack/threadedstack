import { skillsApi } from '@TAF/services'
import { setSkills } from '@TAF/actions/skills/local/setSkills'

export const fetchSkills = async (orgId: string) => {
  const resp = await skillsApi.list(orgId)
  if (resp.error) return { error: resp.error }
  resp.data && setSkills(resp.data)

  return resp
}
