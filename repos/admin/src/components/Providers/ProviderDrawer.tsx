import type { Provider, TProviderType } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { Box } from '@mui/material'
import { ProviderTypes } from '@TAF/constants/providers'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { createProvider, updateProvider, deleteProvider } from '@TAF/actions/providers'
import {
  ConfirmDelete,
  Drawer,
  DrawerActions,
  TextInput,
  SelectInput,
} from '@tdsk/components'

export type TProviderDrawer = {
  open: boolean
  orgId: string
  provider?: Provider | null
  onClose: () => void
  onSuccess?: () => void
}

export const ProviderDrawer = ({
  open,
  orgId,
  provider,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TProviderDrawer) => {
  const isEditMode = Boolean(provider)

  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Pre-populate form in edit mode
  useEffect(() => {
    if (provider) {
      const options = provider.options || {}
      setName(options.name || '')
      setType(provider.type || '')
      setBaseUrl(options.baseUrl || '')
      setError(null)
      setShowDeleteConfirm(false)
    } else {
      // Reset form in create mode
      setName('')
      setType('')
      setBaseUrl('')
      setError(null)
      setShowDeleteConfirm(false)
    }
  }, [provider])

  const onClose = () => {
    if (loading) return

    setName('')
    setType('')
    setBaseUrl('')
    setError(null)
    setShowDeleteConfirm(false)
    onCloseCB?.()
  }

  const onSave = async (evt: React.FormEvent) => {
    evt.preventDefault()

    if (!name.trim()) {
      setError('Provider name is required')
      return
    }

    if (!type) {
      setError('Provider type is required')
      return
    }

    setLoading(true)
    setError(null)

    const providerType = type as TProviderType
    const providerData = {
      type: providerType,
      options: {
        name: name.trim(),
        ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
      },
    }

    const result =
      isEditMode && provider
        ? await updateProvider(provider.id, providerData)
        : await createProvider({ orgId, ...providerData })

    setLoading(false)

    if (result.error) {
      setError(
        `Failed to ${isEditMode ? 'update' : 'create'} provider. Please try again.`
      )
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const onRemove = async () => {
    if (!provider) return

    setLoading(true)
    setError(null)

    const result = await deleteProvider(provider.id)

    setLoading(false)

    if (result.error) {
      setError('Failed to delete provider. Please try again.')
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const { actions } = useDrawerActions({
    onSave,
    onClose,
    onRemove,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEditMode ? 'Edit Provider' : 'Create New Provider'}
      actionsSx={{
        justifyContent: isEditMode ? 'space-between' : 'flex-end',
        px: 3,
        pb: 2,
      }}
      actions={
        <DrawerActions
          form='provider-form'
          editing={isEditMode}
          actions={actions}
          loading={loading}
          disabled={loading || showDeleteConfirm}
        />
      }
    >
      <form id='provider-form'>
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
              onConfirm={onRemove}
              onCancel={() => setShowDeleteConfirm(false)}
              itemName={provider?.options?.name || 'this provider'}
            />
          )}

          <TextInput
            id='provider-name'
            label='Provider Name'
            placeholder='Enter provider name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            disabled={loading}
          />

          <SelectInput
            id='provider-type'
            label='Provider Type'
            value={type}
            onChange={(e) => setType(e.target.value)}
            items={ProviderTypes}
            required
            disabled={loading}
          />

          <TextInput
            id='provider-base-url'
            label='Base URL'
            placeholder='https://api.example.com (optional)'
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            fullWidth
            disabled={loading}
          />
        </Box>
      </form>
    </Drawer>
  )
}
