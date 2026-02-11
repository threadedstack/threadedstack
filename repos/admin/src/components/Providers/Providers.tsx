import type { Provider } from '@tdsk/domain'

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Box, Alert, Button } from '@mui/material'
import { useProviders } from '@TAF/state/selectors'
import { fetchProviders } from '@TAF/actions/providers'
import { NoProviders } from '@TAF/components/Providers/NoProviders'
import { ProvidersGrid } from '@TAF/components/Providers/ProvidersGrid'
import { ProviderDrawer } from '@TAF/components/Providers/ProviderDrawer'
import { Settings as SettingsIcon } from '@mui/icons-material'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'

export type TProviders = {
  orgId: string
  projectId?: string
  readOnly?: boolean
}

export const Providers = ({ orgId, projectId, readOnly = false }: TProviders) => {
  const navigate = useNavigate()
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

      const result = await fetchProviders({ orgId, projectId })

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

  const onDialogSuccess = async () => {
    if (orgId) {
      setLoading(true)
      await fetchProviders({ orgId, projectId })
      setLoading(false)
    }
  }

  const onEditProvider = (providerId: string) => {
    const provider = providers?.[providerId]
    if (provider) {
      setSelectedProvider(provider)
      setDialogOpen(true)
    }
  }

  const onManageProviders = () => {
    if (orgId) {
      navigate(`/orgs/${orgId}/providers`)
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
      title={readOnly ? 'Project Providers' : 'Org Providers'}
      onAction={!readOnly && providersCount > 0 ? onCreateProvider : undefined}
      actionLabel={!readOnly && providersCount > 0 ? 'Create Provider' : undefined}
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
      {...(!readOnly && {
        query: searchQuery,
        setSearchQuery,
        searchPlaceholder: 'Search providers by name, type, or URL...',
      })}
    >
      {readOnly && projectId && (
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant='outlined'
            startIcon={<SettingsIcon />}
            onClick={onManageProviders}
          >
            Manage Org Providers
          </Button>
        </Box>
      )}

      {readOnly && projectId && (
        <Alert
          severity='info'
          sx={{ mb: 3 }}
        >
          Providers are org-scoped and shared across all projects in the org. This page
          shows all providers available to this project.
        </Alert>
      )}

      {!readOnly && providersCount === 0 && <NoProviders onCreate={onCreateProvider} />}

      {readOnly && providersCount === 0 && (
        <Alert severity='info'>No providers configured for this org.</Alert>
      )}

      {providersCount > 0 && filteredProviders.length === 0 && (
        <Alert severity='info'>No providers match your search query.</Alert>
      )}

      {filteredProviders.length > 0 && (
        <ProvidersGrid
          providers={filteredProviders}
          onEdit={readOnly ? undefined : onEditProvider}
          readOnly={readOnly}
        />
      )}

      {orgId && !readOnly && (
        <ProviderDrawer
          open={dialogOpen}
          orgId={orgId}
          provider={selectedProvider}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
        />
      )}
    </PageLayout>
  )
}
