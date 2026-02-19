import type { Provider } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useEffect, useState, useMemo } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { useProviders } from '@TAF/state/selectors'
import { ConfirmDelete } from '@tdsk/components'
import { fetchProviders, deleteProvider } from '@TAF/actions/providers'
import { ProviderDrawer } from '@TAF/components/Providers/ProviderDrawer'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudQueue as ProviderIcon,
} from '@mui/icons-material'

export type TProviders = {
  orgId: string
}

const styles = {
  table: {
    actions: {
      box: {
        gap: 1.5,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `end`,
      },
      icon: { fontSize: `16px` },
    },
  },
}

export const Providers = ({ orgId }: TProviders) => {
  const [providers] = useProviders()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [deleting, setDeleting] = useState<Provider>()

  useEffect(() => {
    const loadProviders = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const result = await fetchProviders({ orgId })
      result.error && setError(result.error)

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

  const onEditProvider = (provider: Provider) => {
    setSelectedProvider(provider)
    setDialogOpen(true)
  }

  const onRemove = async () => {
    if (!deleting) return

    setLoading(true)
    setError(null)

    const result = await deleteProvider({ orgId, id: deleting.id })
    result.error && setError(result.error)

    setLoading(false)
    setDeleting(undefined)
  }

  const filteredProviders = useMemo(() => {
    const providersArray = providers ? Object.values(providers) : []
    if (!searchQuery.trim()) return providersArray

    const query = searchQuery.toLowerCase()
    return providersArray.filter(
      (provider) =>
        provider.name?.toLowerCase().includes(query) ||
        provider.type?.toLowerCase().includes(query) ||
        provider.brand?.toLowerCase().includes(query) ||
        provider.options?.baseUrl?.toLowerCase().includes(query) ||
        provider.id?.toLowerCase().includes(query)
    )
  }, [providers, searchQuery])

  const providersCount = providers ? Object.keys(providers).length : 0

  const columns: TDataTableColumn<Provider>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (provider) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ProviderIcon sx={{ color: 'text.secondary' }} />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {provider.name || 'Unnamed Provider'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'type',
      label: 'Type',
      render: (provider) => (
        <Chip
          label={provider.type}
          size='small'
          color='primary'
          variant='outlined'
        />
      ),
    },
    {
      id: 'providerBrand',
      label: 'Provider',
      render: (provider) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {provider.brand || '\u2014'}
        </Typography>
      ),
    },
    {
      id: 'baseUrl',
      label: 'Base URL',
      render: (provider) => (
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{
            maxWidth: 250,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {provider.options?.baseUrl || '\u2014'}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (provider) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            tooltip='Edit Provider'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onEditProvider(provider)
            }}
          />
          <ActionIconButton
            tooltip='Delete Provider'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            size='small'
            color='error'
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(provider)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <PageLayout
      loading={loading}
      searchCount={0}
      countLabel='provider'
      count={providersCount}
      error={error?.message}
      title='Org Providers'
      onAction={providersCount > 0 && onCreateProvider}
      actionLabel={providersCount > 0 && 'Create Provider'}
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
      query={searchQuery}
      setSearchQuery={setSearchQuery}
      searchPlaceholder='Search providers by name, type, or URL...'
    >
      {!error && providersCount === 0 && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateProvider}
          actionLabel='Create Provider'
          message='No providers yet. Create your first provider to get started.'
        />
      )}

      {!error && providersCount > 0 && filteredProviders.length === 0 && (
        <EmptyState message='No providers match your search query.' />
      )}

      {!error && filteredProviders.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredProviders}
          onRowClick={onEditProvider}
          getRowKey={(provider) => provider.id}
        />
      )}

      {orgId && (
        <ProviderDrawer
          orgId={orgId}
          open={dialogOpen}
          onClose={onDialogClose}
          onRemove={setDeleting}
          provider={selectedProvider}
        />
      )}

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          itemName={deleting?.name || `Provider`}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </PageLayout>
  )
}
