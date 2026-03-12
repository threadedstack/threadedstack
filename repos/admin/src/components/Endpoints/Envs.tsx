import type { TKeyValuePair } from '@TAF/types'
import type { Secret } from '@tdsk/domain'

import { Alert, Box } from '@mui/material'
import { TextInput } from '@tdsk/components'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'

export type TEnvs = {
  secrets: string[]
  disabled: boolean
  helperText?: string
  secretsList: Secret[]
  envVarsLabel?: string
  secretsLabel?: string
  envVars: TKeyValuePair[]
  onSecretsChange: (secrets: string[]) => void
  onEnvVarsChange: (pairs: TKeyValuePair[]) => void
}

export const Envs = (props: TEnvs) => {
  const { envVars, secrets, secretsList, disabled, onEnvVarsChange, onSecretsChange } =
    props

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <KeyValueEditor
        pairs={envVars}
        disabled={disabled}
        secrets={secretsList}
        enableSecretReferences={true}
        keyPlaceholder='Variable Name'
        valuePlaceholder='Variable Value or {{secret-name}}'
        onChange={onEnvVarsChange}
      />
      <TextInput
        fullWidth
        multiline
        value={secrets.join(', ')}
        label='Exposed Secrets (comma-separated)'
        placeholder='secret1, secret2'
        disabled={disabled}
        id='exposed-secrets'
        onChange={(e) => {
          const secretsList = e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
          onSecretsChange(secretsList)
        }}
        helperText={
          props.helperText || 'Secret IDs that will be available during execution'
        }
      />
      <Alert
        severity='info'
        sx={{ fontSize: '0.875rem' }}
      >
        Environment variables and secrets exposed during execution. Use {'{'} {'}'} and{' '}
        {'{'} {'}'} to reference secrets.
      </Alert>
    </Box>
  )
}
