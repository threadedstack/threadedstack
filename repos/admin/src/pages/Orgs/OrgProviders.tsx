import type { Provider } from '@tdsk/domain'

import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useProviders } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { setActiveOrgId } from '@TAF/state/accessors'
import { fetchProviders } from '@TAF/actions/providers'
import { EditProviderDialog } from './EditProviderDialog'
import { CreateProviderDialog } from './CreateProviderDialog'
import {
  Add as AddIcon,
  Edit as EditIcon,
  CloudQueue as ProviderIcon,
} from '@mui/icons-material'
import {
  SearchBar,
  PageHeader,
  EmptyState,
  LoadingSpinner,
  ErrorAlert,
  CardGrid,
  ItemCard,
  ActionIconButton,
} from '@TAF/components'

export type TOrgProviders = {}

export const OrgProviders = (props: TOrgProviders) => {
  const { orgId } = useParams<{ orgId: string }>()
  const [providers] = useProviders()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

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
    setCreateDialogOpen(true)
  }

  const onCreateSuccess = async () => {
    if (orgId) {
      setLoading(true)
      await fetchProviders({ orgId })
      setLoading(false)
    }
  }

  const onEditProvider = (providerId: string) => {
    const provider = providers?.[providerId]
    if (provider) {
      setSelectedProvider(provider)
      setEditDialogOpen(true)
    }
  }

  const onEditSuccess = async () => {
    if (orgId) {
      setLoading(true)
      await fetchProviders({ orgId })
      setLoading(false)
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

  const renderProviderCard = (provider: Provider) => (
    <ItemCard
      onClick={() => onEditProvider(provider.id)}
      actionsPosition='left'
      actions={
        <ActionIconButton
          tooltip='Edit Provider'
          icon={<EditIcon />}
          size='small'
          color='primary'
          onClick={(e) => {
            e.stopPropagation()
            onEditProvider(provider.id)
          }}
        />
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <ProviderIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography
          variant='h6'
          component='h2'
        >
          {provider.options?.name || 'Unnamed Provider'}
        </Typography>
      </Box>

      {provider.type && (
        <Chip
          label={provider.type}
          size='small'
          color='primary'
          variant='outlined'
          sx={{ mb: 1 }}
        />
      )}

      {provider.options?.baseUrl && (
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{ mb: 1, wordBreak: 'break-all' }}
        >
          {provider.options.baseUrl}
        </Typography>
      )}

      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ mt: 1, display: 'block' }}
      >
        ID: {provider.id}
      </Typography>
    </ItemCard>
  )

  return (
    <Page className='tdsk-org-providers-page'>
      <PageHeader
        title='Org Providers'
        count={providersCount}
        countLabel='provider'
        actionLabel='Create Provider'
        actionIcon={<AddIcon />}
        onAction={onCreateProvider}
      />

      {!loading && providersCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search providers by name, type, or URL...'
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {error && (
        <ErrorAlert
          message={`Error loading providers: ${error.message}`}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {!loading && !error && providersCount === 0 && (
        <EmptyState
          message='No providers yet. Create your first provider to get started.'
          actionLabel='Create Your First Provider'
          actionIcon={<AddIcon />}
          onAction={onCreateProvider}
        />
      )}

      {!loading && !error && providersCount > 0 && filteredProviders.length === 0 && (
        <EmptyState message='No providers match your search query.' />
      )}

      {!loading && !error && filteredProviders.length > 0 && (
        <CardGrid
          items={filteredProviders}
          renderCard={renderProviderCard}
          getKey={(provider) => provider.id}
        />
      )}

      {orgId && (
        <>
          <CreateProviderDialog
            orgId={orgId}
            open={createDialogOpen}
            onSuccess={onCreateSuccess}
            onClose={() => setCreateDialogOpen(false)}
          />
          <EditProviderDialog
            open={editDialogOpen}
            provider={selectedProvider}
            onClose={() => {
              setEditDialogOpen(false)
              setSelectedProvider(null)
            }}
            onSuccess={onEditSuccess}
          />
        </>
      )}
    </Page>
  )
}

export default OrgProviders
