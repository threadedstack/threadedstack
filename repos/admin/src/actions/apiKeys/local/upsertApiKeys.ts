import type { ApiKey } from '@tdsk/domain'
import { getApiKeys, setApiKeys } from '@TAF/state/accessors'

export const upsertApiKeys = (keys: ApiKey[]) => {
  const current = getApiKeys() || {}
  const map = Object.fromEntries(keys.map((key) => [key.id, key])) as Record<
    string,
    ApiKey
  >
  setApiKeys({ ...current, ...map })
}
