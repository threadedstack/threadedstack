import type { Provider } from '@tdsk/domain'

import { ProviderCard } from '@TAF/components/Providers/ProviderCard'
import { CardGrid } from '@TAF/components'

export type TProvidersGrid = {
  providers: Provider[]
  onEdit?: (providerId: string) => void
  readOnly?: boolean
}

export const ProvidersGrid = ({
  providers,
  onEdit,
  readOnly = false,
}: TProvidersGrid) => {
  return (
    <CardGrid
      items={providers}
      renderCard={(provider) => (
        <ProviderCard
          provider={provider}
          onEdit={onEdit}
          readOnly={readOnly}
        />
      )}
      getKey={(provider) => provider.id}
    />
  )
}
