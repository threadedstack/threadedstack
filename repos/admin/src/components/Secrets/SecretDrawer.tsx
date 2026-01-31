import type { Secret } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { ConfirmDelete, Drawer, TextInput } from '@tdsk/components'
import { Box, Button, IconButton, InputAdornment } from '@mui/material'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { createSecret, updateSecret, deleteSecret } from '@TAF/actions/secrets'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'

export type TSecretDrawer = {
  open: boolean
  orgId?: string
  projectId?: string
  onClose: () => void
  secret?: Secret | null
  onSuccess?: () => void
}

export const SecretDrawer = ({
  open,
  orgId,
  secret,
  projectId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TSecretDrawer) => {
  const isEditMode = !!secret

  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState('')
  const [showValue, setShowValue] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (secret) {
      setValue(``)
      setError(null)
      setShowValue(false)
      setShowDeleteConfirm(false)
      setDescription(secret.description || ``)
      setName(secret.hashKey || secret.name || ``)
    } else {
      setName(``)
      setValue(``)
      setError(null)
      setDescription(``)
      setShowValue(false)
      setShowDeleteConfirm(false)
    }
  }, [secret])

  const onClose = () => {
    if (!loading) {
      setName(``)
      setValue(``)
      setError(null)
      setDescription(``)
      setShowValue(false)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError(`Secret name is required`)
      return
    }

    if (!isEditMode && !value.trim()) {
      setError(`Secret value is required`)
      return
    }

    setLoading(true)
    setError(null)

    let result: { error?: Error } | undefined

    if (isEditMode && secret) {
      const updateData: {
        name?: string
        value?: string
        description?: string
      } = {
        name: name.trim(),
      }

      const val = value.trim()
      if (val) updateData.value = val

      const desc = description.trim()
      if (desc) updateData.description = desc

      result = await updateSecret(secret.id, updateData)
    } else {
      const params: {
        name: string
        value: string
        orgId?: string
        projectId?: string
        description?: string
      } = {
        name: name.trim(),
        value: value.trim(),
        description: description.trim() || undefined,
      }

      if (projectId) {
        params.projectId = projectId
      } else if (orgId) {
        params.orgId = orgId
      }

      result = await createSecret(params)
    }

    setLoading(false)

    if (result?.error) {
      const action = isEditMode ? `update` : `create`
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to ${action} secret. ${msg}`)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const onDelete = async () => {
    if (!secret) return

    setLoading(true)
    setError(null)

    const result = await deleteSecret(secret.id)

    setLoading(false)

    if (result.error) {
      setShowDeleteConfirm(false)
      const msg = result.error?.message || `Please try again.`
      setError(`Failed to delete secret. ${msg}`)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const toggleValueVisibility = () => {
    setShowValue((prev) => !prev)
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Secret' : 'Create New Secret'}
      actionsSx={
        isEditMode ? { justifyContent: 'space-between', px: 3, pb: 2 } : undefined
      }
      actions={
        <>
          {isEditMode && (
            <Button
              color='error'
              variant='outlined'
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || showDeleteConfirm}
            >
              Delete
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1, ml: isEditMode ? 'auto' : 0 }}>
            <Button
              color='warning'
              variant='outlined'
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <LoadingButton
              type='submit'
              form='secret-form'
              variant='contained'
              loading={loading}
              disabled={isEditMode && showDeleteConfirm}
              loadingText={isEditMode ? 'Saving...' : 'Creating...'}
            >
              {isEditMode ? 'Save Changes' : 'Create Secret'}
            </LoadingButton>
          </Box>
        </>
      }
    >
      <form
        id='secret-form'
        onSubmit={onSubmit}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {isEditMode && showDeleteConfirm && (
            <ConfirmDelete
              deleting={loading}
              onConfirm={onDelete}
              onCancel={() => setShowDeleteConfirm(false)}
              itemName={secret?.hashKey || secret?.name || ''}
            />
          )}

          <TextInput
            required
            fullWidth
            autoFocus
            value={name}
            disabled={loading}
            label='Secret Name'
            id='tdsk-secret-name-input'
            placeholder='Enter secret name (e.g., API_KEY)'
            onChange={(e) => setName(e.target.value)}
          />

          <TextInput
            fullWidth
            value={value}
            disabled={loading}
            required={!isEditMode}
            id='tdsk-secret-value-input'
            type={showValue ? 'text' : 'password'}
            onChange={(e) => setValue(e.target.value)}
            label={isEditMode ? 'New Secret Value' : 'Secret Value'}
            placeholder={
              isEditMode
                ? 'Enter new value (leave empty to keep current)'
                : 'Enter secret value'
            }
            endAdornment={
              <InputAdornment position='end'>
                <IconButton
                  onClick={toggleValueVisibility}
                  edge='end'
                  disabled={loading}
                  aria-label={showValue ? 'Hide secret value' : 'Show secret value'}
                >
                  {showValue ? <VisibilityOffIcon /> : <VisibilityIcon />}
                </IconButton>
              </InputAdornment>
            }
          />

          <TextInput
            textarea
            fullWidth
            minRows={3}
            disabled={loading}
            label='Description'
            value={description}
            id='tdsk-secret-description-input'
            placeholder='Enter description (optional)'
            onChange={(e) => setDescription(e.target.value)}
          />
        </Box>
      </form>
    </Drawer>
  )
}
