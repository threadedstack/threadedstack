import type { TRoleType } from '@tdsk/domain'

import { useState } from 'react'
import { ERoleType } from '@tdsk/domain'
import { AuthRoles } from '@TAF/constants/values'
import { isEmail } from '@keg-hub/jsutils/isEmail'
import { useSubscription } from '@TAF/state/selectors'
import { PlanLimits, ESubscriptionTier } from '@tdsk/domain'
import { inviteToOrg } from '@TAF/actions/users/api/inviteToOrg'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import {
  Box,
  Alert,
  Button,
  Dialog,
  Tooltip,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'

export type TInviteUserDrawer = {
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
  currentMemberCount?: number
}

export const InviteUserDrawer = (props: TInviteUserDrawer) => {
  const {
    open,
    orgId,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
    currentMemberCount = 0,
  } = props

  const [email, setEmail] = useState('')
  const { canInviteUsers } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seatConfirmOpen, setSeatConfirmOpen] = useState(false)
  const [roleType, setRoleType] = useState<TRoleType>(ERoleType.viewer)

  const [subscription] = useSubscription()

  const tier = (subscription?.tier || ESubscriptionTier.free) as ESubscriptionTier
  const limits = PlanLimits[tier] || PlanLimits[ESubscriptionTier.free]
  const canInvite = tier === ESubscriptionTier.pro || tier === ESubscriptionTier.team
  const seatLimit = limits.seats
  const seatsUsed = subscription?.seats || currentMemberCount || 1
  const seatsAvailable = seatLimit - seatsUsed
  const atCapacity = seatsAvailable <= 0 && limits.additionalSeats

  const onClose = () => {
    if (loading) return

    setEmail('')
    setRoleType(ERoleType.viewer)
    setError(null)
    setSeatConfirmOpen(false)
    onCloseCB?.()
  }

  const doInvite = async () => {
    setLoading(true)
    setError(null)
    setSeatConfirmOpen(false)

    const resp = await inviteToOrg(orgId, email.trim(), roleType)

    setLoading(false)

    if (resp.error) {
      setError(resp.error.message || `Failed to invite user. Please try again.`)
    } else {
      onSuccessCB?.()
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

    if (atCapacity) {
      setSeatConfirmOpen(true)
      return
    }

    await doInvite()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  const inviteDisabled = !canInvite || !canInviteUsers || loading || !email.trim()

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title='Invite User to Organization'
        actions={
          <DrawerActions
            editing={false}
            actions={actions}
            loading={loading}
            form='invite-user-form'
            disabled={inviteDisabled}
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

            {!canInvite && (
              <Alert severity='info'>
                Upgrade to Pro or Team to invite team members.
              </Alert>
            )}

            {canInvite && seatsAvailable > 0 && (
              <Alert severity='info'>
                {seatsAvailable} {seatsAvailable === 1 ? 'seat' : 'seats'} available on
                your plan.
              </Alert>
            )}

            <Tooltip
              title={!canInvite ? 'Upgrade to Pro to invite team members' : ''}
              placement='top'
            >
              <span>
                <TextInput
                  required
                  fullWidth
                  type='email'
                  value={email}
                  id='user-email'
                  disabled={loading || !canInvite}
                  label='Email Address'
                  placeholder='user@example.com'
                  onChange={(e) => setEmail(e.target.value)}
                />
              </span>
            </Tooltip>

            <SelectInput
              id='user-role'
              label='Role'
              value={roleType}
              items={AuthRoles}
              disabled={loading || !canInvite}
              onChange={(e) => setRoleType(e.target.value as TRoleType)}
            />
          </Box>
        </form>
      </Drawer>

      <Dialog
        open={seatConfirmOpen}
        onClose={() => setSeatConfirmOpen(false)}
      >
        <DialogTitle>Additional Seat Required</DialogTitle>
        <DialogContent>
          <DialogContentText>
            All {seatLimit} seats on your plan are in use. Inviting this member will add a
            paid seat to your subscription.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeatConfirmOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={doInvite}
            disabled={loading}
          >
            {loading ? 'Inviting...' : 'Confirm & Invite'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
