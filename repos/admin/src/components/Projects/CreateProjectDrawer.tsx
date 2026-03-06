import { useState } from 'react'
import { Box } from '@mui/material'
import { useActiveOrgId } from '@TAF/state/selectors'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, TextInput, DrawerActions } from '@tdsk/components'
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

  const [name, setName] = useState(``)
  const [description, setDescription] = useState(``)
  const [gitUrl, setGitUrl] = useState(``)
  const [branch, setBranch] = useState(`main`)
  const { loading, error, setError, clearError, run } = useAsyncAction()
  const [orgId] = useActiveOrgId()

  const onClose = () => {
    if (loading) return

    setName(``)
    setDescription(``)
    setGitUrl(``)
    setBranch(`main`)
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
        branch: branch.trim() || `main`,
        gitUrl: gitUrl.trim() || undefined,
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

          <TextInput
            fullWidth
            label='Git URL'
            value={gitUrl}
            disabled={loading}
            id='tdsk-project-git-url'
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder='https://github.com/user/repo.git (optional)'
          />

          <TextInput
            fullWidth
            label='Branch'
            value={branch}
            disabled={loading}
            id='tdsk-project-branch'
            onChange={(e) => setBranch(e.target.value)}
            placeholder='Enter git branch name (i.e. main)'
          />
        </Box>
      </form>
    </Drawer>
  )
}
