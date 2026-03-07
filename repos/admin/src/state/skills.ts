import type { Skill } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const skillsState = atomWithReset<Record<string, Skill>>(undefined)
export const activeSkillIdState = atomWithReset<string>(undefined)
