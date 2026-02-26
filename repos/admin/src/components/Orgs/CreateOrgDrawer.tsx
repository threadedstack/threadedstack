import type { SxProps, Theme } from '@mui/material'

import { useState } from 'react'
import { Box } from '@mui/material'
import { styled } from '@mui/material/styles'
import { Add as AddIcon } from '@mui/icons-material'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import { createOrg } from '@TAF/actions/orgs/api/createOrg'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useAsyncAction } from '@TAF/hooks/components/useAsyncAction'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Button, Drawer, DrawerActions, TextInput } from '@tdsk/components'

const CreateBox = styled(Box)`
  display: flex;
  justify-content: end;
`

export type TCreateOrgDrawer = {
  open: boolean
  sx?: SxProps<Theme>
  createText?: string
  onClose: () => void
  hideCreate?: boolean
  createSx?: SxProps<Theme>
  createBtnSx?: SxProps<Theme>
  onCreate?: (evt: any) => void
}

export const CreateOrgDrawer = (props: TCreateOrgDrawer) => {
  const {
    sx,
    open,
    createSx,
    onCreate,
    hideCreate,
    createBtnSx,
    onClose: onCloseCB,
    createText = `Create`,
  } = props

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const { loading, error, setError, clearError, run } = useAsyncAction()

  const onClose = () => {
    if (!loading) {
      setName('')
      setDescription('')
      clearError()
      onCloseCB?.()
    }
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Organization name is required`)

    const result = await run(() =>
      createOrg({
        name: name.trim(),
        description: description.trim() || undefined,
      })
    )

    if (result?.error) {
      setError(`Failed to create organization. Please try again.`)
    } else {
      onClose()
    }
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  return (
    <>
      {!hideCreate && onCreate && (
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
      <Drawer
        sx={sx}
        open={open}
        onClose={onClose}
        title={
          <>
            <OrgIcon text />
            New Organization
          </>
        }
        data-testid='create-org-dialog'
        actions={
          <DrawerActions
            editing={false}
            actions={actions}
            loading={loading}
            disabled={loading}
            form='create-org-form'
          />
        }
      >
        <form id='create-org-form'>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <ErrorAlert
                message={error}
                onClose={clearError}
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
      </Drawer>
    </>
  )
}
