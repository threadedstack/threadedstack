import { useState } from 'react'
import { Box, Button, TextField } from '@mui/material'
import { Dialog } from '@tdsk/components'
import { createOrg } from '@TAF/actions/orgs'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

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
      title='New Organization'
      content={
        <form
          id='create-org-form'
          onSubmit={handleSubmit}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <ErrorAlert
                message={error}
                onClose={() => setError(null)}
              />
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
        </form>
      }
      actions={
        <>
          <Button
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <LoadingButton
            type='submit'
            form='create-org-form'
            variant='contained'
            loading={loading}
            loadingText='Creating...'
          >
            Create
          </LoadingButton>
        </>
      }
    />
  )
}
