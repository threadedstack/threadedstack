import type { Provider } from '@tdsk/domain'
import { setProviders as setProvidersState } from '@TAF/state/accessors'

export const setProviders = (providers: Provider[]) => {
  const map = providers.reduce(
    (acc, p) => {
      acc[p.id] = p
      return acc
    },
    {} as Record<string, Provider>
  )

  setProvidersState(map)
}
