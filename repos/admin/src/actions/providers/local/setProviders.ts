import type { Provider } from '@tdsk/domain'
import { setProviders as setProvidersState } from '@TAF/state/accessors'

export const setProviders = (providers: Provider[]) => {
  setProvidersState(
    Object.fromEntries(providers.map((p) => [p.id, p])) as Record<string, Provider>
  )
}
