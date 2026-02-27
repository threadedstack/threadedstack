import type { User, TRoleType, ApiKey } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useState, useEffect, useCallback } from 'react'
import { getInitials } from '@TAF/utils/user/getInitials'
import { RoleSelect } from '@TAF/components/Roles/RoleSelect'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { updateOrgRole } from '@TAF/actions/users/updateOrgRole'
import { fetchApiKeys, revokeApiKey } from '@TAF/actions/apiKeys'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { CreateApiKeyDrawer } from '@TAF/components/Orgs/CreateApiKeyDrawer'
import { LoadingSpinner } from '@TAF/components/LoadingSpinner/LoadingSpinner'
import { Box, Avatar, Typography, Chip, Tab, Tabs, Alert } from '@mui/material'
import { Drawer, DrawerActions, Button, ConfirmDelete } from '@tdsk/components'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  VpnKey as KeyIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

type TActiveTab = 'role' | 'apiKeys'

export type TEditUserDrawer = {
  user: User
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
  onRemove: (user: User) => void
  initialTab?: TActiveTab
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

export const EditUserDrawer = (props: TEditUserDrawer) => {
  const {
    open,
    user,
    orgId,
    onRemove,
    initialTab = 'role',
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const [activeTab, setActiveTab] = useState<TActiveTab>(initialTab)

  // Role tab state
  const [roleLoading, setRoleLoading] = useState(false)
  const [roleSuccess, setRoleSuccess] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)
  const [roleType, setRoleType] = useState<TRoleType>(user.role as TRoleType)

  // API Keys tab state
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [keysLoading, setKeysLoading] = useState(false)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [keysError, setKeysError] = useState<string | null>(null)
  const [revokingKey, setRevokingKey] = useState<ApiKey | null>(null)

  const userName = getUserName(user)

  // Reset role state when user changes
  useEffect(() => {
    setRoleType(user.role as TRoleType)
    setRoleError(null)
    setRoleSuccess(false)
  }, [user])

  // Load API keys
  const loadKeys = useCallback(async () => {
    if (!open || !orgId || !user?.id) return

    setKeysLoading(true)
    setKeysError(null)

    const resp = await fetchApiKeys({ orgId, userId: user.id, store: false })

    if (resp.error) setKeysError(resp.error.message)
    else setKeys(Object.values(resp.data || {}))

    setKeysLoading(false)
  }, [open, orgId, user?.id])

  useEffect(() => {
    loadKeys()
  }, [loadKeys])

  const onClose = () => {
    if (roleLoading) return

    setRoleError(null)
    setRoleSuccess(false)
    setKeysError(null)
    setActiveTab(initialTab)
    onCloseCB?.()
  }

  // Role tab: save handler
  const onSave = async (evt: any) => {
    evt.preventDefault()

    setRoleLoading(true)
    setRoleError(null)
    setRoleSuccess(false)

    const resp = await updateOrgRole(orgId, user.id, roleType)
    setRoleLoading(false)

    if (resp.error) {
      setRoleError(resp.error.message || `Failed to update role. Please try again.`)
    } else {
      setRoleSuccess(true)
      onSuccessCB?.()
    }
  }

  const { actions: roleActions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: () => onRemove(user),
  })

  // API Keys tab: revoke handler
  const onRevoke = async () => {
    if (!revokingKey) return

    setRevokeLoading(true)
    const resp = await revokeApiKey({ orgId, id: revokingKey.id })

    if (resp.error) setKeysError(resp.error.message)
    else await loadKeys()

    setRevokeLoading(false)
    setRevokingKey(null)
  }

  const onCreateSuccess = () => {
    setCreateOpen(false)
    loadKeys()
  }

  const keyColumns: TDataTableColumn<ApiKey>[] = [
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

  const drawerActions =
    activeTab === 'role' ? (
      <DrawerActions
        editing={true}
        actions={roleActions}
        loading={roleLoading}
        disabled={roleLoading}
        form='edit-role-form'
      />
    ) : (
      <Button
        color='primary'
        variant='contained'
        startIcon={<AddIcon />}
        onClick={() => setCreateOpen(true)}
      >
        Create Key
      </Button>
    )

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title='Edit User'
        actions={drawerActions}
      >
        {/* User header */}
        <Box
          sx={{
            p: 2,
            gap: 2,
            display: 'flex',
            borderRadius: 1,
            alignItems: 'center',
            bgcolor: 'action.hover',
          }}
        >
          <Avatar
            src={user.image}
            sx={{ width: 48, height: 48 }}
          >
            {getInitials(user)}
          </Avatar>
          <Box>
            <Typography
              variant='subtitle1'
              fontWeight='medium'
            >
              {user.displayName}
            </Typography>
            <Typography
              variant='body2'
              color='text.secondary'
            >
              {user.email}
            </Typography>
          </Box>
        </Box>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ mt: 2, mb: 2, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            label='Role'
            value='role'
          />
          <Tab
            label='API Keys'
            value='apiKeys'
          />
        </Tabs>

        {/* Role tab */}
        {activeTab === 'role' && (
          <form id='edit-role-form'>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {roleError && (
                <ErrorAlert
                  message={roleError}
                  onClose={() => setRoleError(null)}
                />
              )}

              {roleSuccess && (
                <Alert
                  severity='success'
                  onClose={() => setRoleSuccess(false)}
                >
                  Role updated successfully.
                </Alert>
              )}

              <RoleSelect
                showAlert
                disabled={roleLoading}
                roleType={roleType}
                onChange={(e) => setRoleType(e.target.value as TRoleType)}
              />
            </Box>
          </form>
        )}

        {/* API Keys tab */}
        {activeTab === 'apiKeys' && (
          <>
            {keysError && (
              <ErrorAlert
                sx={{ mb: 2 }}
                message={keysError}
                onClose={() => setKeysError(null)}
              />
            )}

            {keysLoading && <LoadingSpinner />}

            {!keysLoading && !keysError && keys.length === 0 && (
              <Box sx={styles.empty}>
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  This user has no API keys yet.
                </Typography>
              </Box>
            )}

            {!keysLoading && keys.length > 0 && (
              <DataTable
                size='small'
                columns={keyColumns}
                data={keys}
                getRowKey={(key) => key.id}
              />
            )}
          </>
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

export default EditUserDrawer
