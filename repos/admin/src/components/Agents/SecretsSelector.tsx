import type { Secret } from '@tdsk/domain'

import { Box, Stack } from '@mui/material'
import { Text, SwitchInput } from '@tdsk/components'

export type TSecretsSelector = {
  loading: boolean
  secretsList: Secret[]
  selectedSecrets: string[]
  onChange: (secretIds: string[]) => void
}

export const SecretsSelector = (props: TSecretsSelector) => {
  const { loading, onChange, secretsList, selectedSecrets } = props

  const onToggle = (secretId: string) => {
    selectedSecrets.includes(secretId)
      ? onChange(selectedSecrets.filter((id) => id !== secretId))
      : onChange([...selectedSecrets, secretId])
  }

  return (
    <Box>
      <Text
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Associated Secrets
      </Text>
      <Text
        variant='caption'
        color='text.secondary'
        sx={{ display: 'block', mb: 1 }}
      >
        Select secrets that this agent can access
      </Text>
      {secretsList.length === 0 ? (
        <Text
          variant='body2'
          color='text.secondary'
        >
          No secrets available. Create secrets first to associate them with this agent.
        </Text>
      ) : (
        <Stack spacing={1}>
          {secretsList.map((secret, index) => {
            const secretId = secret.id || secret.name || secret.hashKey || ''
            return (
              <SwitchInput
                key={secret.id}
                disabled={loading}
                id={`secret-${secret.id || index}`}
                onChange={() => onToggle(secretId)}
                label={secret.name || secret.hashKey}
                checked={selectedSecrets.includes(secretId)}
              />
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
