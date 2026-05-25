import type { ApiKey } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useState, useMemo } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { EPermResource } from '@tdsk/domain'
import { revokeApiKey } from '@TAF/actions/apiKeys'
import { Box, Typography, Chip, Tooltip } from '@mui/material'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { formatPermissionsSummary } from '@TAF/utils/transforms/scopes'
import { CreateApiKeyDrawer } from '@TAF/components/Orgs/CreateApiKeyDrawer'
import { ConfirmDelete, IconButton, useCopyToClipboard } from '@tdsk/components'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  useApiKeys,
  useActiveOrgId,
  useOrgUsers,
  useActiveOrgRole,
} from '@TAF/state/selectors'
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
  const [orgUsersMap] = useOrgUsers()
  const [activeOrgRole] = useActiveOrgRole()
  const { canCreate, canDelete } = usePermissions()
  const createDisabled = !canCreate(EPermResource.apiKey)
  const deleteDisabled = !canDelete(EPermResource.apiKey)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedApiKey, setSelectedApiKey] = useState<ApiKey | null>(null)

  const orgUsers = useMemo(() => {
    const users = orgUsersMap?.[orgId] || []
    return users.map((u) => ({
      id: u.id,
      name:
        u.displayName || [u.first, u.last].filter(Boolean).join(' ') || u.email || `User`,
      email: u.email,
    }))
  }, [orgUsersMap, orgId])

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
      id: 'permissions',
      label: 'Permissions',
      render: (apiKey) => (
        <Tooltip
          title={apiKey.permissions?.join(`, `) || `No permissions`}
          placement='top'
        >
          <Chip
            size='small'
            variant='outlined'
            color='info'
            label={formatPermissionsSummary(apiKey.permissions)}
          />
        </Tooltip>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (apiKey) => (
        <Chip
          size='small'
          label={apiKey.active ? 'Active' : 'Revoked'}
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
          size='small'
          color='error'
          icon={<DeleteIcon />}
          tooltip='Revoke API Key'
          disabled={!apiKey.active || deleteDisabled}
          disabledTooltip={
            deleteDisabled ? 'You do not have permission to revoke API keys' : undefined
          }
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
        loading={loading}
        query={searchQuery}
        count={apiKeysCount}
        error={error?.message}
        setSearchQuery={setSearchQuery}
        searchCount={filteredApiKeys.length}
        onAction={apiKeysCount > 0 && onCreateApiKey}
        actionLabel={apiKeysCount > 0 && 'Generate API Key'}
        actionDisabled={createDisabled}
        searchPlaceholder='Search API keys by name or prefix...'
        setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
      >
        {apiKeysCount === 0 && (
          <EmptyState
            actionIcon={<AddIcon />}
            onAction={onCreateApiKey}
            actionLabel='Generate API Key'
            actionDisabled={createDisabled}
            message='No API keys yet. Generate your first API key to enable M2M authentication.'
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
            users={orgUsers}
            maxRole={activeOrgRole}
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
