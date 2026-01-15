import { useState } from 'react'
import { createOrg } from '@TAF/actions/orgs'
import { Add as AddIcon } from '@mui/icons-material'
import { Box, Button } from '@mui/material'
import { Dialog, TextInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

export type TCreateOrgDialog = {
  open: boolean
  createText?: string
  onClose: () => void
  onCreate?: (evt: any) => void
}

export const CreateOrgDialog = (props: TCreateOrgDialog) => {
  const { open, onCreate, onClose: onCloseCB, createText = `Create` } = props

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
        title='New Organization'
        data-testid='create-org-dialog'
        content={
          <form
            id='create-org-form'
            onSubmit={onSubmit}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {error && (
                <ErrorAlert
                  message={error}
                  onClose={() => setError(null)}
                />
              )}

              <TextInput
                autoFocus
                id='create-org-name'
                label='Organization Name'
                placeholder='Enter organization name'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                fullWidth
                disabled={loading}
              />

              <TextInput
                label='Description'
                id='create-org-description'
                placeholder='Enter organization description (optional)'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                textarea
                minRows={3}
                fullWidth
                disabled={loading}
              />
            </Box>
          </form>
        }
        actions={
          <>
            <Button
              onClick={onClose}
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
    </>
  )
}
