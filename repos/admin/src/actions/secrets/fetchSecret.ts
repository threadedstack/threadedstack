import type { Secret } from '@tdsk/domain'

import { secretsApi } from '@TAF/services'
import { setSecrets, getSecrets } from '@TAF/state/accessors'

export type TFetchSecretResult = {
  secret?: Secret
  error?: Error
}

export const fetchSecret = async (id: string): Promise<TFetchSecretResult> => {
  const resp = await secretsApi.get(id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update secrets state with the fetched secret
    const currentSecrets = getSecrets() || {}
    setSecrets({ ...currentSecrets, [resp.data.id]: resp.data })
  }

  return { secret: resp.data }
}
