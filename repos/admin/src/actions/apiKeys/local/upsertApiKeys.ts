import type { ApiKey } from '@tdsk/domain'
import { getApiKeys, setApiKeys } from '@TAF/state/accessors'

export const upsertApiKeys = (keys: ApiKey[]) => {
  const current = getApiKeys() || {}
  const map = keys.reduce(
    (acc, agent) => {
      acc[agent.id] = agent
      return acc
    },
    {} as Record<string, ApiKey>
  )

  setApiKeys({ ...current, ...map })
}
