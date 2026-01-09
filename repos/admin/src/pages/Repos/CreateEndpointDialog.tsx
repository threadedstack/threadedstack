import { useState } from 'react'
import { createEndpoint } from '@TAF/actions/endpoints'
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

export type TCreateEndpointDialog = {
  open: boolean
  repoId: string
  onClose: () => void
  onSuccess?: () => void
}

// TODO: move to domain repo constants enum
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

export const CreateEndpointDialog = ({
  open,
  repoId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TCreateEndpointDialog) => {
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [method, setMethod] = useState<string>('GET')
  const [publicEndpoint, setPublicEndpoint] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (!loading) {
      setName('')
      setPath('')
      setMethod('GET')
      setPublicEndpoint(false)
      setError(null)
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

    const result = await createEndpoint({
      name: name.trim(),
      path: path.trim(),
      method,
      repoId,
      config: {
        public: publicEndpoint,
      },
    })

    setLoading(false)

    if (result.error) {
      setError(result.error.message || 'Failed to create endpoint. Please try again.')
    } else {
      onClose()
      onSuccessCB?.()
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
        <DialogTitle>Create New Endpoint</DialogTitle>
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
            {loading ? 'Creating...' : 'Create Endpoint'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
