import type { Secret } from '@tdsk/domain'

import { secretsApi } from '@TAF/services'
import { setSecrets, getSecrets } from '@TAF/state/accessors'

export type TCreateSecretInput = {
  name: string
  value: string
  orgId?: string
  projectId?: string
  description?: string
}

export type TCreateSecretResult = {
  secret?: Secret
  error?: Error
}

export const createSecret = async (
  input: TCreateSecretInput
): Promise<TCreateSecretResult> => {
  const resp = await secretsApi.create(input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update secrets state with the new secret
    const currentSecrets = getSecrets() || {}
    setSecrets({ ...currentSecrets, [resp.data.id]: resp.data })
  }

  return { secret: resp.data }
}
