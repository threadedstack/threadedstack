import type { Secret } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { ConfirmDeleteAlert } from '@TAF/components'
import { updateSecret, deleteSecret } from '@TAF/actions/secrets'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import {
  Box,
  Alert,
  Dialog,
  Button,
  TextField,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@mui/material'

export type TEditSecretDialog = {
  open: boolean
  secret: Secret | null
  onClose: () => void
  onSuccess?: () => void
}

export const EditSecretDialog = ({
  open,
  secret,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TEditSecretDialog) => {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValue, setShowValue] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (secret) {
      setName(secret.hashKey || secret.name || '')
      setValue('')
      setError(null)
      setShowValue(false)
      setShowDeleteConfirm(false)
    }
  }, [secret])

  const onClose = () => {
    if (!loading) {
      setName('')
      setValue('')
      setError(null)
      setShowValue(false)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!secret) {
      return
    }

    if (!name.trim()) {
      setError('Secret name is required')
      return
    }

    setLoading(true)
    setError(null)

    const updateData: { name?: string; value?: string } = {
      name: name.trim(),
    }

    const val = value.trim()
    if (val) updateData.value = val

    const result = await updateSecret(secret.id, updateData)

    setLoading(false)

    if (result.error) {
      setError('Failed to update secret. Please try again.')
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const onDelete = async () => {
    if (!secret) return

    setLoading(true)
    setError(null)

    const result = await deleteSecret(secret.id)

    setLoading(false)

    if (result.error) {
      setError('Failed to delete secret. Please try again.')
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const toggleValueVisibility = () => {
    setShowValue((prev) => !prev)
  }

  return (
    <Dialog
      fullWidth
      open={open}
      maxWidth='sm'
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <DialogTitle>Edit Secret</DialogTitle>
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

            {showDeleteConfirm && (
              <ConfirmDeleteAlert
                loading={loading}
                onConfirm={onDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                itemName={secret?.hashKey || secret?.name || ''}
              />
            )}

            <TextField
              required
              fullWidth
              autoFocus
              value={name}
              disabled={loading}
              label='Secret Name'
              placeholder='Enter secret name (e.g., API_KEY)'
              onChange={(e) => setName(e.target.value)}
            />

            <TextField
              fullWidth
              value={value}
              disabled={loading}
              label='New Secret Value'
              type={showValue ? 'text' : 'password'}
              onChange={(e) => setValue(e.target.value)}
              placeholder='Enter new value (leave empty to keep current)'
              helperText='Leave empty to keep the current value'
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
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button
            color='error'
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading || showDeleteConfirm}
          >
            Delete
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              disabled={loading}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              variant='contained'
              disabled={loading || showDeleteConfirm}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  )
}
