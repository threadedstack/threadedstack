import type { Thread } from '@tdsk/domain'
import { createThread } from '@TAF/actions/threads/api/createThread'
import { useState } from 'react'
import {
  Box,
  Drawer,
  Button,
  TextField,
  Typography,
  IconButton,
  FormControlLabel,
  Switch,
} from '@mui/material'
import { Close as CloseIcon } from '@mui/icons-material'
import { Loading } from '@tdsk/components'
import { useProviders } from '@TAF/state/selectors'

export type TCreateThreadDrawerProps = {
  open: boolean
  orgId: string
  projectId: string
  onSuccess: () => void
  onClose: () => void
}

export const CreateThreadDrawer = (props: TCreateThreadDrawerProps) => {
  const { open, orgId, projectId, onSuccess, onClose } = props

  const [providers] = useProviders()

  const [name, setName] = useState('')
  const [publicThread, setPublicThread] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projectProviders = Object.values(providers || {}).filter(
    (provider) => provider.projectId === projectId || provider.orgId === orgId
  )

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Thread name is required')
      return
    }

    setLoading(true)
    setError(null)

    const threadData: Partial<Thread> = {
      name: name.trim(),
      public: publicThread,
      projectId,
      userId: '', // Will be set by backend
    }

    if (selectedProviderId) {
      threadData.providerId = selectedProviderId
    }

    const result = await createThread(threadData)

    if (result.error) {
      setError(result.error.message)
    } else {
      setName('')
      setPublicThread(false)
      setSelectedProviderId('')
      onSuccess()
      onClose()
    }

    setLoading(false)
  }

  const handleClose = () => {
    if (!loading) {
      setName('')
      setPublicThread(false)
      setSelectedProviderId('')
      setError(null)
      onClose()
    }
  }

  return (
    <Drawer
      anchor='right'
      open={open}
      onClose={handleClose}
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
          <Typography variant='h6'>Create Thread</Typography>
          <IconButton
            onClick={handleClose}
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
              <Typography
                variant='body2'
                color='error'
                sx={{ mb: 2 }}
              >
                {error}
              </Typography>
            )}

            <TextField
              label='Thread Name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              placeholder='My AI Conversation'
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
              Public threads can be accessed by anyone with the thread ID. Private threads
              require authentication.
            </Typography>

            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant='outlined'
                onClick={handleClose}
                disabled={loading}
                sx={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant='contained'
                onClick={handleSubmit}
                disabled={loading || !name.trim()}
                sx={{ flex: 1 }}
              >
                Create
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
