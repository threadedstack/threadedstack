import type { TRoleType, TPermission } from '@tdsk/domain'

import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import { isEmail } from '@keg-hub/jsutils/isEmail'
import { AuthRoles, ProjectRoles } from '@TAF/constants/values'
import { inviteToOrg } from '@TAF/actions/users/api/inviteToOrg'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'
import { PermissionsPicker } from '@TAF/components/Permissions/PermissionsPicker'
import { useSubscription, useProjects, useActiveOrgId } from '@TAF/state/selectors'
import {
  ERoleType,
  PlanLimits,
  ESubscriptionTier,
  buildRolePermissions,
} from '@tdsk/domain'
import {
  Box,
  Alert,
  Button,
  Dialog,
  Tooltip,
  Divider,
  Typography,
  IconButton,
  DialogTitle,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'

export type TInviteUserDrawer = {
  open: boolean
  orgId: string
  onClose: () => void
  onSuccess: () => void
  currentMemberCount?: number
}

type TProjectRoleEntry = {
  projectId: string
  roleType: TRoleType
}

export const InviteUserDrawer = (props: TInviteUserDrawer) => {
  const {
    open,
    orgId,
    onClose: onCloseCB,
    onSuccess: onSuccessCB,
    currentMemberCount = 0,
  } = props

  const [projectsMap] = useProjects()
  const [activeOrgId] = useActiveOrgId()
  const [subscription] = useSubscription()
  const [email, setEmail] = useState(``)
  const { canInviteUsers } = usePermissions()
  const [loading, setLoading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [seatConfirmOpen, setSeatConfirmOpen] = useState(false)
  const [roleType, setRoleType] = useState<TRoleType>(ERoleType.member)
  const [projectRoles, setProjectRoles] = useState<TProjectRoleEntry[]>([])
  const [permOverrides, setPermOverrides] = useState<TPermission[]>([])

  const orgProjects = useMemo(() => {
    const pMap = projectsMap?.[activeOrgId || orgId]
    return pMap ? Object.values(pMap) : []
  }, [projectsMap, activeOrgId, orgId])

  const availableProjects = useMemo(() => {
    const usedIds = new Set(projectRoles.map((pr) => pr.projectId))
    return orgProjects
      .filter((p) => !usedIds.has(p.id))
      .map((p) => ({ value: p.id, label: p.name || p.id }))
  }, [orgProjects, projectRoles])

  const availablePermissions = useMemo(
    () => buildRolePermissions(roleType as ERoleType),
    [roleType]
  )

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
    setRoleType(ERoleType.member)
    setError(null)
    setSeatConfirmOpen(false)
    setProjectRoles([])
    setPermOverrides([])
    setShowAdvanced(false)
    onCloseCB?.()
  }

  const doInvite = async () => {
    setLoading(true)
    setError(null)
    setSeatConfirmOpen(false)

    const resp = await inviteToOrg(
      orgId,
      email.trim(),
      roleType,
      projectRoles.length ? projectRoles : undefined,
      permOverrides.length
        ? permOverrides.map((p) => ({ permission: p, effect: `grant` as const }))
        : undefined
    )

    setLoading(false)

    if (resp.error) {
      setError(resp.error.message || `Failed to invite user. Please try again.`)
    } else {
      const warnings = (resp.data as any)?.warnings as string[] | undefined
      if (warnings?.length) toast.warning(`User invited, but: ${warnings.join('; ')}`)
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

  const addProjectRole = () => {
    if (availableProjects.length === 0) return
    setProjectRoles([
      ...projectRoles,
      { projectId: availableProjects[0].value, roleType: ERoleType.member },
    ])
  }

  const removeProjectRole = (idx: number) => {
    setProjectRoles(projectRoles.filter((_, i) => i !== idx))
  }

  const updateProjectRole = (
    idx: number,
    field: keyof TProjectRoleEntry,
    value: string
  ) => {
    setProjectRoles(
      projectRoles.map((pr, i) => (i === idx ? { ...pr, [field]: value } : pr))
    )
  }

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
              label='Organization Role'
              value={roleType}
              items={AuthRoles}
              disabled={loading || !canInvite}
              onChange={(e) => setRoleType(e.target.value as TRoleType)}
            />

            <Divider />

            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 1,
                }}
              >
                <Typography variant='subtitle2'>Project Access</Typography>
                <Button
                  size='small'
                  onClick={addProjectRole}
                  disabled={loading || !canInvite || availableProjects.length === 0}
                >
                  Add Project
                </Button>
              </Box>

              {projectRoles.length === 0 && (
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  No project access selected. User will only have organization-level
                  access.
                </Typography>
              )}

              {projectRoles.map((pr, idx) => (
                <Box
                  key={idx}
                  sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}
                >
                  <SelectInput
                    id={`project-${idx}`}
                    label='Project'
                    value={pr.projectId}
                    items={[
                      ...availableProjects,
                      ...(pr.projectId
                        ? [
                            {
                              value: pr.projectId,
                              label:
                                orgProjects.find((p) => p.id === pr.projectId)?.name ||
                                pr.projectId,
                            },
                          ]
                        : []),
                    ]}
                    onChange={(e) =>
                      updateProjectRole(idx, 'projectId', e.target.value as string)
                    }
                  />
                  <SelectInput
                    id={`project-role-${idx}`}
                    label='Role'
                    value={pr.roleType}
                    items={ProjectRoles}
                    onChange={(e) =>
                      updateProjectRole(idx, 'roleType', e.target.value as string)
                    }
                  />
                  <IconButton
                    size='small'
                    onClick={() => removeProjectRole(idx)}
                  >
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                </Box>
              ))}
            </Box>

            <Divider />

            <Box>
              <Button
                size='small'
                onClick={() => setShowAdvanced(!showAdvanced)}
                endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ mb: 1 }}
              >
                Granular Permissions
              </Button>
              {showAdvanced && (
                <PermissionsPicker
                  disabled={loading}
                  selected={permOverrides}
                  onChange={setPermOverrides}
                  available={availablePermissions}
                />
              )}
            </Box>
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
