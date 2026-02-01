import type { TRoleType } from '@tdsk/domain'

import { useState } from 'react'
import { ERoleType } from '@tdsk/domain'
import { Box, TextField } from '@mui/material'
import { isEmail } from '@keg-hub/jsutils/isEmail'
import { Drawer, DrawerActions } from '@tdsk/components'
import { inviteToOrg } from '@TAF/actions/users/inviteToOrg'
import { RoleSelect } from '@TAF/components/Roles/RoleSelect'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'

export type TInviteUserDrawer = {
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
}

export const InviteUserDrawer = ({
  open,
  orgId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TInviteUserDrawer) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleType, setRoleType] = useState<TRoleType>(ERoleType.viewer)

  const onClose = () => {
    if (loading) return

    setEmail(``)
    setError(null)
    setRoleType(ERoleType.viewer)
    onCloseCB?.()
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const short = email.trim()

    if (!short) return setError(`Email is required`)
    if (!isEmail(short)) return setError(`Please enter a valid email address`)

    setLoading(true)
    setError(null)

    const resp = await inviteToOrg(orgId, short, roleType)

    setLoading(false)
    if (resp.error)
      return setError(resp.error.message || `Failed to invite user. Please try again.`)

    onSuccessCB?.()
    onClose?.()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Invite User to Organization'
      actions={
        <DrawerActions
          form='invite-user-form'
          editing={false}
          actions={actions}
          loading={loading}
          disabled={loading}
        />
      }
    >
      <form id='invite-user-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <TextField
            required
            fullWidth
            autoFocus
            type='email'
            value={email}
            disabled={loading}
            label='Email Address'
            placeholder='user@example.com'
            onChange={(e) => setEmail(e.target.value)}
          />

          <RoleSelect
            roleType={roleType}
            disabled={loading}
            id='user-role-select'
            onChange={(e) => setRoleType(e.target.value as TRoleType)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
