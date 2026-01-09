import type { Team } from '@tdsk/domain'

import { teamsApi } from '@TAF/services'
import { setTeams, getTeams } from '@TAF/state/accessors'

export type TCreateTeamInput = {
  name: string
  description?: string
}

export type TCreateTeamResult = {
  team?: Team
  error?: Error
}

export const createTeam = async (input: TCreateTeamInput): Promise<TCreateTeamResult> => {
  const resp = await teamsApi.create(input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update teams state with the new team
    const currentTeams = getTeams() || {}
    setTeams({ ...currentTeams, [resp.data.id]: resp.data })
  }

  return { team: resp.data }
}
