import type { Secret } from '@tdsk/domain'
import { useState, useEffect, useMemo } from 'react'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'
import { useSecrets } from '@TAF/state/selectors'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { Drawer, TextInput, DrawerActions } from '@tdsk/components'
import { createSecret } from '@TAF/actions/secrets/api/createSecret'
import { updateSecret } from '@TAF/actions/secrets/api/updateSecret'
import { Box, Alert, IconButton, InputAdornment } from '@mui/material'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
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
  onRemove: (secret: Secret) => void
}

type TTempSecret = {
  name?: string
  value?: string
  description?: string
}

export const SecretDrawer = ({
  open,
  orgId,
  secret,
  projectId,
  onRemove,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TSecretDrawer) => {
  const isEditMode = !!secret
  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(false)
  const [temp, setTemp] = useState<TTempSecret>({})
  const [showValue, setShowValue] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const updateTemp = (update: Partial<TTempSecret>) => setTemp({ ...temp, ...update })

  const duplicateName = useMemo(() => {
    if (isEditMode || !temp?.name?.trim() || !secrets) return false
    const name = temp.name.trim().toLowerCase()
    return Object.values(secrets).some((scope) =>
      Object.values(scope).some(
        (s) => s.name?.toLowerCase() === name || s.hashKey?.toLowerCase() === name
      )
    )
  }, [temp?.name, secrets, isEditMode])

  useEffect(() => {
    if (secret) {
      setTemp({
        name: secret.name,
        value: secret.value,
        description: secret.description,
      })
      setError(null)
      setShowValue(false)
      setShowDeleteConfirm(false)
    } else {
      setError(null)
      setTemp(undefined)
      setShowValue(false)
      setShowDeleteConfirm(false)
    }
  }, [secret])

  const onClose = () => {
    if (loading) return

    onCloseCB?.()
    setError(null)
    setTemp(undefined)
    setShowValue(false)
    setShowDeleteConfirm(false)
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!temp.name.trim()) return setError(`Secret name is required`)
    if (!isEditMode && !temp.value.trim()) return setError(`Secret value is required`)

    setLoading(true)
    setError(null)

    let result: { error?: Error } | undefined

    if (isEditMode && secret) {
      result = await updateSecret({
        orgId,
        projectId,
        data: cleanColl({ ...temp }),
        id: secret.id,
      })
    } else {
      result = await createSecret({
        orgId,
        projectId,
        name: temp.name,
        value: temp.value,
        description: temp.description,
      })
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

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove: () => onRemove?.(secret),
  })

  const toggleValueVisibility = () => setShowValue((prev) => !prev)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? `Edit Secret` : `Create New Secret`}
      actions={
        <DrawerActions
          form='secret-form'
          actions={actions}
          loading={loading}
          editing={isEditMode}
          disabled={loading || showDeleteConfirm}
        />
      }
    >
      <form id='secret-form'>
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
            autoFocus
            disabled={loading}
            label='Secret Name'
            value={temp?.name || ``}
            id='tdsk-secret-name-input'
            placeholder='Enter secret name (e.g., API_KEY)'
            onChange={(e) => updateTemp({ name: e.target.value })}
          />

          {duplicateName && (
            <Alert severity='warning'>
              A secret with this name already exists. Creating another will result in
              duplicates.
            </Alert>
          )}

          <TextInput
            fullWidth
            disabled={loading}
            required={!isEditMode}
            value={temp?.value || ``}
            id='tdsk-secret-value-input'
            type={showValue ? 'text' : 'password'}
            onChange={(e) => updateTemp({ value: e.target.value })}
            label={isEditMode ? 'New Secret Value' : 'Secret Value'}
            placeholder={
              isEditMode
                ? 'Enter new value (leave empty to keep current)'
                : 'Enter secret value'
            }
            endAdornment={
              <InputAdornment position='end'>
                <IconButton
                  edge='end'
                  disabled={loading}
                  onClick={toggleValueVisibility}
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
            value={temp?.description || ``}
            id='tdsk-secret-description-input'
            placeholder='Enter description (optional)'
            onChange={(e) => updateTemp({ description: e.target.value })}
          />
        </Box>
      </form>
    </Drawer>
  )
}
