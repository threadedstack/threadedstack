import { useState } from 'react'
import { Box } from '@mui/material'
import { createOrg } from '@TAF/actions/orgs/api/createOrg'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, DrawerActions, TextInput } from '@tdsk/components'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'

export type TCreateOrgDialog = {
  open: boolean
  onClose: () => void
}

export const CreateOrgDialog = ({ open, onClose: onCloseCB }: TCreateOrgDialog) => {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (loading) return

    setName('')
    setError(null)
    setDescription('')
    onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) return setError(`Organization name is required`)

    setLoading(true)
    setError(null)

    const result = await createOrg({
      name: name.trim(),
      description: description.trim() || undefined,
    })

    setLoading(false)
    result.error
      ? setError(`Failed to create organization. Please try again.`)
      : onClose()
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='New Organization'
      actions={
        <DrawerActions
          editing={false}
          actions={actions}
          loading={loading}
          disabled={loading}
          form='create-org-form'
        />
      }
    >
      <form id='create-org-form'>
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
            id='org-name'
            disabled={loading}
            label='Organization Name'
            placeholder='Enter organization name'
            onChange={(e) => setName(e.target.value)}
          />

          <TextInput
            textarea
            fullWidth
            minRows={3}
            disabled={loading}
            value={description}
            label='Description'
            id='org-description'
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Enter organization description (optional)'
          />
        </Box>
      </form>
    </Drawer>
  )
}
