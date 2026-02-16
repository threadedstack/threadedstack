import {
  setSecrets,
  getSecrets,
  getOrgSecrets,
  setOrgSecrets,
} from '@TAF/state/accessors'

export const removeSecret = (id: string) => {
  const current = getSecrets() || {}
  const { [id]: removed, ...secrets } = current
  setSecrets(secrets)
}

export const removeOrgSecret = (id: string) => {
  const current = getOrgSecrets() || {}
  const { [id]: removed, ...secrets } = current
  setOrgSecrets(secrets)
}
