import type { TRoleType } from '@tdsk/domain'

import { useState } from 'react'
import { Box } from '@mui/material'
import { ERoleType } from '@tdsk/domain'
import { AuthRoles } from '@TAF/constants/values'
import { isEmail } from '@keg-hub/jsutils/isEmail'
import { inviteToOrg } from '@TAF/actions/users/api/inviteToOrg'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'

export type TInviteUserDrawer = {
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
}

// TODO: Add checks if current user has admin permission to invite other users
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
    if (!loading) {
      setEmail('')
      setRoleType(ERoleType.viewer)
      setError(null)
      onCloseCB?.()
    }
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      setError(`Email is required`)
      return
    }

    if (!isEmail(email)) {
      setError(`Please enter a valid email address`)
      return
    }

    setLoading(true)
    setError(null)

    const resp = await inviteToOrg(orgId, email.trim(), roleType)

    setLoading(false)

    if (resp.error) {
      setError(resp.error.message || `Failed to invite user. Please try again.`)
    } else {
      onSuccessCB?.()
    }
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
          disabled={loading || !email.trim()}
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

          <TextInput
            required
            fullWidth
            type='email'
            value={email}
            id='user-email'
            disabled={loading}
            label='Email Address'
            placeholder='user@example.com'
            onChange={(e) => setEmail(e.target.value)}
          />

          <SelectInput
            id='user-role'
            label='Role'
            value={roleType}
            items={AuthRoles}
            disabled={loading}
            onChange={(e) => setRoleType(e.target.value as TRoleType)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
