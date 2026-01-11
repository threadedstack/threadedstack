import type { TProviderType } from '@tdsk/domain'
import { useState } from 'react'
import { createProvider } from '@TAF/actions/providers'
import { ProviderTypes } from '@TAF/constants/providers'
import {
  Box,
  Alert,
  Dialog,
  Select,
  Button,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TCreateProviderDialog = {
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess?: () => void
}

export const CreateProviderDialog = ({
  open,
  orgId,
  onSuccess,
  onClose: onCloseCB,
}: TCreateProviderDialog) => {
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (loading) return

    setName('')
    setType('')
    setBaseUrl('')
    setError(null)
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
    const result = await createProvider({
      orgId,
      type: providerType,
      options: {
        name: name.trim(),
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
      },
    })

    setLoading(false)

    if (result.error) {
      setError('Failed to create provider. Please try again.')
    } else {
      if (onSuccess) {
        onSuccess()
      }
      onCloseCB()
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
        <DialogTitle>Create New Provider</DialogTitle>
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
            {loading ? 'Creating...' : 'Create Provider'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
