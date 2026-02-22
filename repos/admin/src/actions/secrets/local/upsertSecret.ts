import type { Secret } from '@tdsk/domain'
import {
  getProjectSecrets,
  setProjectSecrets,
  getOrgSecrets,
  setOrgSecrets,
} from '@TAF/state/accessors'

export const upsertSecret = (projectId: string, secret: Secret) => {
  const current = getProjectSecrets(projectId) || {}
  setProjectSecrets(projectId, { ...current, [secret.id]: secret })
}

export const upsertOrgSecret = (secret: Secret) => {
  setOrgSecrets({
    ...getOrgSecrets(),
    [secret.id]: secret,
  })
}
