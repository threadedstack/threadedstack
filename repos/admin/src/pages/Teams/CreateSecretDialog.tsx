import { useState } from 'react'
import { createSecret } from '@TAF/actions/secrets'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import {
  Box,
  Alert,
  Button,
  Dialog,
  TextField,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@mui/material'

export type TCreateSecretDialog = {
  open: boolean
  teamId: string
  onClose: () => void
  onSuccess?: () => void
}

export const CreateSecretDialog = ({
  open,
  teamId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TCreateSecretDialog) => {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValue, setShowValue] = useState(false)

  const onClose = () => {
    if (!loading) {
      setName('')
      setValue('')
      setDescription('')
      setError(null)
      setShowValue(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Secret name is required')
      return
    }

    if (!value.trim()) {
      setError('Secret value is required')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createSecret({
      name: name.trim(),
      value: value.trim(),
      teamId,
      description: description.trim() || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError('Failed to create secret. Please try again.')
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const toggleValueVisibility = () => {
    setShowValue((prev) => !prev)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
    >
      <form onSubmit={onSubmit}>
        <DialogTitle>Create New Secret</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert
                severity='error'
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}

            <TextField
              autoFocus
              label='Secret Name'
              placeholder='Enter secret name (e.g., API_KEY)'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <TextField
              label='Secret Value'
              placeholder='Enter secret value'
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              fullWidth
              disabled={loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position='end'>
                    <IconButton
                      onClick={toggleValueVisibility}
                      edge='end'
                      disabled={loading}
                      aria-label={showValue ? 'Hide secret value' : 'Show secret value'}
                    >
                      {showValue ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label='Description'
              placeholder='Enter description (optional)'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              disabled={loading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            variant='contained'
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Secret'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
