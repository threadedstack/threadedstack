import { teamsApi } from '@TAF/services'
import { setTeams } from '@TAF/state/accessors'

export const fetchTeams = async () => {
  const resp = await teamsApi.list()

  if (resp.error) return { error: resp.error }

  resp.data && setTeams(resp.data)
  return resp
}
