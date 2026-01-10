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
import { createRepo } from '@TAF/actions/repos'
import { fetchTeams } from '@TAF/actions/teams'
import { useTeams } from '@TAF/state/selectors'

export type TCreateRepoDialog = {
  open: boolean
  onClose: () => void
}

export const CreateRepoDialog = ({ open, onClose }: TCreateRepoDialog) => {
  const [name, setName] = useState('')
  const [teamId, setTeamId] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teams] = useTeams()

  useEffect(() => {
    open && !teams && ife(async () => await fetchTeams())
  }, [open, teams])

  const handleClose = () => {
    if (!loading) {
      setName('')
      setTeamId('')
      setGitUrl('')
      setBranch('main')
      setError(null)
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Repository name is required')
      return
    }

    if (!teamId) {
      setError('Team selection is required')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createRepo({
      name: name.trim(),
      teamId,
      gitUrl: gitUrl.trim() || undefined,
      branch: branch.trim() || 'main',
    })

    setLoading(false)

    if (result.error) {
      setError('Failed to create repository. Please try again.')
    } else {
      handleClose()
    }
  }

  const teamsArray = teams ? Object.values(teams) : []

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth='sm'
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Repository</DialogTitle>
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
              label='Repository Name'
              placeholder='Enter repository name'
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
              <InputLabel id='team-select-label'>Team</InputLabel>
              <Select
                labelId='team-select-label'
                value={teamId}
                label='Team'
                onChange={(e) => setTeamId(e.target.value)}
              >
                {teamsArray.length === 0 && (
                  <MenuItem
                    value=''
                    disabled
                  >
                    No teams available
                  </MenuItem>
                )}
                {teamsArray.map((team) => (
                  <MenuItem
                    key={team.id}
                    value={team.id}
                  >
                    {team.name}
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
            disabled={loading || teamsArray.length === 0}
          >
            {loading ? 'Creating...' : 'Create Repository'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
