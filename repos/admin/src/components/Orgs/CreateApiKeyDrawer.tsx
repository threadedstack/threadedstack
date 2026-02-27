import type { TApiKeyScope } from '@tdsk/domain'

import { useState } from 'react'
import { EApiKeyScope } from '@tdsk/domain'
import { createApiKey } from '@TAF/actions/apiKeys'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import VisibilityIcon from '@mui/icons-material/Visibility'
import LocalPoliceIcon from '@mui/icons-material/LocalPolice'
import { Box, Paper, Alert, Typography } from '@mui/material'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { UserSelectorSingle } from '@TAF/components/Selectors/UserSelector'
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline'
import { ApiKeyScopes, ApiKeysExpire, ApiKeyScopeDesc } from '@TAF/constants/values'
import {
  Drawer,
  Button,
  TextInput,
  InputLabel,
  SelectInput,
  ClipboardCopy,
  DrawerActions,
  CheckboxInput,
} from '@tdsk/components'

export type TCreateApiKeyDrawer = {
  orgId: string
  projectId?: string
  userId?: string
  userName?: string
  users?: Array<{ id: string; name: string; email?: string }>
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const ScopeIcons = {
  [EApiKeyScope.read]: VisibilityIcon,
  [EApiKeyScope.admin]: LocalPoliceIcon,
  [EApiKeyScope.write]: DriveFileRenameOutlineIcon,
}

export const CreateApiKeyDrawer = (props: TCreateApiKeyDrawer) => {
  const {
    open,
    orgId,
    projectId,
    userId,
    userName,
    users,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
  } = props

  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<TApiKeyScope[]>([`read`])
  const [expiresIn, setExpiresIn] = useState<string>(`none`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedKey, setGeneratedKey] = useState<string | null>()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const onScopeChange = (scope: TApiKeyScope) =>
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )

  const onSave = async () => {
    if (!name.trim()) return setError(`API key name is required`)

    if (scopes.length === 0) return setError(`At least one scope is required`)

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
        projectId,
        expiresAt,
        name: name.trim(),
        scopes: scopes.join(','),
        userId: userId || selectedUserId || undefined,
      },
    })

    setLoading(false)

    if (result.error) return setError(result.error.message)
    if (result.data?.key) setGeneratedKey(result.data.key)
  }

  const onClose = () => {
    // Only allow closing if we haven't generated a key yet
    // or if the user has explicitly acknowledged the key
    generatedKey && onSuccessCB?.()
    setName(``)
    setScopes([`read`])
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
            disabled={!name.trim() || scopes.length === 0}
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
            <InputLabel>Scopes</InputLabel>
            {ApiKeyScopes.map((scope) => {
              const Icon = ScopeIcons[scope]

              return (
                <Box
                  key={scope}
                  sx={{ mt: 1, display: `flex`, alignItems: `center` }}
                >
                  <CheckboxInput
                    id={scope}
                    sx={{ ml: 0.5 }}
                    label={capitalize(scope)}
                    checked={scopes.includes(scope)}
                    onChange={() => onScopeChange(scope)}
                  />
                  <Typography
                    color='text.secondary'
                    sx={{ fontSize: `12px` }}
                  >
                    {ApiKeyScopeDesc[scope]}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </form>
      )}
    </Drawer>
  )
}

export default CreateApiKeyDrawer
