import type { Endpoint } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { createEndpoint, updateEndpoint, deleteEndpoint } from '@TAF/actions/endpoints'
import {
  Box,
  Alert,
  Select,
  Switch,
  Button,
  Dialog,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
} from '@mui/material'

export type TEndpointDialog = {
  open: boolean
  projectId: string
  endpoint?: Endpoint | null
  onClose: () => void
  onSuccess?: () => void
}

// TODO: move to domain repo constants enum
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

export const EndpointDialog = ({
  open,
  projectId,
  endpoint,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TEndpointDialog) => {
  const isEditMode = Boolean(endpoint)

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [method, setMethod] = useState<string>('GET')
  const [publicEndpoint, setPublicEndpoint] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Pre-populate form with endpoint data in edit mode
  useEffect(() => {
    if (endpoint) {
      setName(endpoint.name || '')
      setPath(endpoint.url || '')
      setMethod(endpoint.method || 'GET')
      setPublicEndpoint(endpoint.public || false)
      setError(null)
      setShowDeleteConfirm(false)
    } else {
      // Reset form in create mode
      setName('')
      setPath('')
      setMethod('GET')
      setPublicEndpoint(false)
      setError(null)
      setShowDeleteConfirm(false)
    }
  }, [endpoint])

  const onClose = () => {
    if (!loading) {
      setName('')
      setPath('')
      setMethod('GET')
      setPublicEndpoint(false)
      setError(null)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Endpoint name is required')
      return
    }

    if (!path.trim()) {
      setError('Proxy URL is required')
      return
    }

    setLoading(true)
    setError(null)

    const result =
      isEditMode && endpoint
        ? await updateEndpoint(endpoint.id, {
            name: name.trim(),
            path: path.trim(),
            method,
            config: {
              public: publicEndpoint,
            },
          })
        : await createEndpoint({
            name: name.trim(),
            path: path.trim(),
            method,
            projectId,
            config: {
              public: publicEndpoint,
            },
          })

    setLoading(false)

    if (result.error) {
      const errorMessage = isEditMode
        ? 'Failed to update endpoint. Please try again.'
        : 'Failed to create endpoint. Please try again.'
      setError(result.error.message || errorMessage)
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const onDelete = async () => {
    if (!endpoint) {
      return
    }

    setLoading(true)
    setError(null)

    const result = await deleteEndpoint(endpoint.id)

    setLoading(false)

    if (result.error) {
      setError(result.error.message || 'Failed to delete endpoint. Please try again.')
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
        <DialogTitle>{isEditMode ? 'Edit Endpoint' : 'Create New Endpoint'}</DialogTitle>
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
                Are you sure you want to delete "{name}"?
              </Alert>
            )}

            <TextField
              autoFocus
              label='Endpoint Name'
              placeholder='Enter endpoint name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
              helperText='A descriptive name for this endpoint'
            />

            <TextField
              label='Proxy URL'
              placeholder='https://api.example.com/v1/users'
              value={path}
              onChange={(e) => setPath(e.target.value)}
              required
              fullWidth
              disabled={loading}
              helperText='The URL to proxy requests to'
            />

            <FormControl
              fullWidth
              required
              disabled={loading}
            >
              <InputLabel id='method-select-label'>HTTP Method</InputLabel>
              <Select
                labelId='method-select-label'
                value={method}
                label='HTTP Method'
                onChange={(e) => setMethod(e.target.value)}
              >
                {HTTP_METHODS.map((m) => (
                  <MenuItem
                    key={m}
                    value={m}
                  >
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={publicEndpoint}
                  onChange={(e) => setPublicEndpoint(e.target.checked)}
                  disabled={loading}
                />
              }
              label='Public Endpoint'
            />
            <Box sx={{ ml: 4, mt: -1 }}>
              <Alert
                severity='info'
                sx={{ fontSize: '0.875rem' }}
              >
                {publicEndpoint
                  ? 'This endpoint will be accessible without authentication'
                  : 'This endpoint will require authentication to access'}
              </Alert>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions
          sx={isEditMode ? { justifyContent: 'space-between', px: 3, pb: 2 } : undefined}
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
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              ml: isEditMode ? 'auto' : undefined,
            }}
          >
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
                  : 'Create Endpoint'}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  )
}
