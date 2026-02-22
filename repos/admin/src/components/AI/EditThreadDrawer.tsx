import type { Thread } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { useProviders } from '@TAF/state/selectors'
import { Loading, Drawer, DrawerActions } from '@tdsk/components'
import { updateThread } from '@TAF/actions/threads/api/updateThread'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import {
  Stack,
  Alert,
  Select,
  Switch,
  Divider,
  MenuItem,
  TextField,
  Typography,
  InputLabel,
  FormControl,
  FormControlLabel,
} from '@mui/material'

export type TEditThreadDrawerProps = {
  open: boolean
  thread: Thread | null
  onSuccess: () => void
  onClose: () => void
}

export const EditThreadDrawer = (props: TEditThreadDrawerProps) => {
  const { open, thread, onSuccess, onClose: onCloseCB } = props

  const [providers] = useProviders()

  const [name, setName] = useState('')
  const [publicThread, setPublicThread] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (thread) {
      setName(thread.name || '')
      setPublicThread(thread.public || false)
      setSelectedProviderId(thread.providerId || '')
    }
  }, [thread])

  const availableProviders = Object.values(providers || {}).filter(
    (provider) => provider.type === 'ai' && (!thread || provider.orgId === thread.orgId)
  )

  const onClose = () => {
    if (!loading) {
      setName('')
      setPublicThread(false)
      setSelectedProviderId('')
      setError(null)
      onCloseCB?.()
    }
  }

  const onSave = async () => {
    if (!thread || !name.trim()) return

    setLoading(true)
    setError(null)

    const threadData: Partial<Thread> = {
      name: name.trim(),
      public: publicThread,
    }

    if (selectedProviderId) {
      threadData.providerId = selectedProviderId
    }

    const result = await updateThread(thread.orgId, thread.agentId, thread.id, threadData)

    if (result.error) {
      setError(result.error.message)
    } else {
      onSuccess()
      onCloseCB?.()
    }

    setLoading(false)
  }

  const { actions } = useDrawerActions({ onSave, onClose })

  if (!thread) return null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Edit Thread'
      actions={
        <DrawerActions
          editing={true}
          actions={actions}
          loading={loading}
          form='edit-thread-form'
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

          <form id='edit-thread-form'>
            <Stack spacing={3}>
              <TextField
                label='Thread Name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                autoFocus
              />

              <TextField
                label='Thread ID'
                value={thread.id}
                fullWidth
                size='small'
                variant='outlined'
                slotProps={{ input: { readOnly: true } }}
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  },
                }}
              />

              <Divider />

              <FormControl fullWidth>
                <InputLabel id='edit-thread-provider-label'>AI Provider</InputLabel>
                <Select
                  labelId='edit-thread-provider-label'
                  value={selectedProviderId}
                  label='AI Provider'
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                >
                  <MenuItem value=''>
                    <em>None (use agent's primary provider)</em>
                  </MenuItem>
                  {availableProviders.map((provider) => (
                    <MenuItem
                      key={provider.id}
                      value={provider.id}
                    >
                      {provider.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider />

              <FormControlLabel
                control={
                  <Switch
                    checked={publicThread}
                    onChange={(e) => setPublicThread(e.target.checked)}
                  />
                }
                label='Public Thread'
              />
            </Stack>
          </form>
        </>
      )}
    </Drawer>
  )
}
