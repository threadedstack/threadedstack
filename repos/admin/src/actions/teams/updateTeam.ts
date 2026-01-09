import type { Team } from '@tdsk/domain'

import { teamsApi } from '@TAF/services'
import { setTeams, getTeams } from '@TAF/state/accessors'

export type TUpdateTeamInput = {
  name?: string
  description?: string
}

export type TUpdateTeamResult = {
  team?: Team
  error?: Error
}

export const updateTeam = async (
  id: string,
  input: TUpdateTeamInput
): Promise<TUpdateTeamResult> => {
  const resp = await teamsApi.update(id, input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update teams state with the updated team
    const currentTeams = getTeams() || {}
    setTeams({ ...currentTeams, [resp.data.id]: resp.data })
  }

  return { team: resp.data }
}
