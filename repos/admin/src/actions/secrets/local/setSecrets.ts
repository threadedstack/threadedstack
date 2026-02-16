import type { Secret } from '@tdsk/domain'
import { setSecrets as setSecs, setOrgSecrets as setOrgSecs } from '@TAF/state/accessors'

export const setSecrets = (secrets: Secret[]) => {
  const mapped = secrets.reduce(
    (acc, secret) => {
      acc[secret.id] = secret
      return acc
    },
    {} as Record<string, Secret>
  )
  setSecs(mapped)
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
