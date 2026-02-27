import type { ApiKey } from '@tdsk/domain'
import { setApiKeys as setKeys } from '@TAF/state/accessors'

export const setApiKeys = (keys: ApiKey[]) => {
  const map = keys.reduce(
    (acc, agent) => {
      acc[agent.id] = agent
      return acc
    },
    {} as Record<string, ApiKey>
  )
  setKeys(map)
}
