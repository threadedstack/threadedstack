import { useState } from 'react'
import { createFunction } from '@TAF/actions/functions'
import {
  Box,
  Alert,
  Dialog,
  Button,
  MenuItem,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TCreateFunctionDialog = {
  open: boolean
  repoId: string
  onClose: () => void
  onSuccess?: () => void
}

// TODO: move to domain repo, figure out actually allow languages
const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
]

export const CreateFunctionDialog = ({
  open,
  repoId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TCreateFunctionDialog) => {
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('typescript')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (!loading) {
      setName('')
      setLanguage('typescript')
      setDescription('')
      setError(null)
      onCloseCB?.()
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Function name is required')
      return
    }

    setLoading(true)
    setError(null)

    const result = await createFunction({
      repoId,
      code: '',
      name: name.trim(),
      runtime: language,
      description: description.trim() || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError('Failed to create function. Please try again.')
    } else {
      onClose()
      onSuccessCB?.()
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
        <DialogTitle>Create New Function</DialogTitle>
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

            <TextField
              select
              label='Language'
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              required
              fullWidth
              disabled={loading}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <MenuItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label='Description'
              placeholder='Enter function description (optional)'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              disabled={loading}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            variant='contained'
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Function'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
