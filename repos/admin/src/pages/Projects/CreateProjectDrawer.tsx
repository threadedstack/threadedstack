import { useState, useEffect } from 'react'
import { ife } from '@keg-hub/jsutils/ife'
import { Drawer } from '@tdsk/components'
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

export type TCreateProjectDrawer = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const CreateProjectDrawer = (props: TCreateProjectDrawer) => {
  const { open, onClose: onCloseCB, onSuccess: onSuccessCB } = props

  const [name, setName] = useState(``)
  const [orgId, setOrgId] = useState(``)
  const [gitUrl, setGitUrl] = useState(``)
  const [branch, setBranch] = useState(`main`)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orgs] = useOrgs()

  useEffect(() => {
    open && !orgs && ife(async () => await fetchOrgs())
  }, [open, orgs])

  const onClose = () => {
    if (loading) return

    setName(``)
    setOrgId(``)
    setGitUrl(``)
    setBranch(`main`)
    setError(null)
    onCloseCB?.()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!orgId) return setError(`Org selection is required`)
    const short = name.trim()
    if (!short) return setError(`Project name is required`)

    setLoading(true)
    setError(null)

    const result = await createProject({
      orgId,
      name: short,
      branch: branch.trim() || `main`,
      gitUrl: gitUrl.trim() || undefined,
    })

    setLoading(false)

    if (result.error) return setError(`Failed to create project. Please try again.`)

    onSuccessCB?.()
    onClose()
  }

  const orgsArray = orgs ? Object.values(orgs) : []

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
            fullWidth
            label='Git URL'
            value={gitUrl}
            disabled={loading}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder='https://github.com/user/repo.git (optional)'
          />

          <TextField
            fullWidth
            label='Branch'
            value={branch}
            disabled={loading}
            placeholder='main'
            onChange={(e) => setBranch(e.target.value)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
