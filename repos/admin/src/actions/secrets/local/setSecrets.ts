import type { Secret } from '@tdsk/domain'
import { setProjectSecrets } from '@TAF/state/accessors'
import { setOrgSecrets as setOrgSecs } from '@TAF/state/accessors'

export const setSecrets = (projectId: string, secrets: Secret[]) => {
  const mapped = secrets.reduce(
    (acc, secret) => {
      acc[secret.id] = secret
      return acc
    },
    {} as Record<string, Secret>
  )
  setProjectSecrets(projectId, mapped)
}

export const setOrgSecrets = (secrets: Secret[]) => {
  const mapped = secrets.reduce(
    (acc, secret) => {
      acc[secret.id] = secret
      return acc
    },
    {} as Record<string, Secret>
  )
  setOrgSecs(mapped)
}
