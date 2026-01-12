import { useState } from 'react'
import { createConfig } from '@TAF/actions/configs'
import {
  Box,
  Alert,
  Dialog,
  Button,
  Select,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'

export type TCreateConfigDialog = {
  open: boolean
  projectId: string
  onClose: () => void
  onSuccess?: () => void
}

const CONFIG_TYPES = [
  { value: 'json', label: 'JSON' },
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
]

export const CreateConfigDialog = ({
  open,
  projectId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TCreateConfigDialog) => {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [type, setType] = useState('string')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onClose = () => {
    if (!loading) {
      setKey('')
      setValue('')
      setType('string')
      setError(null)
      onCloseCB?.()
    }
  }

  const validateValue = (val: string, configType: string): boolean => {
    if (!val.trim()) return false

    switch (configType) {
      case 'number':
        return !Number.isNaN(Number(val))
      case 'boolean':
        return val.toLowerCase() === 'true' || val.toLowerCase() === 'false'
      case 'json':
        try {
          JSON.parse(val)
          return true
        } catch {
          return false
        }
      default:
        return true
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!key.trim()) {
      setError('Configuration key is required')
      return
    }

    if (!value.trim()) {
      setError('Configuration value is required')
      return
    }

    if (!validateValue(value, type)) {
      setError(`Invalid value for type "${type}"`)
      return
    }

    setLoading(true)
    setError(null)

    // TODO: build out config options
    const result = await createConfig({
      data: {},
      projectId,
    })

    setLoading(false)

    if (result.error) {
      setError('Failed to create configuration. Please try again.')
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
        <DialogTitle>Create Configuration</DialogTitle>
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
              label='Configuration Key'
              placeholder='Enter key (e.g., MAX_RETRIES)'
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              fullWidth
              disabled={loading}
            />

            <FormControl
              fullWidth
              disabled={loading}
            >
              <InputLabel id='config-type-label'>Type</InputLabel>
              <Select
                labelId='config-type-label'
                value={type}
                label='Type'
                onChange={(e) => setType(e.target.value)}
              >
                {CONFIG_TYPES.map((configType) => (
                  <MenuItem
                    key={configType.value}
                    value={configType.value}
                  >
                    {configType.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label='Value'
              placeholder={
                type === 'json'
                  ? '{"key": "value"}'
                  : type === 'boolean'
                    ? 'true or false'
                    : type === 'number'
                      ? '123'
                      : 'Enter value'
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              fullWidth
              disabled={loading}
              multiline={type === 'json'}
              rows={type === 'json' ? 3 : 1}
              helperText={
                type === 'json'
                  ? 'Enter valid JSON'
                  : type === 'boolean'
                    ? 'Enter true or false'
                    : type === 'number'
                      ? 'Enter a numeric value'
                      : ''
              }
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
            {loading ? 'Creating...' : 'Create Config'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
