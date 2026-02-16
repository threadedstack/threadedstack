import type { Secret } from '@tdsk/domain'
import {
  setSecrets,
  getSecrets,
  getOrgSecrets,
  setOrgSecrets,
} from '@TAF/state/accessors'

export const upsertSecret = (secret: Secret) => {
  setSecrets({
    ...getSecrets(),
    [secret.id]: secret,
  })
}

export const upsertOrgSecret = (secret: Secret) => {
  setOrgSecrets({
    ...getOrgSecrets(),
    [secret.id]: secret,
  })
}
