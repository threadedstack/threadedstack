import type { Skill } from '@tdsk/domain'
import { setSkills as setSkillsState } from '@TAF/state/accessors'

export const setSkills = (skills: Skill[]) => {
  const map = skills.reduce(
    (acc, skill) => {
      acc[skill.id] = skill
      return acc
    },
    {} as Record<string, Skill>
  )

  setSkillsState(map)
}
