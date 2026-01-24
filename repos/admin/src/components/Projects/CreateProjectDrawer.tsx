import { useState } from 'react'
import { Box, Button } from '@mui/material'
import { Drawer, TextInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { createProject } from '@TAF/actions/projects/api/createProject'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

export type TCreateProjectDrawer = {
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess?: () => void
}

export const CreateProjectDrawer = ({
  open,
  orgId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TCreateProjectDrawer) => {
  const [name, setName] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (!loading) {
      setName('')
      setGitUrl('')
      setBranch('main')
      setError(null)
      onCloseCB()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError(`Project name is required`)
      return
    }

    setLoading(true)
    setError(null)

    const result = await createProject({
      name: name.trim(),
      orgId,
      gitUrl: gitUrl.trim() || undefined,
      branch: branch.trim() || 'main',
    })

    setLoading(false)

    if (result.error) {
      setError(`Failed to create project. Please try again.`)
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Create New Project'
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
            loading={loading}
            variant='contained'
            loadingText='Creating...'
            form='create-project-form'
          >
            Create Project
          </LoadingButton>
        </>
      }
    >
      <form
        id='create-project-form'
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
            label='Name'
            id='tdsk-project-name'
            placeholder='Enter project name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            disabled={loading}
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
