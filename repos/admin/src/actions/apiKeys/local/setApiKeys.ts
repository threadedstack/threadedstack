import type { ApiKey } from '@tdsk/domain'
import { setApiKeys as setKeys } from '@TAF/state/accessors'

export const setApiKeys = (keys: ApiKey[]) => {
  const map = Object.fromEntries(keys.map((key) => [key.id, key])) as Record<
    string,
    ApiKey
  >
  setKeys(map)
}
