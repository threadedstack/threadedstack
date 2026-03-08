import { getProviders, setProviders } from '@TAF/state/accessors'

export const removeProvider = (id: string) => {
  const current = getProviders() || {}
  const { [id]: _, ...rest } = current
  setProviders(rest)
}
