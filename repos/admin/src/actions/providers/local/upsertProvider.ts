import type { Provider } from '@tdsk/domain'
import { getProviders, setProviders } from '@TAF/state/accessors'

export const upsertProvider = (provider: Provider) => {
  const current = getProviders() || {}
  setProviders({ ...current, [provider.id]: provider })
}
