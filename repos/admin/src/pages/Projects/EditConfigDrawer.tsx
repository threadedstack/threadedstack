/**
 * TODO: refactor this component.
 * Update component to use `@tdsk/components` form inputs like TextInput, and SelectInput
 * Configs can be Objects only, there are not different configs type like string/number/boolean
 * Update to use KeyValueEditor for `config.data` properties
 */

import type { Config } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { ConfirmDelete, Drawer } from '@tdsk/components'
import { updateConfig, deleteConfig } from '@TAF/actions/configs'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { LoadingButton } from '@TAF/components/LoadingButton/LoadingButton'
import {
  Box,
  Button,
  Select,
  MenuItem,
  TextField,
  InputLabel,
  FormControl,
} from '@mui/material'

export type TEditConfigDrawer = {
  open: boolean
  config: Config | null
  onClose: () => void
  onSuccess?: () => void
}

const CONFIG_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'json', label: 'JSON' },
]

export const EditConfigDrawer = (props: TEditConfigDrawer) => {
  const { open, config, onClose: onCloseCB, onSuccess: onSuccessCB } = props

  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [type, setType] = useState('string')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Pre-populate form with config data when dialog opens
  useEffect(() => {
    if (config) {
      // TODO: set config object here
      setError(null)
      setShowDeleteConfirm(false)
    }
  }, [config])

  const onClose = () => {
    if (!loading) {
      setKey('')
      setValue('')
      setType('string')
      setError(null)
      setShowDeleteConfirm(false)
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

    if (!config) {
      return
    }

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

    const result = await updateConfig(config.id, {})

    setLoading(false)

    if (result.error) {
      setError('Failed to update configuration. Please try again.')
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const onDelete = async () => {
    if (!config) {
      return
    }

    setLoading(true)
    setError(null)

    const result = await deleteConfig(config.id)

    setLoading(false)

    if (result.error) {
      setError('Failed to delete configuration. Please try again.')
      setShowDeleteConfirm(false)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Edit Configuration'
      actionsSx={{ justifyContent: 'space-between', px: 3, pb: 2 }}
      actions={
        <>
          <Button
            color='error'
            onClick={() => setShowDeleteConfirm(true)}
            disabled={loading || showDeleteConfirm}
          >
            Delete
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
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
              form='edit-config-form'
              variant='contained'
              loading={loading}
              disabled={showDeleteConfirm}
              loadingText='Saving...'
            >
              Save Changes
            </LoadingButton>
          </Box>
        </>
      }
    >
      <form
        id='edit-config-form'
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
            <ConfirmDelete
              itemName={config?.id || 'Config'}
              onCancel={() => setShowDeleteConfirm(false)}
              onConfirm={onDelete}
              deleting={loading}
            />
          )}

          <TextField
            autoFocus
            required
            fullWidth
            value={key}
            disabled={loading}
            label='Configuration Key'
            placeholder='Enter key (e.g., MAX_RETRIES)'
            onChange={(e) => setKey(e.target.value)}
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
      </form>
    </Drawer>
  )
}
