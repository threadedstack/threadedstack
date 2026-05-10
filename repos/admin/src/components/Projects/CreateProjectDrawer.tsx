import { useState } from 'react'
import { Box } from '@mui/material'
import { useActiveOrgId } from '@TAF/state/selectors'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, ProjectIcon, TextInput, DrawerActions } from '@tdsk/components'
import { useAsyncAction } from '@TAF/hooks/components/useAsyncAction'
import { createProject } from '@TAF/actions/projects/api/createProject'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'

export type TCreateProjectDrawer = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const CreateProjectDrawer = (props: TCreateProjectDrawer) => {
  const { open, onClose: onCloseCB, onSuccess: onSuccessCB } = props

  const [orgId] = useActiveOrgId()
  const [name, setName] = useState(``)
  const [description, setDescription] = useState(``)
  const { loading, error, setError, clearError, run } = useAsyncAction()

  const onClose = () => {
    if (loading) return

    setName(``)
    setDescription(``)
    clearError()
    onCloseCB?.()
  }

  const onSave = async (e: any) => {
    e.preventDefault()

    if (!orgId) return setError(`Org selection is required`)

    const short = name.trim()
    if (!short) return setError(`Project name is required`)

    const result = await run(() =>
      createProject({
        orgId,
        name: short,
        description: description.trim() || undefined,
      })
    )

    if (result?.error) return setError(`Failed to create project. Please try again.`)

    onSuccessCB?.()
    onClose()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      titleIcon={<ProjectIcon />}
      title={name || `New Project`}
      actions={
        <DrawerActions
          editing={false}
          actions={actions}
          loading={loading}
          form='create-project-form'
          disabled={loading || !name.trim()}
        />
      }
    >
      <form id='create-project-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={clearError}
            />
          )}

          <TextInput
            required
            autoFocus
            fullWidth
            label='Name'
            disabled={loading}
            id='tdsk-project-name'
            placeholder='Enter project name'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <TextInput
            fullWidth
            multiline
            minRows={2}
            label='Description'
            value={description}
            disabled={loading}
            id='tdsk-project-description'
            placeholder='Enter project description (optional)'
            onChange={(e) => setDescription(e.target.value)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
