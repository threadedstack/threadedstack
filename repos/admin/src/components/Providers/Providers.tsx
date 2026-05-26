import type { Provider } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useState, useMemo } from 'react'
import { EPermResource } from '@tdsk/domain'
import { useProviders } from '@TAF/state/selectors'
import { Box, Typography, Chip } from '@mui/material'
import { deleteProvider } from '@TAF/actions/providers'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { ConfirmDelete, DataTableSkeleton } from '@tdsk/components'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { ProviderDrawer } from '@TAF/components/Providers/ProviderDrawer'
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

const skeletonColumns = [
  { id: `name`, label: `Name` },
  { id: `type`, label: `Type` },
  { id: `providerBrand`, label: `Provider` },
  { id: `baseUrl`, label: `Base URL` },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const Providers = ({ orgId }: TProviders) => {
  const [providers] = useProviders()
  const isInitialLoading = providers === undefined
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Provider>()
  const [error, setError] = useState<Error | null>(null)
  const { canCreate, canUpdate, canDelete } = usePermissions()
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)

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

    setLoading(false)
    setDeleting(undefined)

    if (result.error) {
      const details = (result.error as any)?.details
      const msg =
        typeof details?.error === `string` ? details.error : result.error.message
      setError(new Error(msg))
    }
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
            size='small'
            color='primary'
            tooltip='Edit Provider'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            disabled={!canUpdate(EPermResource.provider)}
            disabledTooltip='You do not have permission to edit providers'
            onClick={(e) => {
              e.stopPropagation()
              onEditProvider(provider)
            }}
          />
          <ActionIconButton
            size='small'
            color='error'
            tooltip='Delete Provider'
            disabled={!canDelete(EPermResource.provider)}
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            disabledTooltip='You do not have permission to delete providers'
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
      searchCount={0}
      loading={loading}
      query={searchQuery}
      countLabel='provider'
      title='Org Providers'
      error={error?.message}
      setSearchQuery={setSearchQuery}
      onAction={providersCount > 0 && onCreateProvider}
      actionDisabled={!canCreate(EPermResource.provider)}
      actionLabel={providersCount > 0 && 'Create Provider'}
      count={isInitialLoading ? undefined : providersCount}
      searchPlaceholder='Search providers by name, type, or URL...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && providersCount === 0 && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateProvider}
          actionLabel='Create Provider'
          actionDisabled={!canCreate(EPermResource.provider)}
          message='No providers yet. Create your first provider to get started.'
        />
      )}

      {!isInitialLoading &&
        !error &&
        providersCount > 0 &&
        filteredProviders.length === 0 && (
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
          onRemove={setDeleting}
          onClose={onDialogClose}
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
