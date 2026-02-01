import type { Thread } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { useProviders } from '@TAF/state/selectors'
import { Close as CloseIcon } from '@mui/icons-material'
import { Loading, Drawer, DrawerActions } from '@tdsk/components'
import { updateThread } from '@TAF/actions/threads/api/updateThread'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import {
  Box,
  Alert,
  Switch,
  TextField,
  Typography,
  IconButton,
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

  const projectProviders = Object.values(providers || {}).filter(
    (provider) =>
      !thread ||
      provider.projectId === thread.projectId ||
      provider.orgId === thread.orgId
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

    const result = await updateThread(thread.id, threadData)

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
      <Box sx={{ width: 400, p: 3 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 3,
          }}
        >
          <Typography variant='h6'>Edit Thread</Typography>
          <IconButton
            onClick={onClose}
            disabled={loading}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <Loading />
          </Box>
        )}

        {!loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {error && (
              <Alert
                color='error'
                sx={{ mb: 2 }}
              >
                {error}
              </Alert>
            )}

            <form id='edit-thread-form'>
              <TextField
                label='Thread Name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                autoFocus
              />

              <TextField
                label='AI Provider (Optional)'
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
                fullWidth
                select
                SelectProps={{
                  native: true,
                }}
              >
                <option value=''>None</option>
                {projectProviders.map((provider) => (
                  <option
                    key={provider.id}
                    value={provider.id}
                  >
                    {provider.name} ({provider.type})
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
                Thread ID: {thread.id}
              </Typography>
            </form>
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
