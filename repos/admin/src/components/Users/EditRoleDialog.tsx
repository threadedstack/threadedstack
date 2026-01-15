import type { User, TRoleType } from '@tdsk/domain'

import { ERoleType } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { AuthRoles } from '@TAF/constants/values'
import { Dialog, SelectInput } from '@tdsk/components'
import { getInitials } from '@TAF/utils/user/getInitials'
import { updateOrgRole } from '@TAF/actions/users/updateOrgRole'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Box, Alert, Avatar, Button, Typography } from '@mui/material'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

export type TEditRoleDialog = {
  user: User
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
}

// TODO: Add checks if current user has admin permission to edit other users roles
export const EditRoleDialog = ({
  open,
  user,
  orgId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TEditRoleDialog) => {
  const [roleType, setRoleType] = useState<TRoleType>(
    user.role === ERoleType.admin ? ERoleType.admin : ERoleType.basic
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRoleType(user.role === ERoleType.admin ? ERoleType.admin : ERoleType.basic)
  }, [user])

  const onClose = () => {
    if (!loading) {
      setError(null)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError(null)

    const resp = await updateOrgRole(orgId, user.id, roleType)

    setLoading(false)

    if (resp.error) {
      setError(resp.error.message || 'Failed to update role. Please try again.')
    } else {
      onSuccessCB?.()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title='Edit User Role'
      content={
        <form
          id='edit-role-form'
          onSubmit={onSubmit}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <ErrorAlert
                message={error}
                onClose={() => setError(null)}
              />
            )}

            <Box
              sx={{
                p: 2,
                gap: 2,
                display: 'flex',
                borderRadius: 1,
                alignItems: 'center',
                bgcolor: 'action.hover',
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

            <SelectInput
              id='role-edit'
              label='Role'
              value={roleType}
              items={AuthRoles}
              disabled={loading}
              onChange={(e) => setRoleType(e.target.value as TRoleType)}
            />

            <Alert severity='info'>
              Note: Super admin roles cannot be modified through this interface.
            </Alert>
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
            form='edit-role-form'
            variant='contained'
            loading={loading}
            loadingText='Saving...'
          >
            Save Changes
          </LoadingButton>
        </>
      }
    />
  )
}
