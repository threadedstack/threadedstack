import type { ApiKey } from '@tdsk/domain'
import { getApiKeys, setApiKeys } from '@TAF/state/accessors'

export const upsertApiKey = (key: ApiKey) => {
  const current = getApiKeys() || {}
  setApiKeys({ ...current, [key.id]: key })
}
