import type { Team } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const teamsState = atomWithReset<Record<string, Team>>(undefined)
export const activeTeamIdState = atomWithReset<string>(undefined)
