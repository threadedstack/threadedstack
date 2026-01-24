import type { ApiKey } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { Page } from '@TAF/pages/Page/Page'
import { useApiKeys } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Box, Typography, Chip } from '@mui/material'
import { fetchApiKeys, revokeApiKey } from '@TAF/actions/apiKeys'
import { CreateApiKeyDrawer } from '@TAF/pages/Orgs/CreateApiKeyDrawer'
import { ConfirmDelete, IconButton, useCopyToClipboard } from '@tdsk/components'
import {
  Add as AddIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import {
  SearchBar,
  DataTable,
  PageHeader,
  ErrorAlert,
  EmptyState,
  LoadingSpinner,
  ActionIconButton,
} from '@TAF/components'

export type TOrgApiKeys = {}

export const OrgApiKeys = (props: TOrgApiKeys) => {
  const [apiKeys] = useApiKeys()
  const [orgId] = useActiveOrgId()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load org API keys
  useEffect(() => {
    const loadApiKeys = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const result = await fetchApiKeys({ orgId })

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadApiKeys()
  }, [orgId])

  const onCreateApiKey = () => {
    setCreateDialogOpen(true)
  }

  const onDialogClose = () => {
    setCreateDialogOpen(false)
  }

  const onApiKeyCreated = async () => {
    if (!orgId) return

    setLoading(true)
    setError(null)

    const result = await fetchApiKeys({ orgId })
    result.error ? setError(result.error) : setError(null)

    setLoading(false)
  }

  const onDeleteClick = (apiKey: ApiKey) => {
    setSelectedApiKey(apiKey)
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!selectedApiKey) return

    setLoading(true)
    const result = await revokeApiKey(selectedApiKey.id)

    if (result.error) {
      setError(result.error)
    }

    setDeleteDialogOpen(false)
    setSelectedApiKey(null)
    setLoading(false)
  }

  const onDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setSelectedApiKey(null)
  }

  const { onCopyToClipBoard } = useCopyToClipboard()

  const filteredApiKeys = useMemo(() => {
    const keysArray = apiKeys ? Object.values(apiKeys) : []
    if (!searchQuery.trim()) return keysArray

    const query = searchQuery.toLowerCase()
    return keysArray.filter(
      (key) =>
        key.name?.toLowerCase().includes(query) ||
        key.keyPrefix?.toLowerCase().includes(query) ||
        key.id?.toLowerCase().includes(query)
    )
  }, [apiKeys, searchQuery])

  const apiKeysCount = apiKeys ? Object.keys(apiKeys).length : 0

  const getScopeChipColor = (
    scope: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' => {
    switch (scope.toLowerCase()) {
      case 'admin':
        return 'error'
      case 'write':
        return 'warning'
      case 'read':
        return 'info'
      default:
        return 'default'
    }
  }

  const columns: TDataTableColumn<ApiKey>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (apiKey) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon sx={{ color: 'text.secondary' }} />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {apiKey.name}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'keyPrefix',
      label: 'Key Prefix',
      render: (apiKey) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant='body2'
            fontFamily='monospace'
            color='text.secondary'
          >
            {apiKey.keyPrefix}...
          </Typography>
          <IconButton
            size='small'
            tooltip='Copy prefix'
            Icon={CopyIcon}
            iconProps={{ fontSize: 'small' }}
            onClick={(e) => {
              e.stopPropagation()
              onCopyToClipBoard(apiKey.keyPrefix)
            }}
          />
        </Box>
      ),
    },
    {
      id: 'scopes',
      label: 'Scopes',
      render: (apiKey) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {apiKey.scopes?.split(',').map((scope) => (
            <Chip
              key={scope}
              label={scope.trim()}
              size='small'
              color={getScopeChipColor(scope.trim())}
              variant='outlined'
            />
          ))}
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (apiKey) => (
        <Chip
          label={apiKey.active ? 'Active' : 'Revoked'}
          size='small'
          color={apiKey.active ? 'success' : 'default'}
          variant={apiKey.active ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      id: 'expiresAt',
      label: 'Expires',
      render: (apiKey) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {apiKey.expiresAt ? new Date(apiKey.expiresAt).toLocaleDateString() : 'Never'}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (apiKey) => (
        <ActionIconButton
          tooltip='Revoke API Key'
          icon={<DeleteIcon />}
          size='small'
          color='error'
          disabled={!apiKey.active}
          onClick={(e) => {
            e.stopPropagation()
            onDeleteClick(apiKey)
          }}
        />
      ),
    },
  ]

  return (
    <Page className='tdsk-org-api-keys-page'>
      <PageHeader
        title='API Keys'
        count={apiKeysCount}
        countLabel='key'
        actionLabel='Generate API Key'
        actionIcon={<AddIcon />}
        onAction={onCreateApiKey}
      />

      {!loading && apiKeysCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search API keys by name or prefix...'
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {error && (
        <ErrorAlert
          message={`Error loading API keys: ${error.message}`}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {!loading && !error && apiKeysCount === 0 && (
        <EmptyState
          message='No API keys yet. Generate your first API key to enable M2M authentication.'
          actionLabel='Generate Your First API Key'
          actionIcon={<AddIcon />}
          onAction={onCreateApiKey}
        />
      )}

      {!loading && !error && apiKeysCount > 0 && filteredApiKeys.length === 0 && (
        <EmptyState message='No API keys match your search query.' />
      )}

      {!loading && !error && filteredApiKeys.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredApiKeys}
          getRowKey={(apiKey) => apiKey.id}
        />
      )}

      {orgId && (
        <CreateApiKeyDrawer
          orgId={orgId}
          open={createDialogOpen}
          onClose={onDialogClose}
          onSuccess={onApiKeyCreated}
        />
      )}

      {deleteDialogOpen && (
        <ConfirmDelete
          confirmText='Revoke'
          onCancel={onDeleteCancel}
          onConfirm={onDeleteConfirm}
          itemName={selectedApiKey?.name}
          text={`Are you sure you want to revoke the API key "${selectedApiKey?.name}"? This action cannot be undone and any applications using this key will lose access.`}
        />
      )}
    </Page>
  )
}

export default OrgApiKeys
