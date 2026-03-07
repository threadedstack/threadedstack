import { getSkills, setSkills } from '@TAF/state/accessors'

export const removeSkill = (id: string) => {
  const current = getSkills() || {}
  const { [id]: _, ...rest } = current
  setSkills(rest)
}
