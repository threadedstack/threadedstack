import type { Provider } from '@tdsk/domain'

import { ProviderCard } from '@TAF/components/Providers/ProviderCard'
import { CardGrid } from '@TAF/components'

export type TProvidersGrid = {
  providers: Provider[]
  onEdit?: (providerId: string) => void
}

export const ProvidersGrid = ({ providers, onEdit }: TProvidersGrid) => {
  return (
    <CardGrid
      items={providers}
      renderCard={(provider) => (
        <ProviderCard
          provider={provider}
          onEdit={onEdit}
        />
      )}
      getKey={(provider) => provider.id}
    />
  )
}
