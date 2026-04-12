import type { Organization } from '@tdsk/domain'

import { Box } from '@mui/material'
import { useState, useEffect } from 'react'
import { updateOrg } from '@TAF/actions/orgs/api/updateOrg'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useAsyncAction } from '@TAF/hooks/components/useAsyncAction'
import { Drawer, DrawerActions, OrgIcon, TextInput } from '@tdsk/components'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'

export type TEditOrgDrawer = {
  open: boolean
  org: Organization | null
  onClose: () => void
  onSuccess?: () => void
}

export const EditOrgDrawer = ({
  org,
  open,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TEditOrgDrawer) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const { loading, error, setError, clearError, run } = useAsyncAction()

  // Pre-populate form when org changes
  useEffect(() => {
    if (org) {
      setName(org.name || '')
      setDescription(org.description || '')
    } else {
      setName('')
      setDescription('')
    }
    clearError()
  }, [org])

  const onClose = () => {
    if (loading) return

    setName('')
    setDescription('')
    clearError()
    onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!org?.id) return setError(`Organization ID is required`)
    if (!name.trim()) return setError(`Organization name is required`)

    const result = await run(() =>
      updateOrg(org.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
    )

    if (result?.error) {
      setError(
        `Failed to update organization. ${result.error?.message ?? `Please try again later.`}`
      )
    } else {
      onSuccessCB?.()
      onClose()
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
      title={
        <>
          <OrgIcon text />
          Edit Organization
        </>
      }
      data-testid='edit-org-drawer'
      actions={
        <DrawerActions
          editing={true}
          actions={actions}
          loading={loading}
          disabled={loading}
          form='edit-org-form'
        />
      }
    >
      <form id='edit-org-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={clearError}
            />
          )}

          <TextInput
            autoFocus
            required
            fullWidth
            value={name}
            label='Name'
            disabled={loading}
            id='edit-org-name'
            placeholder='Enter organization name'
            onChange={(e) => setName(e.target.value)}
          />

          <TextInput
            textarea
            fullWidth
            minRows={3}
            disabled={loading}
            label='Description'
            value={description}
            id='edit-org-description'
            placeholder='Enter organization description (optional)'
            onChange={(e) => setDescription(e.target.value)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
