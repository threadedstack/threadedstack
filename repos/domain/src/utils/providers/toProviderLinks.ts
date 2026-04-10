import type { TProviderLink } from '@TDM/types'
import { Provider } from '@TDM/models/provider'

export const toProviderLinks = (links?: TProviderLink[]): TProviderLink[] => {
  return (links || [])
    .filter((link) => link?.provider)
    .map((link) => ({
      ...link,
      provider:
        link.provider instanceof Provider ? link.provider : new Provider(link.provider),
    }))
}
