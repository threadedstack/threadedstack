import { useState } from 'react'
import { Box } from '@mui/material'
import { createConfig } from '@TAF/actions/configs'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { useDrawerActions } from '@TAF/hooks/components/useDrawerActions'
import { Drawer, DrawerActions, TextInput, SelectInput } from '@tdsk/components'

export type TCreateConfigDrawer = {
  open: boolean
  orgId: string
  projectId: string
  onClose: () => void
  onSuccess?: () => void
}

// TODO: fix this - NOT How configs work at all!
const CONFIG_TYPES = [
  { value: `json`, label: `JSON` },
  { value: `string`, label: `String` },
  { value: `number`, label: `Number` },
  { value: `boolean`, label: `Boolean` },
]

export const CreateConfigDrawer = ({
  open,
  orgId,
  projectId,
  onClose: onCloseCB,
  onSuccess: onSuccessCB,
}: TCreateConfigDrawer) => {
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

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!key.trim()) return setError('Configuration key is required')

    if (!value.trim()) return setError('Configuration value is required')

    if (!validateValue(value, type)) return setError(`Invalid value for type "${type}"`)

    setLoading(true)
    setError(null)

    // TODO: build out config options
    const result = await createConfig({
      orgId,
      data: {
        data: {},
      },
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

  const { actions } = useDrawerActions({
    onSave,
    onClose,
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title='Create Configuration'
      actions={
        <DrawerActions
          editing={false}
          actions={actions}
          loading={loading}
          disabled={loading}
          form='create-config-form'
        />
      }
    >
      <form id='create-config-form'>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && (
            <ErrorAlert
              message={error}
              onClose={() => setError(null)}
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
            placeholder='Enter key (e.g., MAX_RETRIES)'
            onChange={(e) => setKey(e.target.value)}
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
