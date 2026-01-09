import type { Team } from '@tdsk/domain'

import { teamsApi } from '@TAF/services'
import { setTeams, getTeams } from '@TAF/state/accessors'

export type TFetchTeamResult = {
  team?: Team
  error?: Error
}

export const fetchTeam = async (id: string): Promise<TFetchTeamResult> => {
  const resp = await teamsApi.get(id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update teams state with the fetched team
    const currentTeams = getTeams() || {}
    setTeams({ ...currentTeams, [resp.data.id]: resp.data })
  }

  return { team: resp.data }
}
