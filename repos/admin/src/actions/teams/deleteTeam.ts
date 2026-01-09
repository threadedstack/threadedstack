import { teamsApi } from '@TAF/services'
import { setTeams, getTeams } from '@TAF/state/accessors'

export type TDeleteTeamResult = {
  success?: boolean
  error?: Error
}

export const deleteTeam = async (id: string): Promise<TDeleteTeamResult> => {
  const resp = await teamsApi.delete(id)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove team from state
  const currentTeams = getTeams() || {}
  const { [id]: removed, ...remainingTeams } = currentTeams
  setTeams(remainingTeams)

  return { success: true }
}
