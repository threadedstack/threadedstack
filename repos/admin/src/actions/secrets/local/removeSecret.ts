import {
  getProjectSecrets,
  setProjectSecrets,
  getOrgSecrets,
  setOrgSecrets,
} from '@TAF/state/accessors'

export const removeSecret = (projectId: string, id: string) => {
  const current = getProjectSecrets(projectId) || {}
  const { [id]: removed, ...secrets } = current
  setProjectSecrets(projectId, secrets)
}

export const removeOrgSecret = (id: string) => {
  const current = getOrgSecrets() || {}
  const { [id]: removed, ...secrets } = current
  setOrgSecrets(secrets)
}
