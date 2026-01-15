import { useState, useEffect } from 'react'
import type { Function as TDFunction } from '@tdsk/domain'
import { createFunction, updateFunction, deleteFunction } from '@TAF/actions/functions'
import { Box, Button } from '@mui/material'
import { Dialog, TextInput, SelectInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { ConfirmDeleteAlert } from '@TAF/components/ConfirmDeleteAlert/ConfirmDeleteAlert'

export type TFunctionDialog = {
  open: boolean
  projectId: string
  func?: TDFunction | null
  onClose: () => void
  onSuccess?: () => void
}

// TODO: move to domain repo, figure out actually allowed languages
const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
]

export const FunctionDialog = ({
  open,
  projectId,
  func,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TFunctionDialog) => {
  const isEditMode = Boolean(func)

  const [name, setName] = useState('')
  const [language, setLanguage] = useState('typescript')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Pre-populate form in edit mode
  useEffect(() => {
    if (func) {
      setName(func.name || '')
      setLanguage(func.language || 'typescript')
      setDescription(func.description || '')
      setError(null)
      setShowDeleteConfirm(false)
    } else {
      setName('')
      setLanguage('typescript')
      setDescription('')
      setError(null)
      setShowDeleteConfirm(false)
    }
  }, [func])

  const onClose = () => {
    if (!loading) {
      setName('')
      setLanguage('typescript')
      setDescription('')
      setError(null)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Function name is required')
      return
    }

    if (!language) {
      setError('Language is required')
      return
    }

    setLoading(true)
    setError(null)

    const result = isEditMode
      ? await updateFunction(func?.id, {
          name: name.trim(),
          runtime: language,
          description: description.trim() || undefined,
        })
      : await createFunction({
          projectId,
          code: '',
          name: name.trim(),
          runtime: language,
          description: description.trim() || undefined,
        })

    setLoading(false)

    if (result.error) {
      setError(
        `Failed to ${isEditMode ? 'update' : 'create'} function. Please try again.`
      )
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const onDelete = async () => {
    if (!func) {
      return
    }

    setLoading(true)
    setError(null)

    const result = await deleteFunction(func.id)

    setLoading(false)

    if (result.error) {
      setError('Failed to delete function. Please try again.')
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
      title={isEditMode ? 'Edit Function' : 'Create New Function'}
      content={
        <form
          id='function-form'
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
                itemName={func?.name || 'this function'}
              />
            )}

            <TextInput
              id='function-name'
              label='Function Name'
              placeholder='Enter function name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <SelectInput
              id='function-language'
              label='Language'
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              items={LANGUAGE_OPTIONS}
              required
              disabled={loading}
            />

            <TextInput
              id='function-description'
              label='Description'
              placeholder='Enter function description (optional)'
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
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <LoadingButton
              type='submit'
              form='function-form'
              variant='contained'
              loading={loading}
              disabled={showDeleteConfirm}
              loadingText={isEditMode ? 'Saving...' : 'Creating...'}
            >
              {isEditMode ? 'Save Changes' : 'Create Function'}
            </LoadingButton>
          </Box>
        </>
      }
    />
  )
}
