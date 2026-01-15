import type { Endpoint } from '@tdsk/domain'

import { useState, useEffect } from 'react'
import { Box, Alert, Button } from '@mui/material'
import { HttpMethods } from '@TAF/constants/values'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { Dialog, TextInput, SelectInput, SwitchInput } from '@tdsk/components'
import { createEndpoint, updateEndpoint, deleteEndpoint } from '@TAF/actions/endpoints'
import { ConfirmDeleteAlert } from '@TAF/components/ConfirmDeleteAlert/ConfirmDeleteAlert'

export type TEndpointDialog = {
  open: boolean
  projectId: string
  endpoint?: Endpoint | null
  onClose: () => void
  onSuccess?: () => void
}

export const EndpointDialog = (props: TEndpointDialog) => {
  const { open, endpoint, projectId, onClose: onCloseCB, onSuccess: onSuccessCB } = props

  const isEditMode = Boolean(endpoint)

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [method, setMethod] = useState<string>(`GET`)
  const [error, setError] = useState<string | null>(null)
  const [publicEndpoint, setPublicEndpoint] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (endpoint) {
      setName(endpoint.name || '')
      setPath(endpoint.url || '')
      setMethod(endpoint.method || `GET`)
      setPublicEndpoint(endpoint.public || false)
      setError(null)
      setShowDeleteConfirm(false)
    } else {
      setName('')
      setPath('')
      setError(null)
      setMethod(`GET`)
      setPublicEndpoint(false)
      setShowDeleteConfirm(false)
    }
  }, [endpoint])

  const onClose = () => {
    if (!loading) {
      setName(``)
      setPath(``)
      setError(null)
      setMethod(`GET`)
      setPublicEndpoint(false)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Endpoint name is required')
      return
    }

    if (!path.trim()) {
      setError('Proxy URL is required')
      return
    }

    setLoading(true)
    setError(null)

    const result =
      isEditMode && endpoint
        ? await updateEndpoint(endpoint.id, {
            name: name.trim(),
            path: path.trim(),
            method,
            config: {
              public: publicEndpoint,
            },
          })
        : await createEndpoint({
            name: name.trim(),
            path: path.trim(),
            method,
            projectId,
            config: {
              public: publicEndpoint,
            },
          })

    setLoading(false)

    if (result.error) {
      const errorMessage = isEditMode
        ? `Failed to update endpoint. Please try again.`
        : `Failed to create endpoint. Please try again.`
      setError(result.error.message || errorMessage)
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const onDelete = async () => {
    if (!endpoint) return

    setLoading(true)
    setError(null)

    const result = await deleteEndpoint(endpoint.id)

    setLoading(false)

    if (result.error) {
      setError(result.error.message || `Failed to delete endpoint. Please try again.`)
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth='sm'
      title={isEditMode ? 'Edit Endpoint' : 'Create New Endpoint'}
      content={
        <form
          id='endpoint-form'
          onSubmit={onSubmit}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <ErrorAlert
                message={error}
                onClose={() => setError(null)}
              />
            )}

            {showDeleteConfirm && (
              <ConfirmDeleteAlert
                deleting={loading}
                onConfirm={onDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                itemName={name}
              />
            )}

            <TextInput
              required
              fullWidth
              value={name}
              id='endpoint-name'
              disabled={loading}
              label='Endpoint Name'
              placeholder='Enter endpoint name'
              onChange={(e) => setName(e.target.value)}
            />
            <Box sx={{ ml: 4, mt: -1 }}>
              <Alert
                severity='info'
                sx={{ fontSize: '0.875rem' }}
              >
                A descriptive name for this endpoint
              </Alert>
            </Box>

            <TextInput
              required
              fullWidth
              value={path}
              id='endpoint-url'
              label='Proxy URL'
              disabled={loading}
              placeholder='https://api.example.com/v1/users'
              onChange={(e) => setPath(e.target.value)}
            />
            <Box sx={{ ml: 4, mt: -1 }}>
              <Alert
                severity='info'
                sx={{ fontSize: '0.875rem' }}
              >
                The URL to proxy requests to
              </Alert>
            </Box>

            <SelectInput
              required
              value={method}
              id='method-select'
              disabled={loading}
              label='HTTP Method'
              onChange={(e) => setMethod(e.target.value)}
              items={HttpMethods.map((m) => ({ value: m, label: m }))}
            />

            <SwitchInput
              disabled={loading}
              id='public-endpoint'
              label='Public Endpoint'
              checked={publicEndpoint}
              onChange={(e, checked) => setPublicEndpoint(checked)}
            />
            <Box sx={{ ml: 4, mt: -1 }}>
              <Alert
                severity='info'
                sx={{ fontSize: `0.875rem` }}
              >
                {publicEndpoint
                  ? `This endpoint will be accessible without authentication`
                  : `This endpoint will require authentication to access`}
              </Alert>
            </Box>
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
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              ml: isEditMode ? 'auto' : undefined,
            }}
          >
            <Button
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <LoadingButton
              type='submit'
              loading={loading}
              variant='contained'
              form='endpoint-form'
              disabled={showDeleteConfirm}
              loadingText={isEditMode ? `Saving...` : `Creating...`}
            >
              {isEditMode ? `Save Changes` : `Create Endpoint`}
            </LoadingButton>
          </Box>
        </>
      }
    />
  )
}
