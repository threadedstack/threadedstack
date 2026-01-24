import type { TRoleType } from '@tdsk/domain'

import { useState } from 'react'
import { usersApi } from '@TAF/services'
import { ERoleType } from '@tdsk/domain'
import { Drawer } from '@tdsk/components'
import { isEmail } from '@keg-hub/jsutils/isEmail'
import { RoleSelect } from '@TAF/components/Roles/RoleSelect'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { Box, Button, TextField } from '@mui/material'

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
  const [roleType, setRoleType] = useState<TRoleType>(ERoleType.viewer)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (loading) return

    setEmail(``)
    setError(null)
    setRoleType(ERoleType.viewer)
    onCloseCB?.()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const short = email.trim()

    if (!short) return setError(`Email is required`)
    if (!isEmail(short)) return setError(`Please enter a valid email address`)

    setLoading(true)
    setError(null)

    const resp = await usersApi.inviteToOrg(orgId, {
      email: short,
      role: roleType,
    })

    setLoading(false)
    if (resp.error)
      return setError(resp.error.message || `Failed to invite user. Please try again.`)

    onSuccessCB?.()
    onClose?.()
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
