import type { Skill } from '@tdsk/domain'
import { setSkills as setSkillsState } from '@TAF/state/accessors'

export const setSkills = (skills: Skill[]) => {
  setSkillsState(Object.fromEntries(skills.map((s) => [s.id, s])))
}
