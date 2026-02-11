import type { ApiKey } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { Page } from '@TAF/pages/Page/Page'
import { useApiKeys } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { useActiveOrgId } from '@TAF/state/selectors'
import { Box, Typography, Chip } from '@mui/material'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { fetchApiKeys, revokeApiKey } from '@TAF/actions/apiKeys'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { CreateApiKeyDrawer } from '@TAF/components/Orgs/CreateApiKeyDrawer'
import { ConfirmDelete, IconButton, useCopyToClipboard } from '@tdsk/components'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'

import {
  Add as AddIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'

export type TOrgApiKeys = {}

export const OrgApiKeys = (props: TOrgApiKeys) => {
  const [apiKeys] = useApiKeys()
  const [orgId] = useActiveOrgId()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null)

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

  const onDeleteClick = (apiKey: ApiKey) => {
    setSelectedApiKey(apiKey)
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!selectedApiKey) return

    setLoading(true)
    const result = await revokeApiKey({ orgId, id: selectedApiKey.id })
    result.error && setError(result.error)

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
      <PageLayout
        title='API Keys'
        countLabel='key'
        count={apiKeysCount}
        error={error?.message}
        loading={loading}
        query={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder='Search API keys by name or prefix...'
        searchCount={0}
        onAction={apiKeysCount > 0 && onCreateApiKey}
        actionLabel={apiKeysCount > 0 && 'Generate API Key'}
        setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
      >
        {apiKeysCount === 0 && (
          <EmptyState
            message='No API keys yet. Generate your first API key to enable M2M authentication.'
            actionLabel='Generate API Key'
            actionIcon={<AddIcon />}
            onAction={onCreateApiKey}
          />
        )}

        {apiKeysCount > 0 && filteredApiKeys.length === 0 && (
          <EmptyState message='No API keys match your search query.' />
        )}

        {filteredApiKeys.length > 0 && (
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
      </PageLayout>
    </Page>
  )
}

export default OrgApiKeys
