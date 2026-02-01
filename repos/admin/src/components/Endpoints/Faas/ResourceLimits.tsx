import { Box, Alert } from '@mui/material'
import { TextInput } from '@tdsk/components'

export type TResourceLimitsProps = {
  timeout: string
  memory: string
  disabled: boolean
  onTimeoutChange: (value: string) => void
  onMemoryChange: (value: string) => void
  timeoutLabel?: string
  memoryLabel?: string
  timeoutPlaceholder?: string
  memoryPlaceholder?: string
}

export const ResourceLimits = (props: TResourceLimitsProps) => {
  const {
    timeout,
    memory,
    disabled,
    onTimeoutChange,
    onMemoryChange,
    timeoutLabel = 'Timeout (ms)',
    memoryLabel = 'Memory (MB)',
    timeoutPlaceholder = '30000',
    memoryPlaceholder = '256',
  } = props

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextInput
        fullWidth
        type='number'
        value={timeout}
        label={timeoutLabel}
        disabled={disabled}
        placeholder={timeoutPlaceholder}
        id='resource-timeout'
        onChange={(e) => onTimeoutChange(e.target.value)}
      />
      <TextInput
        fullWidth
        type='number'
        value={memory}
        label={memoryLabel}
        disabled={disabled}
        placeholder={memoryPlaceholder}
        id='resource-memory'
        onChange={(e) => onMemoryChange(e.target.value)}
      />
      <Alert
        severity='info'
        sx={{ fontSize: '0.875rem' }}
      >
        Execution limits. Defaults: 30s timeout, 256MB memory
      </Alert>
    </Box>
  )
}
