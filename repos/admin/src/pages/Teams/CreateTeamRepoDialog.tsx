import { useState } from 'react'
import { createRepo } from '@TAF/actions/repos'
import {
  Box,
  Alert,
  Dialog,
  Button,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TCreateTeamRepoDialog = {
  open: boolean
  teamId: string
  onClose: () => void
  onSuccess?: () => void
}

export const CreateTeamRepoDialog = ({
  open,
  teamId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TCreateTeamRepoDialog) => {
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
      setError('Repository name is required')
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
      onClose()
      onSuccessCB?.()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
    >
      <form onSubmit={onSubmit}>
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
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            variant='contained'
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Repository'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
