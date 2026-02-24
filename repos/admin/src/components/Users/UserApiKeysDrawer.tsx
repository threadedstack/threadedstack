import type { User, ApiKey } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import {
  Add as AddIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

import { apiKeysApi } from '@TAF/services'
import { Drawer, Button, ConfirmDelete } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingSpinner } from '@TAF/components/LoadingSpinner/LoadingSpinner'
import { CreateApiKeyDrawer } from '@TAF/components/Orgs/CreateApiKeyDrawer'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'

export type TUserApiKeysDrawer = {
  user: User
  orgId: string
  open: boolean
  onClose: () => void
}

const styles = {
  actions: {
    gap: 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'end',
  },
  icon: { fontSize: '16px' },
  empty: {
    py: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}

const getUserName = (user: User) =>
  user.displayName ||
  [user.first, user.last].filter(Boolean).join(' ') ||
  user.email ||
  'User'

export const UserApiKeysDrawer = (props: TUserApiKeysDrawer) => {
  const { user, orgId, open, onClose } = props

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  const userName = getUserName(user)

  const loadKeys = useCallback(async () => {
    if (!open || !orgId || !user?.id) return

    setLoading(true)
    setError(null)

    const resp = await apiKeysApi.list(orgId, { userId: user.id })

    if (resp.error) setError(resp.error.message)
    else setKeys(resp.data || [])

    setLoading(false)
  }, [open, orgId, user?.id])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const onRevoke = async () => {
    if (!revokingKey) return

    setRevokeLoading(true)
    const resp = await apiKeysApi.revoke(orgId, revokingKey.id)

    if (resp.error) setError(resp.error.message)
    else await loadKeys()

    setRevokeLoading(false)
    setRevokingKey(null)
  }

  const onCreateSuccess = () => {
    setCreateOpen(false)
    loadKeys()
  }

  const columns: TDataTableColumn<ApiKey>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (key) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon
            sx={styles.icon}
            color='action'
          />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {key.name}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'prefix',
      label: 'Prefix',
      render: (key) => (
        <Typography
          variant='body2'
          fontFamily='monospace'
        >
          {key.keyPrefix}
        </Typography>
      ),
    },
    {
      id: 'scopes',
      label: 'Scopes',
      render: (key) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {key.scopes?.split(',').map((scope) => (
            <Chip
              key={scope}
              label={scope.trim()}
              size='small'
              variant='outlined'
            />
          ))}
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (key) => (
        <Chip
          size='small'
          label={key.active ? 'Active' : 'Revoked'}
          color={key.active ? 'success' : 'default'}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (key) => (
        <Box sx={styles.actions}>
          <ActionIconButton
            tooltip='Revoke Key'
            icon={<DeleteIcon sx={styles.icon} />}
            size='small'
            color='error'
            disabled={!key.active}
            disabledTooltip='Key already revoked'
            onClick={(e) => {
              e.stopPropagation()
              setRevokingKey(key)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={`API Keys \u2014 ${userName}`}
        actions={
          <Button
            color='primary'
            variant='contained'
            startIcon={<AddIcon />}
            onClick={() => setCreateOpen(true)}
          >
            Create Key
          </Button>
        }
      >
        {error && (
          <ErrorAlert
            sx={{ mb: 2 }}
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {loading && <LoadingSpinner />}

        {!loading && !error && keys.length === 0 && (
          <Box sx={styles.empty}>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              This user has no API keys yet.
            </Typography>
          </Box>
        )}

        {!loading && keys.length > 0 && (
          <DataTable
            size='small'
            columns={columns}
            data={keys}
            getRowKey={(key) => key.id}
          />
        )}
      </Drawer>

      <CreateApiKeyDrawer
        orgId={orgId}
        userId={user.id}
        userName={userName}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={onCreateSuccess}
      />

      <ConfirmDelete
        title='Revoke API Key?'
        confirmText='Revoke'
        open={Boolean(revokingKey)}
        deleting={revokeLoading}
        itemName={revokingKey?.name || ''}
        onCancel={() => setRevokingKey(null)}
        onConfirm={onRevoke}
        text={`Are you sure you want to revoke the API key "${revokingKey?.name}"? This action cannot be undone.`}
      />
    </>
  )
}

export default UserApiKeysDrawer
