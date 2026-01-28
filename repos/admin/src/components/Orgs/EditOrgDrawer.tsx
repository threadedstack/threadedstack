import type { Organization } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { Box } from '@mui/material'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import { updateOrg } from '@TAF/actions/orgs/api/updateOrg'
import { Button, Drawer, TextInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

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
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Pre-populate form when org changes
  useEffect(() => {
    if (org) {
      setName(org.name || '')
      setDescription(org.description || '')
      setError(null)
    } else {
      setName('')
      setDescription('')
      setError(null)
    }
  }, [org])

  const onClose = () => {
    if (loading) return

    setName('')
    setDescription('')
    setError(null)
    onCloseCB?.()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!org?.id) return setError(`Organization ID is required`)
    if (!name.trim()) return setError(`Organization name is required`)

    setLoading(true)
    setError(null)

    const result = await updateOrg(org.id, {
      name: name.trim(),
      description: description.trim() || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(
        `Failed to update organization. ${result.error?.message ?? `Please try again later.`}`
      )
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

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
      actionsSx={{ px: 3, pb: 2 }}
      actions={
        <>
          <Button
            color='error'
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <LoadingButton
            type='submit'
            form='edit-org-form'
            variant='contained'
            loading={loading}
            loadingText='Saving...'
          >
            Save Changes
          </LoadingButton>
        </>
      }
    >
      <form
        id='edit-org-form'
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
