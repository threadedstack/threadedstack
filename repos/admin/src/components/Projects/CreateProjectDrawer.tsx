import { Box } from '@mui/material'
import { useState, useEffect } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { useOrgs } from '@TAF/state/selectors'
import { fetchOrgs } from '@TAF/actions/orgs/api'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useAsyncAction } from '@TAF/hooks/components/useAsyncAction'
import { Drawer, TextInput, DrawerActions } from '@tdsk/components'
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
  const [orgId, setOrgId] = useState(``)
  const [gitUrl, setGitUrl] = useState(``)
  const [branch, setBranch] = useState(`main`)
  const { loading, error, setError, clearError, run } = useAsyncAction()
  const [orgs] = useOrgs()

  useEffect(() => {
    open && !orgs && ife(async () => await fetchOrgs())
  }, [open, orgs])

  const onClose = () => {
    if (loading) return

    setName(``)
    setDescription(``)
    setOrgId(``)
    setGitUrl(``)
    setBranch(`main`)
    clearError()
    onCloseCB?.()
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!orgId) return setError(`Org selection is required`)

    const short = name.trim()
    if (!short) return setError(`Project name is required`)

    const result = await run(() =>
      createProject({
        orgId,
        name: short,
        description: description.trim() || undefined,
        branch: branch.trim() || `main`,
        gitUrl: gitUrl.trim() || undefined,
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
