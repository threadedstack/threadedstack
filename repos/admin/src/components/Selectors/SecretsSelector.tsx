import type { Secret } from '@tdsk/domain'

import { useMemo } from 'react'
import { EntitySelector } from './EntitySelector'

export type TSecretsSelector = {
  loading: boolean
  required?: boolean
  secretsList: Secret[]
  selectedSecrets: string[]
  onChange: (secretIds: string[]) => void
}

const secretScope = (secret: Secret) => {
  if (secret.agentId) return `Agent`
  if (secret.projectId) return `Project`
  if (secret.providerId) return `Provider`
  return `Org`
}

export const SecretsSelector = (props: TSecretsSelector) => {
  const { loading, onChange, secretsList, required, selectedSecrets } = props

  const options = useMemo(
    () =>
      secretsList.map((s) => ({
        id: s.id,
        label: s.name || s.hashKey || `Unknown`,
        secondary: secretScope(s),
      })),
    [secretsList]
  )

  return (
    <EntitySelector
      id='agent-secrets'
      loading={loading}
      options={options}
      required={required}
      onChange={onChange}
      value={selectedSecrets}
      placeholder='Secrets...'
      title='Associated Secrets'
      label='Associated Secrets'
      description='Select secrets that this agent can access'
    />
  )
}
