import { useState, useEffect } from 'react'
import type { Function as TDFunction } from '@tdsk/domain'
import { updateFunction, deleteFunction } from '@TAF/actions/functions'
import {
  Box,
  Alert,
  Button,
  Dialog,
  Select,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TEditFunctionDialog = {
  open: boolean
  func: TDFunction | null
  onClose: () => void
  onSuccess?: () => void
}

// TODO: move to domain repo, normalize with other functions
const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
]

export const EditFunctionDialog = ({
  open,
  func,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TEditFunctionDialog) => {
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (func) {
      setName(func.name || '')
      setLanguage(func.language || 'typescript')
      setDescription(func.description || '')
      setError(null)
      setShowDeleteConfirm(false)
    }
  }, [func])

  const onClose = () => {
    if (!loading) {
      setName('')
      setLanguage('')
      setDescription('')
      setError(null)
      setShowDeleteConfirm(false)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!func) {
      return
    }

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

    const result = await updateFunction(func.id, {
      name: name.trim(),
      runtime: language,
      description: description.trim() || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError('Failed to update function. Please try again.')
    } else {
      onSuccessCB?.()
      onClose()
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
      fullWidth
    >
      <form onSubmit={onSubmit}>
        <DialogTitle>Edit Function</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {error && (
              <Alert
                severity='error'
                onClose={() => setError(null)}
              >
                {error}
              </Alert>
            )}

            {showDeleteConfirm && (
              <Alert
                severity='warning'
                action={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      color='inherit'
                      size='small'
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      color='inherit'
                      size='small'
                      onClick={onDelete}
                      disabled={loading}
                    >
                      {loading ? 'Deleting...' : 'Confirm'}
                    </Button>
                  </Box>
                }
              >
                Are you sure you want to delete "{func?.name || 'this function'}"?
              </Alert>
            )}

            <TextField
              autoFocus
              label='Function Name'
              placeholder='Enter function name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <FormControl
              fullWidth
              required
              disabled={loading}
            >
              <InputLabel id='function-language-label'>Language</InputLabel>
              <Select
                labelId='function-language-label'
                value={language}
                label='Language'
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <MenuItem
                    key={lang.value}
                    value={lang.value}
                  >
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label='Description'
              placeholder='Enter function description (optional)'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              disabled={loading}
              helperText='Optional: Brief description of what this function does'
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button
            color='error'
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading || showDeleteConfirm}
          >
            Delete
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              variant='contained'
              disabled={loading || showDeleteConfirm}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  )
}
