import type { TRoleType } from '@tdsk/domain'

import { useState } from 'react'
import { ERoleType } from '@tdsk/domain'
import { Box, Button } from '@mui/material'
import { AuthRoles } from '@TAF/constants/values'
import { isEmail } from '@keg-hub/jsutils/isEmail'
import { inviteToOrg } from '@TAF/actions/users/inviteToOrg'
import { Drawer, TextInput, SelectInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

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

  const onSubmit = async (e: React.FormEvent) => {
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

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Invite User to Organization'
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
            loading={loading}
            variant='contained'
            form='invite-user-form'
            loadingText='Inviting...'
          >
            Send Invite
          </LoadingButton>
        </>
      }
    >
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
