import { useState, useEffect } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { Dialog } from '@tdsk/components'
import { useOrgs } from '@TAF/state/selectors'
import { fetchOrgs } from '@TAF/actions/orgs/api'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { createProject } from '@TAF/actions/projects/api/createProject'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import {
  Box,
  Select,
  Button,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
} from '@mui/material'

export type TCreateProjectDialog = {
  open: boolean
  onClose: () => void
}

export const CreateProjectDialog = ({ open, onClose }: TCreateProjectDialog) => {
  const [name, setName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgs] = useOrgs()

  useEffect(() => {
    open && !orgs && ife(async () => await fetchOrgs())
  }, [open, orgs])

  const handleClose = () => {
    if (!loading) {
      setName('')
      setOrgId('')
      setGitUrl('')
      setBranch('main')
      setError(null)
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    if (!orgId) {
      setError('Org selection is required')
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
      setError('Failed to create project. Please try again.')
    } else {
      handleClose()
    }
  }

  const orgsArray = orgs ? Object.values(orgs) : []

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='sm'
      title='Create New Project'
      content={
        <form
          id='create-project-form'
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
              label='Project Name'
              placeholder='Enter project name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <FormControl
              fullWidth
              required
              disabled={loading}
            >
              <InputLabel id='org-select-label'>Org</InputLabel>
              <Select
                labelId='org-select-label'
                value={orgId}
                label='Org'
                onChange={(e) => setOrgId(e.target.value)}
              >
                {orgsArray.length === 0 && (
                  <MenuItem
                    value=''
                    disabled
                  >
                    No orgs available
                  </MenuItem>
                )}
                {orgsArray.map((org) => (
                  <MenuItem
                    key={org.id}
                    value={org.id}
                  >
                    {org.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label='Git URL'
              placeholder='https://github.com/user/repo.git (optional)'
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
              fullWidth
              disabled={loading}
            />

            <TextField
              label='Branch'
              placeholder='main'
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
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
            form='create-project-form'
            variant='contained'
            loading={loading}
            disabled={orgsArray.length === 0}
            loadingText='Creating...'
          >
            Create Project
          </LoadingButton>
        </>
      }
    />
  )
}
