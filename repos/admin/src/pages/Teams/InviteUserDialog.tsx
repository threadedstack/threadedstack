import { useState } from 'react'
import { usersApi } from '@TAF/services'
import {
  Box,
  Alert,
  Button,
  Select,
  Dialog,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TInviteUserDialog = {
  open: boolean
  teamId: string
  onClose: () => void
  onSuccess: () => void
}

export const InviteUserDialog = ({
  open,
  teamId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TInviteUserDialog) => {
  const [email, setEmail] = useState('')
  const [roleType, setRoleType] = useState<'admin' | 'basic'>('basic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (!loading) {
      setEmail('')
      setRoleType('basic')
      setError(null)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError(null)

    const resp = await usersApi.inviteToTeam(teamId, {
      email: email.trim(),
      roleType,
    })

    setLoading(false)

    if (resp.error) {
      setError(resp.error.message || 'Failed to invite user. Please try again.')
    } else {
      onSuccessCB?.()
    }
  }

  return (
    <Dialog
      fullWidth
      open={open}
      maxWidth='sm'
      onClose={onClose}
    >
      <form onSubmit={onSubmit}>
        <DialogTitle>Invite User to Team</DialogTitle>
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
              label='Email Address'
              type='email'
              placeholder='user@example.com'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <FormControl
              fullWidth
              disabled={loading}
            >
              <InputLabel id='role-select-label'>Role</InputLabel>
              <Select
                labelId='role-select-label'
                id='role-select'
                value={roleType}
                label='Role'
                onChange={(e) => setRoleType(e.target.value as 'admin' | 'basic')}
              >
                <MenuItem value='basic'>Basic - Standard access</MenuItem>
                <MenuItem value='admin'>Admin - Full team management</MenuItem>
              </Select>
            </FormControl>
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
            {loading ? 'Inviting...' : 'Send Invite'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
