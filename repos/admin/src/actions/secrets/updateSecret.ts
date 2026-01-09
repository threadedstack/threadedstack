import type { Secret } from '@tdsk/domain'

import { secretsApi } from '@TAF/services'
import { setSecrets, getSecrets } from '@TAF/state/accessors'

export type TUpdateSecretInput = {
  name?: string
  value?: string
  description?: string
}

export type TUpdateSecretResult = {
  secret?: Secret
  error?: Error
}

export const updateSecret = async (
  id: string,
  input: TUpdateSecretInput
): Promise<TUpdateSecretResult> => {
  const resp = await secretsApi.update(id, input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update secrets state with the updated secret
    const currentSecrets = getSecrets() || {}
    setSecrets({ ...currentSecrets, [resp.data.id]: resp.data })
  }

  return { secret: resp.data }
}
