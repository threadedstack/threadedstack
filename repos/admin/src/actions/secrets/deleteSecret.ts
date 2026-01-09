import { secretsApi } from '@TAF/services'
import { setSecrets, getSecrets } from '@TAF/state/accessors'

export type TDeleteSecretResult = {
  success?: boolean
  error?: Error
}

export const deleteSecret = async (id: string): Promise<TDeleteSecretResult> => {
  const resp = await secretsApi.delete(id)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove secret from state
  const currentSecrets = getSecrets() || {}
  const { [id]: removed, ...remainingSecrets } = currentSecrets
  setSecrets(remainingSecrets)

  return { success: true }
}
