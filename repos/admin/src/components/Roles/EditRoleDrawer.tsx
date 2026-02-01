import type { User, TRoleType } from '@tdsk/domain'

import { ERoleType } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { Box, Avatar, Typography } from '@mui/material'
import { Drawer, DrawerActions } from '@tdsk/components'
import { getInitials } from '@TAF/utils/user/getInitials'
import { RoleSelect } from '@TAF/components/Roles/RoleSelect'
import { updateOrgRole } from '@TAF/actions/users/updateOrgRole'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'

export type TEditRoleDrawer = {
  user: User
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
}

// TODO: Add checks if current user has admin permission to edit other users roles
export const EditRoleDrawer = ({
  open,
  user,
  orgId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TEditRoleDrawer) => {
  const [roleType, setRoleType] = useState<TRoleType>(
    user.role === ERoleType.admin ? ERoleType.admin : ERoleType.viewer
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRoleType(user.role === ERoleType.admin ? ERoleType.admin : ERoleType.viewer)
  }, [user])

  const onClose = () => {
    if (loading) return

    setError(null)
    onCloseCB?.()
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setError(null)

    const resp = await updateOrgRole(orgId, user.id, roleType)
    setLoading(false)

    resp.error
      ? setError(resp.error.message || `Failed to update role. Please try again.`)
      : onSuccessCB?.()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Edit User Role'
      actions={
        <DrawerActions
          editing={true}
          actions={actions}
          loading={loading}
          disabled={loading}
          form='edit-role-form'
        />
      }
    >
      <form id='edit-role-form'>
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

          <RoleSelect
            showAlert
            disabled={loading}
            roleType={roleType}
            onChange={(e) => setRoleType(e.target.value as TRoleType)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
