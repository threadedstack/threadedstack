import { useState } from 'react'
import { createApiKey } from '@TAF/actions/apiKeys'
import { ERoleType, RoleHierarchy } from '@tdsk/domain'
import { Box, Paper, Alert, Typography } from '@mui/material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { UserSelectorSingle } from '@TAF/components/Selectors/UserSelector'
import { ApiKeyRoles, ApiKeyRoleDesc, ApiKeysExpire } from '@TAF/constants/values'
import {
  Drawer,
  Button,
  TextInput,
  InputLabel,
  SelectInput,
  ClipboardCopy,
  DrawerActions,
} from '@tdsk/components'

export type TCreateApiKeyDrawer = {
  orgId: string
  projectId?: string
  userId?: string
  userName?: string
  users?: Array<{ id: string; name: string; email?: string }>
  maxRole?: string
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const CreateApiKeyDrawer = (props: TCreateApiKeyDrawer) => {
  const {
    open,
    orgId,
    projectId,
    userId,
    userName,
    users,
    maxRole,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const maxRoleLevel = maxRole
    ? RoleHierarchy.indexOf(maxRole as ERoleType)
    : RoleHierarchy.indexOf(ERoleType.admin)

  const [name, setName] = useState('')
  const [role, setRole] = useState<string>(ERoleType.viewer)
  const [expiresIn, setExpiresIn] = useState<string>(`none`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const onSave = async () => {
    if (!name.trim()) return setError(`API key name is required`)

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
        role,
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

  const onClose = () => {
    generatedKey && onSuccessCB?.()
    setName(``)
    setRole(ERoleType.viewer)
    setExpiresIn(`none`)
    setError(null)
    setGeneratedKey(null)
    setSelectedUserId(null)
    onCloseCB?.()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  const onDone = () => {
    onSuccessCB?.()
    onClose()
  }

  const roleItems = ApiKeyRoles.map((r) => {
    const roleLevel = RoleHierarchy.indexOf(r.value as ERoleType)
    const disabled = roleLevel > maxRoleLevel || roleLevel < 0
    return { ...r, disabled }
  })

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
            disabled={!name.trim()}
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
              <InputLabel>User</InputLabel>
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
            <SelectInput
              label='Role'
              value={role}
              disabled={loading}
              items={roleItems}
              id='tdsk-api-key-role'
              onChange={(e) => setRole(e.target.value)}
            />
            {ApiKeyRoleDesc[role] && (
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ display: 'block', mt: 0.5 }}
              >
                {ApiKeyRoleDesc[role]}
              </Typography>
            )}
          </Box>
        </form>
      )}
    </Drawer>
  )
}

export default CreateApiKeyDrawer
