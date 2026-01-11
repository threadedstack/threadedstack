import { useState } from 'react'
import { createOrg } from '@TAF/actions/orgs'
import {
  Box,
  Alert,
  Dialog,
  Button,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TCreateOrgDialog = {
  open: boolean
  onClose: () => void
}

export const CreateOrgDialog = ({ open, onClose }: TCreateOrgDialog) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClose = () => {
    if (!loading) {
      setName('')
      setDescription('')
      setError(null)
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Organization name is required')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createOrg({
      name: name.trim(),
      description: description.trim() || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError('Failed to create organization. Please try again.')
    } else {
      handleClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='sm'
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>New Organization</DialogTitle>
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
              label='Organization Name'
              placeholder='Enter organization name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <TextField
              label='Description'
              placeholder='Enter organization description (optional)'
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
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            variant='contained'
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
