import type { CSSProperties } from 'react'

import { useState } from 'react'
import { Box } from '@mui/material'
import { styled } from '@mui/material/styles'
import { createOrg } from '@TAF/actions/orgs'
import { Add as AddIcon } from '@mui/icons-material'
import { Button, Dialog, TextInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

const CreateBox = styled(Box)`
  display: flex;
  justify-content: end;
`

export type TCreateOrgDialog = {
  open: boolean
  sx?: CSSProperties
  createText?: string
  onClose: () => void
  createSx?: CSSProperties
  createBtnSx?: CSSProperties
  onCreate?: (evt: any) => void
}

export const CreateOrgDialog = (props: TCreateOrgDialog) => {
  const {
    sx,
    open,
    createSx,
    onCreate,
    createBtnSx,
    onClose: onCloseCB,
    createText = `Create`,
  } = props

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
        <CreateBox sx={createSx}>
          <Button
            color='primary'
            sx={createBtnSx}
            onClick={onCreate}
            variant='contained'
            Icon={<AddIcon />}
          >
            {createText}
          </Button>
        </CreateBox>
      )}
      <Dialog
        sx={sx}
        open={open}
        maxWidth='sm'
        onClose={onClose}
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
