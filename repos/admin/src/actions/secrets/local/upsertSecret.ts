import type { Secret } from '@tdsk/domain'
import { setSecrets, getSecrets } from '@TAF/state/accessors'

export const upsertSecret = (secret: Secret) => {
  setSecrets({
    ...getSecrets(),
    [secret.id]: secret,
  })
}
