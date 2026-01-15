import type { Secret } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { ConfirmDeleteAlert } from '@TAF/components'
import { createSecret, updateSecret, deleteSecret } from '@TAF/actions/secrets'
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import { Box, Button, IconButton, InputAdornment } from '@mui/material'
import { Dialog, TextInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'

export type TSecretDialog = {
  open: boolean
  orgId?: string
  projectId?: string
  secret?: Secret | null
  onClose: () => void
  onSuccess?: () => void
}

export const SecretDialog = ({
  open,
  orgId,
  projectId,
  secret,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TSecretDialog) => {
  const isEditMode = !!secret

  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showValue, setShowValue] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (secret) {
      setName(secret.hashKey || secret.name || '')
      setValue('')
      setDescription(secret.description || '')
      setError(null)
      setShowValue(false)
      setShowDeleteConfirm(false)
    } else {
      setName('')
      setValue('')
      setDescription('')
      setError(null)
      setShowValue(false)
      setShowDeleteConfirm(false)
    }
  }, [secret])

  const onClose = () => {
    if (!loading) {
      setName('')
      setValue('')
      setDescription('')
      setError(null)
      setShowValue(false)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Secret name is required')
      return
    }

    if (!isEditMode && !value.trim()) {
      setError('Secret value is required')
      return
    }

    setLoading(true)
    setError(null)

    let result: { error?: string } | undefined

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
      setError(`Failed to ${isEditMode ? 'update' : 'create'} secret. Please try again.`)
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
      setError('Failed to delete secret. Please try again.')
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const toggleValueVisibility = () => {
    setShowValue((prev) => !prev)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title={isEditMode ? 'Edit Secret' : 'Create New Secret'}
      content={
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
              <ConfirmDeleteAlert
                deleting={loading}
                onConfirm={onDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                itemName={secret?.hashKey || secret?.name || ''}
              />
            )}

            <TextInput
              autoFocus
              label='Secret Name'
              placeholder='Enter secret name (e.g., API_KEY)'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <TextInput
              label={isEditMode ? 'New Secret Value' : 'Secret Value'}
              placeholder={
                isEditMode
                  ? 'Enter new value (leave empty to keep current)'
                  : 'Enter secret value'
              }
              type={showValue ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required={!isEditMode}
              fullWidth
              disabled={loading}
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
              label='Description'
              placeholder='Enter description (optional)'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              textarea
              minRows={3}
              fullWidth
              disabled={loading}
            />
          </Box>
        </form>
      }
      actionProps={
        isEditMode ? { sx: { justifyContent: 'space-between', px: 3, pb: 2 } } : undefined
      }
      actions={
        <>
          {isEditMode && (
            <Button
              color='error'
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading || showDeleteConfirm}
            >
              Delete
            </Button>
          )}
          <Box sx={{ display: 'flex', gap: 1, ml: isEditMode ? 'auto' : 0 }}>
            <Button
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
    />
  )
}
