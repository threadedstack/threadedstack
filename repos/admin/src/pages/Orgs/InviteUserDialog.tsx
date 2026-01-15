import { useState } from 'react'
import { Dialog } from '@tdsk/components'
import { usersApi } from '@TAF/services'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import {
  Box,
  Button,
  Select,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
} from '@mui/material'

export type TInviteUserDialog = {
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
}

export const InviteUserDialog = ({
  open,
  orgId,
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

    const resp = await usersApi.inviteToOrg(orgId, {
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
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title='Invite User to Organization'
      content={
        <form
          id='invite-user-form'
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
                <MenuItem value='admin'>Admin - Full org management</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </form>
      }
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
            form='invite-user-form'
            variant='contained'
            loading={loading}
            loadingText='Inviting...'
          >
            Send Invite
          </LoadingButton>
        </>
      }
    />
  )
}
