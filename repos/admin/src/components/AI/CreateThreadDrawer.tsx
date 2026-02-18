import type { Thread } from '@tdsk/domain'

import { useState } from 'react'
import { useProviders } from '@TAF/state/selectors'
import { Loading, Drawer, DrawerActions } from '@tdsk/components'
import { createThread } from '@TAF/actions/threads/api/createThread'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import {
  Stack,
  Alert,
  Switch,
  TextField,
  Typography,
  FormControlLabel,
} from '@mui/material'

export type TCreateThreadDrawerProps = {
  open: boolean
  orgId: string
  agentId: string
  onClose?: () => void
  onSuccess?: () => void
}

export const CreateThreadDrawer = (props: TCreateThreadDrawerProps) => {
  const { open, orgId, agentId, onSuccess, onClose: onCloseCB } = props

  const [providers] = useProviders()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [publicThread, setPublicThread] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState(``)

  const availableProviders = Object.values(providers || {}).filter(
    (provider) => provider.type === 'ai' && provider.orgId === orgId
  )

  const onClose = () => {
    if (loading) return

    setName(``)
    setError(null)
    setPublicThread(false)
    setSelectedProviderId('')
    onCloseCB?.()
  }

  const onSave = async () => {
    if (!name.trim()) return setError(`Thread name is required`)

    setLoading(true)
    setError(null)

    const threadData: Partial<Thread> = {
      userId: ``,
      name: name.trim(),
      public: publicThread,
    }

    if (selectedProviderId) threadData.providerId = selectedProviderId

    const result = await createThread(orgId, agentId, threadData)
    setLoading(false)

    if (result.error) return setError(result.error.message)

    setName('')
    setPublicThread(false)
    setSelectedProviderId('')
    onSuccess()
    onCloseCB?.()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Create Thread'
      actions={
        <DrawerActions
          editing={false}
          actions={actions}
          loading={loading}
          form='thread-form'
          disabled={loading || !name.trim()}
        />
      }
    >
      {loading && <Loading />}

      {!loading && (
        <>
          {error && (
            <Alert
              color='error'
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}

          <form id='thread-form'>
            <Stack spacing={3}>
              <TextField
                required
                fullWidth
                autoFocus
                value={name}
                label='Thread Name'
                placeholder='My AI Conversation'
                onChange={(e) => setName(e.target.value)}
              />

              <TextField
                select
                fullWidth
                value={selectedProviderId}
                label='AI Provider'
                onChange={(e) => setSelectedProviderId(e.target.value)}
                SelectProps={{
                  native: true,
                }}
              >
                <option value=''>None (use agent's primary provider)</option>
                {availableProviders.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                  >
                    {provider.name}
                  </option>
                ))}
              </TextField>

              <FormControlLabel
                control={
                  <Switch
                    checked={publicThread}
                    onChange={(e) => setPublicThread(e.target.checked)}
                  />
                }
                label='Public Thread'
              />

              <Typography
                variant='caption'
                color='text.secondary'
              >
                Public threads can be accessed by anyone with the thread ID. Private
                threads require authentication.
              </Typography>
            </Stack>
          </form>
        </>
      )}
    </Drawer>
  )
}
