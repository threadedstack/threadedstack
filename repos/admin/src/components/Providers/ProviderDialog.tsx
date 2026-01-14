import type { Provider, TProviderType } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { ProviderTypes } from '@TAF/constants/providers'
import { createProvider, updateProvider, deleteProvider } from '@TAF/actions/providers'
import {
  Box,
  Alert,
  Select,
  Button,
  Dialog,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TProviderDialog = {
  open: boolean
  orgId: string
  provider?: Provider | null
  onClose: () => void
  onSuccess?: () => void
}

export const ProviderDialog = ({
  open,
  orgId,
  provider,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TProviderDialog) => {
  const isEditMode = Boolean(provider)

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Pre-populate form in edit mode
  useEffect(() => {
    if (provider) {
      const options = provider.options || {}
      setName(options.name || '')
      setType(provider.type || '')
      setBaseUrl(options.baseUrl || '')
      setError(null)
      setShowDeleteConfirm(false)
    } else {
      // Reset form in create mode
      setName('')
      setType('')
      setBaseUrl('')
      setError(null)
      setShowDeleteConfirm(false)
    }
  }, [provider])

  const onClose = () => {
    if (loading) return

    setName('')
    setType('')
    setBaseUrl('')
    setError(null)
    setShowDeleteConfirm(false)
    onCloseCB?.()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Provider name is required')
      return
    }

    if (!type) {
      setError('Provider type is required')
      return
    }

    setLoading(true)
    setError(null)

    const providerType = type as TProviderType
    const providerData = {
      type: providerType,
      options: {
        name: name.trim(),
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
      },
    }

    const result =
      isEditMode && provider
        ? await updateProvider(provider.id, providerData)
        : await createProvider({ orgId, ...providerData })

    setLoading(false)

    if (result.error) {
      setError(
        `Failed to ${isEditMode ? 'update' : 'create'} provider. Please try again.`
      )
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const onDelete = async () => {
    if (!provider) return

    setLoading(true)
    setError(null)

    const result = await deleteProvider(provider.id)

    setLoading(false)

    if (result.error) {
      setError('Failed to delete provider. Please try again.')
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
    >
      <form onSubmit={onSubmit}>
        <DialogTitle>{isEditMode ? 'Edit Provider' : 'Create New Provider'}</DialogTitle>
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

            {isEditMode && showDeleteConfirm && (
              <Alert
                severity='warning'
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      color='inherit'
                      size='small'
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      color='inherit'
                      size='small'
                      onClick={onDelete}
                      disabled={loading}
                    >
                      {loading ? 'Deleting...' : 'Confirm'}
                    </Button>
                  </Box>
                }
              >
                Are you sure you want to delete "
                {provider?.options?.name || 'this provider'}"?
              </Alert>
            )}

            <TextField
              autoFocus
              label='Provider Name'
              placeholder='Enter provider name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <FormControl
              fullWidth
              required
              disabled={loading}
            >
              <InputLabel id='provider-type-label'>Provider Type</InputLabel>
              <Select
                labelId='provider-type-label'
                value={type}
                label='Provider Type'
                onChange={(e) => setType(e.target.value)}
              >
                {ProviderTypes.map((providerType) => (
                  <MenuItem
                    key={providerType.value}
                    value={providerType.value}
                  >
                    {providerType.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label='Base URL'
              placeholder='https://api.example.com (optional)'
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              fullWidth
              disabled={loading}
              helperText='Optional: Custom API base URL for the provider'
            />
          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            justifyContent: isEditMode ? 'space-between' : 'flex-end',
            px: 3,
            pb: 2,
          }}
        >
          {isEditMode && (
            <Button
              color='error'
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || showDeleteConfirm}
            >
              Delete
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              variant='contained'
              disabled={loading || showDeleteConfirm}
            >
              {loading
                ? isEditMode
                  ? 'Saving...'
                  : 'Creating...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Provider'}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  )
}
