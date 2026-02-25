import type { Secret } from '@tdsk/domain'
import { useMemo } from 'react'
import { EntitySelector } from './EntitySelector'

export type TSecretsSelector = {
  loading: boolean
  secretsList: Secret[]
  selectedSecrets: string[]
  onChange: (secretIds: string[]) => void
}

const secretScope = (secret: Secret) => {
  if (secret.projectId) return 'Project'
  if (secret.providerId) return 'Provider'
  if (secret.agentId) return 'Agent'
  return 'Org'
}

export const SecretsSelector = (props: TSecretsSelector) => {
  const { loading, onChange, secretsList, selectedSecrets } = props

  const options = useMemo(
    () =>
      secretsList.map((s) => ({
        id: s.id,
        label: s.name || s.hashKey || 'Unknown',
        secondary: secretScope(s),
      })),
    [secretsList]
  )

  return (
    <EntitySelector
      id='agent-secrets'
      title='Associated Secrets'
      label='Associated Secrets'
      loading={loading}
      value={selectedSecrets}
      options={options}
      onChange={onChange}
      placeholder='Secrets...'
      description='Select secrets that this agent can access'
    />
  )
}
