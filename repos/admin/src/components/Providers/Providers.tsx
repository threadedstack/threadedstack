import type { Provider } from '@tdsk/domain'

import { useEffect, useState, useMemo } from 'react'
import { Alert } from '@mui/material'
import { useProviders } from '@TAF/state/selectors'
import { fetchProviders } from '@TAF/actions/providers'
import { NoProviders } from '@TAF/components/Providers/NoProviders'
import { ProvidersGrid } from '@TAF/components/Providers/ProvidersGrid'
import { ProviderDrawer } from '@TAF/components/Providers/ProviderDrawer'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'

export type TProviders = {
  orgId: string
}

export const Providers = ({ orgId }: TProviders) => {
  const [providers] = useProviders()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

  useEffect(() => {
    const loadProviders = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const result = await fetchProviders({ orgId })

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadProviders()
  }, [orgId])

  const onCreateProvider = () => {
    setSelectedProvider(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedProvider(null)
  }

  const onEditProvider = (providerId: string) => {
    const provider = providers?.[providerId]
    if (provider) {
      setSelectedProvider(provider)
      setDialogOpen(true)
    }
  }

  const filteredProviders = useMemo(() => {
    const providersArray = providers ? Object.values(providers) : []
    if (!searchQuery.trim()) return providersArray

    const query = searchQuery.toLowerCase()
    return providersArray.filter(
      (provider) =>
        provider.options?.name?.toLowerCase().includes(query) ||
        provider.type?.toLowerCase().includes(query) ||
        provider.options?.baseUrl?.toLowerCase().includes(query) ||
        provider.id?.toLowerCase().includes(query)
    )
  }, [providers, searchQuery])

  const providersCount = providers ? Object.keys(providers).length : 0

  return (
    <PageLayout
      loading={loading}
      searchCount={0}
      countLabel='provider'
      count={providersCount}
      error={error?.message}
      title='Org Providers'
      onAction={providersCount > 0 ? onCreateProvider : undefined}
      actionLabel={providersCount > 0 ? 'Create Provider' : undefined}
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
      query={searchQuery}
      setSearchQuery={setSearchQuery}
      searchPlaceholder='Search providers by name, type, or URL...'
    >
      {providersCount === 0 && <NoProviders onCreate={onCreateProvider} />}

      {providersCount > 0 && filteredProviders.length === 0 && (
        <Alert severity='info'>No providers match your search query.</Alert>
      )}

      {filteredProviders.length > 0 && (
        <ProvidersGrid
          providers={filteredProviders}
          onEdit={onEditProvider}
        />
      )}

      {orgId && (
        <ProviderDrawer
          orgId={orgId}
          open={dialogOpen}
          onClose={onDialogClose}
          provider={selectedProvider}
        />
      )}
    </PageLayout>
  )
}
