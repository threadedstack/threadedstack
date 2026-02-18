import type { Secret } from '@tdsk/domain'
import type { HTMLAttributes } from 'react'

import Box from '@mui/material/Box'
import { cls } from '@keg-hub/jsutils/cls'
import Autocomplete from '@mui/material/Autocomplete'
import { Text, AutoInputText, InputStateHandler } from '@tdsk/components'

const styles = {
  input: { padding: `0px` },
  title: { fontWeight: 600, mb: 2 },
  item: {
    label: { fontWeight: `medium` },
  },
}

export type TSecretsSelector = {
  loading: boolean
  secretsList: Secret[]
  selectedSecrets: string[]
  onChange: (secretIds: string[]) => void
}

type TSecretItem = HTMLAttributes<HTMLLIElement> & {
  key: any
  secret: Secret
  selected?: string[]
}

const secretLabel = (secrets: Secret[]) => (id: string) => {
  const secret = secrets.find((s) => s.id === id)
  return secret ? secret.name || secret.hashKey || 'Unknown' : id
}

const secretScope = (secret: Secret) => {
  if (secret.projectId) return 'Project'
  if (secret.providerId) return 'Provider'
  if (secret.agentId) return 'Agent'
  return 'Org'
}

const SecretItem = (props: TSecretItem) => {
  const { secret, selected, ...rest } = props

  return !selected.includes(secret.id) ? (
    <li
      {...rest}
      key={secret.id}
    >
      <Box>
        <Text
          variant='body2'
          sx={styles.item.label}
        >
          {secret.name || secret.hashKey || 'Unknown'}
        </Text>
        <Text
          variant='caption'
          color='text.secondary'
        >
          {secretScope(secret)}
        </Text>
      </Box>
    </li>
  ) : null
}

export const SecretsSelector = (props: TSecretsSelector) => {
  const { loading, onChange, secretsList, selectedSecrets } = props

  const secretOptions = secretsList.map((s) => s.id)

  return (
    <Box>
      <Text
        variant='subtitle2'
        sx={styles.title}
      >
        Associated Secrets
      </Text>
      <InputStateHandler
        id='agent-secrets'
        disabled={loading}
        label='Associated Secrets'
        description='Select secrets that this agent can access'
      >
        <Autocomplete
          multiple
          id='agent-secrets'
          className={cls(`tdsk-auto-input`, loading && `disabled`)}
          value={selectedSecrets}
          options={secretOptions}
          getOptionLabel={secretLabel(secretsList)}
          onChange={(_, updates) => onChange(updates)}
          renderOption={(props, option) => {
            const secret = secretsList.find((s) => s.id === option)
            return secret ? (
              <SecretItem
                {...props}
                key={option}
                secret={secret}
                selected={selectedSecrets}
              />
            ) : null
          }}
          renderInput={(params) => (
            <AutoInputText
              {...params}
              sx={styles.input}
              placeholder='Secrets...'
            />
          )}
        />
      </InputStateHandler>
    </Box>
  )
}
