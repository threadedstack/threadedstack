import type { Secret } from '@tdsk/domain'

import { secretsApi } from '@TAF/services'
import { setSecrets } from '@TAF/state/accessors'

export type TFetchSecretsResult = {
  secrets?: Record<string, Secret>
  error?: Error
}

export const fetchSecrets = async (filters?: {
  teamId?: string
  repoId?: string
}): Promise<TFetchSecretsResult> => {
  const resp = await secretsApi.list(filters)

  if (resp.error) {
    return { error: resp.error }
  }

  const secretsMap =
    resp.data?.reduce((acc: Record<string, Secret>, secret: Secret) => {
      acc[secret.id] = secret
      return acc
    }, {}) || {}

  setSecrets(secretsMap)
  return { secrets: secretsMap }
}
