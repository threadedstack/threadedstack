import type { Team } from '@tdsk/domain'

import { teamsApi } from '@TAF/services'
import { setTeams } from '@TAF/state/accessors'

export type TFetchTeamsResult = {
  teams?: Record<string, Team>
  error?: Error
}

export const fetchTeams = async (): Promise<TFetchTeamsResult> => {
  const resp = await teamsApi.list()

  if (resp.error) {
    return { error: resp.error }
  }

  const teamsMap =
    resp.data?.reduce((acc: Record<string, Team>, team: Team) => {
      acc[team.id] = team
      return acc
    }, {}) || {}

  setTeams(teamsMap)
  return { teams: teamsMap }
}
