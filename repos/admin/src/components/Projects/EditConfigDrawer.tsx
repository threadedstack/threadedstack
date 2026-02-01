/**
 * TODO: refactor this component.
 * Update component to use `@tdsk/components` form inputs like TextInput, and SelectInput
 * Configs can be Objects only, there are not different configs type like string/number/boolean
 * Update to use KeyValueEditor for `config.data` properties
 */
import type { Config } from '@tdsk/domain'

import { Box } from '@mui/material'
import { useState, useEffect } from 'react'
import { updateConfig, deleteConfig } from '@TAF/actions/configs'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import {
  ConfirmDelete,
  Drawer,
  DrawerActions,
  TextInput,
  SelectInput,
} from '@tdsk/components'

export type TEditConfigDrawer = {
  open: boolean
  config: Config | null
  onClose: () => void
  onSuccess?: () => void
}

// TODO: Fix this - NOT how configs work at all!
const CONFIG_TYPES = [
  { value: `string`, label: `String` },
  { value: `number`, label: `Number` },
  { value: `boolean`, label: `Boolean` },
  { value: `json`, label: `JSON` },
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

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!config) {
      return
    }

    if (!key.trim()) return setError(`Configuration key is required`)

    if (!value.trim()) return setError(`Configuration value is required`)

    if (!validateValue(value, type)) return setError(`Invalid value for type "${type}"`)

    setLoading(true)
    setError(null)

    const result = await updateConfig(config.id, {})

    setLoading(false)

    if (result.error) {
      setError(`Failed to update configuration. Please try again.`)
    } else {
      onSuccessCB?.()
      onClose()
    }
  }

  const onRemove = async () => {
    if (!config) return

    setLoading(true)
    setError(null)

    const result = await deleteConfig(config.id)

    setLoading(false)

    if (result.error) {
      setError(`Failed to delete configuration. Please try again.`)
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
      title='Edit Configuration'
      actionsSx={{ justifyContent: 'space-between', px: 3, pb: 2 }}
      actions={
        <DrawerActions
          editing={true}
          actions={actions}
          loading={loading}
          form='edit-config-form'
          disabled={loading || showDeleteConfirm}
        />
      }
    >
      <form id='edit-config-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {showDeleteConfirm && (
            <ConfirmDelete
              deleting={loading}
              onConfirm={onRemove}
              itemName={config?.id || 'Config'}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}

          <TextInput
            autoFocus
            required
            fullWidth
            value={key}
            id='config-key'
            disabled={loading}
            label='Configuration Key'
            onChange={(e) => setKey(e.target.value)}
            placeholder='Enter key (e.g., MAX_RETRIES)'
          />

          <SelectInput
            label='Type'
            value={type}
            id='config-type'
            disabled={loading}
            items={CONFIG_TYPES}
            onChange={(e) => setType(e.target.value)}
          />

          <TextInput
            id='config-value'
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
            textarea={type === 'json'}
            minRows={type === 'json' ? 3 : 1}
            description={
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
