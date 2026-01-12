import { useState, useEffect } from 'react'
import {
  Box,
  Alert,
  Select,
  Dialog,
  Button,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { ife } from '@keg-hub/jsutils/ife'
import { createProject } from '@TAF/actions/projects'
import { fetchOrgs } from '@TAF/actions/orgs'
import { useOrgs } from '@TAF/state/selectors'

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
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert
                severity='error'
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
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
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            variant='contained'
            disabled={loading || orgsArray.length === 0}
          >
            {loading ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
