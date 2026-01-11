import type { TUserWithRole } from './OrgUsers'

import { usersApi } from '@TAF/services'
import { useState, useEffect } from 'react'
import {
  Box,
  Alert,
  Avatar,
  Select,
  Button,
  Dialog,
  MenuItem,
  Typography,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TEditRoleDialog = {
  open: boolean
  orgId: string
  user: TUserWithRole
  onClose: () => void
  onSuccess: () => void
}

export const EditRoleDialog = ({
  open,
  user,
  orgId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TEditRoleDialog) => {
  const [roleType, setRoleType] = useState<'admin' | 'basic'>(
    user.roleType === 'admin' ? 'admin' : 'basic'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRoleType(user.roleType === 'admin' ? 'admin' : 'basic')
  }, [user])

  const onClose = () => {
    if (!loading) {
      setError(null)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user.roleId) {
      setError('Role ID is missing')
      return
    }

    setLoading(true)
    setError(null)

    const resp = await usersApi.updateRole(orgId, user.roleId, roleType)

    setLoading(false)

    if (resp.error) {
      setError(resp.error.message || 'Failed to update role. Please try again.')
    } else {
      onSuccessCB?.()
    }
  }

  const getInitials = (user: TUserWithRole) => {
    if (user.first && user.last) {
      return `${user.first[0]}${user.last[0]}`.toUpperCase()
    }
    if (user.displayName) {
      const parts = user.displayName.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return user.displayName.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      fullWidth
    >
      <form onSubmit={onSubmit}>
        <DialogTitle>Edit User Role</DialogTitle>
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

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 1,
              }}
            >
              <Avatar
                src={user.image}
                sx={{ width: 48, height: 48 }}
              >
                {getInitials(user)}
              </Avatar>
              <Box>
                <Typography
                  variant='subtitle1'
                  fontWeight='medium'
                >
                  {user.displayName}
                </Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  {user.email}
                </Typography>
              </Box>
            </Box>

            <FormControl
              fullWidth
              disabled={loading}
            >
              <InputLabel id='role-edit-label'>Role</InputLabel>
              <Select
                labelId='role-edit-label'
                id='role-edit'
                value={roleType}
                label='Role'
                onChange={(e) => setRoleType(e.target.value as 'admin' | 'basic')}
              >
                <MenuItem value='basic'>Basic - Standard access</MenuItem>
                <MenuItem value='admin'>Admin - Full org management</MenuItem>
              </Select>
            </FormControl>

            <Alert severity='info'>
              Note: Super admin roles cannot be modified through this interface.
            </Alert>
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
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
