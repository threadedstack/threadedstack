import type { PermissionOverride } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { useEffect, useMemo, useState } from 'react'
import ToggleButton from '@mui/material/ToggleButton'
import { EPermResource, EPermAction } from '@tdsk/domain'
import { UserSelectorSingle } from '@TAF/components/Selectors'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { FormSection } from '@TAF/components/FormSection/FormSection'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { createOverride } from '@TAF/actions/permissionOverrides/api/createOverride'
import { updateOverride } from '@TAF/actions/permissionOverrides/api/updateOverride'
import { Drawer, TextInput, SelectInput, DrawerActions } from '@tdsk/components'

export type PermissionOverrideDrawer = {
  open: boolean
  orgId: string
  onClose: () => void
  editing?: PermissionOverride
  users: Array<{ id: string; name: string; email?: string }>
}

const AllPermissionItems = Object.values(EPermResource).flatMap((resource) =>
  Object.values(EPermAction).map((action) => ({
    value: `${resource}:${action}`,
    label: `${resource}:${action}`,
  }))
)

const ResourceFilterItems = [
  { value: ``, label: `All resources` },
  ...Object.values(EPermResource).map((r) => ({ value: r, label: r })),
]

export const PermissionOverrideDrawer = ({
  open,
  orgId,
  users,
  editing,
  onClose: onCloseCB,
}: PermissionOverrideDrawer) => {
  const [reason, setReason] = useState(``)
  const [expiresAt, setExpiresAt] = useState(``)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permission, setPermission] = useState<string>(``)
  const [userId, setUserId] = useState<string | null>(null)
  const [effect, setEffect] = useState<`grant` | `deny`>(`grant`)
  const [resourceFilter, setResourceFilter] = useState<string>(``)

  const filteredPermissionItems = useMemo(() => {
    if (!resourceFilter) return AllPermissionItems
    return AllPermissionItems.filter((p) => p.value.startsWith(`${resourceFilter}:`))
  }, [resourceFilter])

  const resetForm = () => {
    setUserId(null)
    setPermission(``)
    setEffect(`grant`)
    setReason(``)
    setExpiresAt(``)
    setResourceFilter(``)
    setError(null)
  }

  useEffect(() => {
    if (editing) {
      setUserId(editing.userId)
      setPermission(editing.permission)
      setEffect(editing.effect as `grant` | `deny`)
      setReason(editing.reason || ``)
      setExpiresAt(editing.expiresAt?.toString() || ``)
      // Set resource filter to match the editing permission's resource
      const resource = editing.permission?.split(`:`)[0] || ``
      setResourceFilter(resource)
      setError(null)
    } else {
      resetForm()
    }
  }, [editing])

  const onClose = () => {
    if (loading) return
    onCloseCB?.()
    resetForm()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!userId) return setError(`User is required`)
    if (!permission) return setError(`Permission is required`)

    setLoading(true)
    setError(null)

    if (editing) {
      const result = await updateOverride({
        orgId,
        overrideId: editing.id,
        data: {
          effect,
          reason: reason || undefined,
          expiresAt: expiresAt || undefined,
        },
      })

      setLoading(false)

      if (result?.error) {
        const msg = result.error?.message || `Please try again.`
        setError(`Failed to update permission override. ${msg}`)
      } else {
        onClose()
      }
    } else {
      const data: Omit<PermissionOverride, 'id' | 'grantedBy'> = {
        userId,
        orgId,
        permission: permission as PermissionOverride['permission'],
        effect,
        reason: reason || undefined,
        expiresAt: expiresAt || undefined,
      }

      const result = await createOverride({ orgId, data })

      setLoading(false)

      if (result?.error) {
        const msg = result.error?.message || `Please try again.`
        setError(`Failed to create permission override. ${msg}`)
      } else {
        onClose()
      }
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
      title={editing ? `Edit Permission Override` : `Add Permission Override`}
      actions={
        <DrawerActions
          actions={actions}
          loading={loading}
          disabled={loading}
          editing={!!editing}
          form='permission-override-form'
        />
      }
    >
      <form id='permission-override-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          <FormSection title='User'>
            <UserSelectorSingle
              users={users}
              userId={userId}
              loading={loading}
              required
              onChange={setUserId}
              disabled={loading || !!editing}
            />
          </FormSection>

          <FormSection title='Permission'>
            <SelectInput
              value={resourceFilter}
              label='Filter by resource'
              items={ResourceFilterItems}
              disabled={loading || !!editing}
              id='tdsk-override-resource-filter'
              onChange={(e) => {
                setResourceFilter(e.target.value as string)
                setPermission(``)
              }}
            />

            <SelectInput
              required
              label='Permission'
              value={permission}
              disabled={loading || !!editing}
              items={filteredPermissionItems}
              placeholder='Select a permission'
              id='tdsk-override-permission-select'
              onChange={(e) => setPermission(e.target.value as string)}
            />
          </FormSection>

          <FormSection title='Effect'>
            <ToggleButtonGroup
              exclusive
              size='small'
              value={effect}
              onChange={(_, val) => val && setEffect(val)}
            >
              <ToggleButton value='grant'>Grant</ToggleButton>
              <ToggleButton value='deny'>Deny</ToggleButton>
            </ToggleButtonGroup>
          </FormSection>

          <FormSection title='Details'>
            <TextInput
              fullWidth
              label='Reason'
              value={reason}
              disabled={loading}
              id='tdsk-override-reason-input'
              placeholder='Why is this override needed?'
              onChange={(e) => setReason(e.target.value)}
            />

            <TextInput
              fullWidth
              label='Expires At'
              value={expiresAt}
              disabled={loading}
              type='datetime-local'
              id='tdsk-override-expires-input'
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormSection>
        </Box>
      </form>
    </Drawer>
  )
}
