import type { Function as TDFunction } from '@tdsk/domain'

import { EFunLanguage } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { Box, Button } from '@mui/material'
import { Code } from '@TAF/components/Code/Code'
import { LanguageOpts } from '@TAF/constants/values'
import { Dialog, TextInput, SelectInput } from '@tdsk/components'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import { createFunction, updateFunction, deleteFunction } from '@TAF/actions/functions'
import { ConfirmDeleteAlert } from '@TAF/components/ConfirmDeleteAlert/ConfirmDeleteAlert'

export type TFunctionDialog = {
  open: boolean
  projectId: string
  onClose: () => void
  onSuccess?: () => void
  func?: TDFunction | null
}

/**
 * TODO: Add the following function properties as editable
  //content: string
  //endpointId: string
  //branch: string = `main`
  //defaultArgs?: Record<string, any>
  //dependencies?: Record<string, any>
 */

export const FunctionDialog = ({
  open,
  func,
  projectId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TFunctionDialog) => {
  const isEditMode = Boolean(func)

  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(func?.name || ``)
  const [loaded, setLoaded] = useState(Boolean(func?.id))
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [description, setDescription] = useState(func?.description || ``)
  const [content, setContent] = useState(func?.content || `\n\n\n\n\n\n`)
  const [language, setLanguage] = useState(func?.language || EFunLanguage.typescript)

  useEffect(() => {
    if (!func || loaded) return

    setLoaded(true)
    setName(func.name || ``)
    setDescription(func.description || ``)
    setContent(func?.content || `\n\n\n\n\n\n`)
    setLanguage(func.language || EFunLanguage.typescript)
    setError(null)
    setShowDeleteConfirm(false)
  }, [func, loaded])

  const onClose = () => {
    if (loading) return

    setName(``)
    setError(null)
    setContent(``)
    setLoaded(false)
    setDescription(``)
    setLanguage(`typescript`)
    setShowDeleteConfirm(false)
    onCloseCB?.()
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError(`Function name is required`)
      return
    }

    if (!language) {
      setError(`Language is required`)
      return
    }

    setError(null)
    setLoading(true)

    const result = isEditMode
      ? await updateFunction(func?.id, {
          name: name.trim(),
          content,
          language,
          description: description.trim() || undefined,
        })
      : await createFunction({
          projectId,
          content,
          language,
          name: name.trim(),
          description: description.trim() || undefined,
        })

    setLoading(false)

    if (result.error) {
      setError(
        `Failed to ${isEditMode ? `update` : `create`} function. Please try again.`
      )
    } else {
      onClose()
      onSuccessCB?.()
    }
  }

  const onDelete = async () => {
    if (!func) return

    setLoading(true)
    setError(null)

    const result = await deleteFunction(func.id)

    setLoading(false)

    if (result.error) {
      setError(`Failed to delete function. Please try again.`)
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      maxWidth='lg'
      onClose={onClose}
      title={isEditMode ? `Edit Function` : `Create New Function`}
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
              items={LanguageOpts}
              required
              disabled={loading}
            />

            <TextInput
              textarea
              fullWidth
              minRows={3}
              disabled={loading}
              label='Description'
              value={description}
              id='function-description'
              placeholder='Enter function description (optional)'
              onChange={(e) => setDescription(e.target.value)}
            />

            <Code
              required
              label='Content'
              disabled={loading}
              language={language}
              id='function-content'
              defaultValue={content || `\n\n\n\n\n\n`}
              onChange={(data: string) => setContent(data)}
              placeholder={`The ${language} code....`}
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
