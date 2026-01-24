import type { Secret } from '@tdsk/domain'

import { secretsApi } from '@TAF/services'
import { setSecrets, getSecrets } from '@TAF/state/accessors'

export const updateSecret = async (id: string, input: Partial<Secret>) => {
  const resp = await secretsApi.update(id, input)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update secrets state with the updated secret
    const currentSecrets = getSecrets() || {}
    setSecrets({ ...currentSecrets, [resp.data.id]: resp.data })
  }

  return resp
}
