import type { CSSProperties } from 'react'

import { useState } from 'react'
import { Box } from '@mui/material'
import { styled } from '@mui/material/styles'
import { Add as AddIcon } from '@mui/icons-material'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import { createOrg } from '@TAF/actions/orgs/api/createOrg'
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
        maxWidth='md'
        onClose={onClose}
        title={
          <>
            <OrgIcon text />
            New Organization
          </>
        }
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
                required
                fullWidth
                value={name}
                label='Name'
                disabled={loading}
                id='create-org-name'
                placeholder='Enter organization name'
                onChange={(e) => setName(e.target.value)}
              />

              <TextInput
                textarea
                fullWidth
                minRows={3}
                disabled={loading}
                label='Description'
                value={description}
                id='create-org-description'
                placeholder='Enter organization description (optional)'
                onChange={(e) => setDescription(e.target.value)}
              />
            </Box>
          </form>
        }
        actions={
          <>
            <Button
              color='error'
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <LoadingButton
              type='submit'
              form='create-org-form'
              loading={loading}
              variant='contained'
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
