import type { Thread } from '@tdsk/domain'

import { useState } from 'react'
import { useProviders } from '@TAF/state/selectors'
import { Close as CloseIcon } from '@mui/icons-material'
import { Loading, Drawer, DrawerActions } from '@tdsk/components'
import { createThread } from '@TAF/actions/threads/api/createThread'
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

export type TCreateThreadDrawerProps = {
  open: boolean
  orgId: string
  projectId: string
  onClose?: () => void
  onSuccess?: () => void
}

export const CreateThreadDrawer = (props: TCreateThreadDrawerProps) => {
  const { open, orgId, projectId, onSuccess, onClose: onCloseCB } = props

  const [providers] = useProviders()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [publicThread, setPublicThread] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState(``)

  const projectProviders = Object.values(providers || {}).filter(
    (provider) => provider.projectId === projectId || provider.orgId === orgId
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
      projectId,
      userId: ``,
      name: name.trim(),
      public: publicThread,
    }

    if (selectedProviderId) threadData.providerId = selectedProviderId

    const result = await createThread(threadData)
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

            <form id='thread-form'>
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
                label='AI Provider (Optional)'
                onChange={(e) => setSelectedProviderId(e.target.value)}
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
                Public threads can be accessed by anyone with the thread ID. Private
                threads require authentication.
              </Typography>
            </form>
          </Box>
        )}
      </Box>
    </Drawer>
  )
}
