import { getApiKeys, setApiKeys } from '@TAF/state/accessors'

export const removeApiKey = (id: string) => {
  const current = getApiKeys() || {}
  const { [id]: _, ...rest } = current
  setApiKeys(rest)
}
