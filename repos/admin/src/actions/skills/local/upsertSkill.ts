import type { Skill } from '@tdsk/domain'
import { getSkills, setSkills } from '@TAF/state/accessors'

export const upsertSkill = (skill: Skill) => {
  const current = getSkills() || {}
  setSkills({ ...current, [skill.id]: skill })
}
