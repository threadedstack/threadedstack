import type { TPermission } from '@tdsk/domain'

import { createApiKey } from '@TAF/actions/apiKeys'
import { ApiKeysExpire } from '@TAF/constants/values'
import { useState, useMemo, useCallback } from 'react'
import { Box, Paper, Alert, Typography } from '@mui/material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { UserSelectorSingle } from '@TAF/components/Selectors/UserSelector'
import { ERoleType, EPermScope, buildScopedPermissions } from '@tdsk/domain'
import { PermissionsPicker } from '@TAF/components/Permissions/PermissionsPicker'
import {
  Drawer,
  Button,
  TextInput,
  SelectInput,
  ClipboardCopy,
  DrawerActions,
} from '@tdsk/components'

export type TCreateApiKeyDrawer = {
  orgId: string
  open: boolean
  userId?: string
  maxRole?: string
  userName?: string
  projectId?: string
  onClose: () => void
  onSuccess?: () => void
  users?: Array<{ id: string; name: string; email?: string }>
}

export const CreateApiKeyDrawer = (props: TCreateApiKeyDrawer) => {
  const {
    open,
    orgId,
    users,
    userId,
    maxRole,
    userName,
    projectId,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const availablePermissions = useMemo(() => {
    const role = (maxRole as ERoleType) || ERoleType.admin
    const scope = projectId ? EPermScope.project : EPermScope.org
    return buildScopedPermissions(role, scope)
  }, [maxRole, projectId])

  const [name, setName] = useState('')
  const [permissions, setPermissions] = useState<TPermission[]>([])
  const [expiresIn, setExpiresIn] = useState<string>(`none`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const onSave = async () => {
    if (!name.trim()) return setError(`API key name is required`)
    if (permissions.length === 0) return setError(`Select at least one permission`)

    setLoading(true)
    setError(null)

    let expiresAt: Date | undefined
    if (expiresIn) {
      const days = Number.parseInt(expiresIn, 10)
      if (!isNaN(days) && days > 0)
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    }

    const result = await createApiKey({
      orgId,
      data: {
        permissions,
        projectId,
        expiresAt,
        name: name.trim(),
        userId: userId || selectedUserId || undefined,
      },
    })

    setLoading(false)

    if (result.error) return setError(result.error.message)
    if (result.data?.key) setGeneratedKey(result.data.key)
  }

  const onClose = useCallback(() => {
    generatedKey && onSuccessCB?.()
    setName(``)
    setPermissions([])
    setExpiresIn(`none`)
    setError(null)
    setGeneratedKey(null)
    setSelectedUserId(null)
    onCloseCB?.()
  }, [generatedKey, onSuccessCB, onCloseCB])

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  const onDone = () => {
    onSuccessCB?.()
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Generate API Key'
      actions={
        generatedKey ? (
          <Button
            color='primary'
            onClick={onDone}
            variant='contained'
          >
            Done
          </Button>
        ) : (
          <DrawerActions
            editing={false}
            actions={actions}
            loading={loading}
            form='api-key-form'
            cancelDisabled={false}
            disabled={!name.trim() || permissions.length === 0}
          />
        )
      }
    >
      {generatedKey ? (
        <>
          <Alert
            sx={{ mb: 3 }}
            severity='warning'
          >
            <Typography variant='body2'>
              Make sure to copy your API key now. You won't be able to see it again!
            </Typography>
          </Alert>

          <Paper
            variant='outlined'
            sx={{
              p: 2,
              gap: 1,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography
              variant='body2'
              fontFamily='monospace'
              sx={{
                flex: 1,
                wordBreak: 'break-all',
                fontSize: '0.875rem',
              }}
            >
              {generatedKey}
            </Typography>
            <ClipboardCopy value={generatedKey} />
          </Paper>

          <Typography
            variant='caption'
            color='text.secondary'
            sx={{ display: 'block', mt: 2 }}
          >
            Use this key in the Authorization header:{' '}
            <code>
              Authorization: Bearer {'{'}your_key{'}'}
            </code>
          </Typography>
        </>
      ) : (
        <form id='api-key-form'>
          {error && (
            <ErrorAlert
              sx={{ mb: 2 }}
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {userId && userName && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='caption'
                color='text.secondary'
                fontWeight={600}
              >
                User
              </Typography>
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {userName}
              </Typography>
            </Box>
          )}

          {!userId && users && users.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <UserSelectorSingle
                users={users}
                userId={selectedUserId}
                onChange={setSelectedUserId}
              />
            </Box>
          )}

          <TextInput
            autoFocus
            fullWidth
            value={name}
            label='Key Name'
            disabled={loading}
            id='tdsk-api-key-name'
            placeholder='e.g., Production API Key'
            onChange={(e) => setName(e.target.value)}
          />

          <SelectInput
            sx={{ mt: 2 }}
            label='Expiration'
            value={expiresIn}
            disabled={loading}
            items={ApiKeysExpire}
            id='tdsk-api-key-expiration'
            onChange={(e) => setExpiresIn(e.target.value)}
          />

          <Box sx={{ mt: 2 }}>
            <PermissionsPicker
              disabled={loading}
              selected={permissions}
              onChange={setPermissions}
              available={availablePermissions}
            />
          </Box>
        </form>
      )}
    </Drawer>
  )
}

export default CreateApiKeyDrawer
