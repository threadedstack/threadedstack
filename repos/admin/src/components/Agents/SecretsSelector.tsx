import type { Secret } from '@tdsk/domain'

import { Box, Stack, Switch, Typography, FormControlLabel } from '@mui/material'

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
      <Typography
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Associated Secrets
      </Typography>
      <Typography
        variant='caption'
        color='text.secondary'
        sx={{ display: 'block', mb: 1 }}
      >
        Select secrets that this agent can access
      </Typography>
      {secretsList.length === 0 ? (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          No secrets available. Create secrets first to associate them with this agent.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {secretsList.map((secret) => {
            const secretId = secret.id || secret.name || secret.hashKey || ''
            return (
              <FormControlLabel
                key={secret.id}
                control={
                  <Switch
                    disabled={loading}
                    onChange={() => onToggle(secretId)}
                    checked={selectedSecrets.includes(secretId)}
                  />
                }
                label={secret.name || secret.hashKey}
              />
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
