import { useState } from 'react'
import { createOrg } from '@TAF/actions/orgs'
import { Add as AddIcon } from '@mui/icons-material'
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
  createText?: string
  onClose: () => void
  onCreate?: (evt: any) => void
}

export const CreateOrgDialog = (props: TCreateOrgDialog) => {
  const { open, onCreate, onClose: onCloseCB, createText = `Create New` } = props

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (!loading) {
      setName('')
      setDescription('')
      setError(null)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
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
      setError(`Failed to create organization. Please try again.`)
    } else {
      onClose()
    }
  }

  return (
    <>
      {onCreate && (
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            color='primary'
            variant='outlined'
            startIcon={<AddIcon />}
            onClick={onCreate}
          >
            {createText}
          </Button>
        </Box>
      )}
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth='sm'
        fullWidth
      >
        <form onSubmit={onSubmit}>
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
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  )
}
