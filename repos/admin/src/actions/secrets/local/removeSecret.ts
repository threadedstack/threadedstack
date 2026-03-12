import {
  getOrgSecrets,
  setOrgSecrets,
  getProjectSecrets,
  setProjectSecrets,
} from '@TAF/state/accessors'

export const removeSecret = (projectId: string, id: string) => {
  const current = getProjectSecrets(projectId) || {}
  const { [id]: _, ...secrets } = current
  setProjectSecrets(projectId, secrets)
}

export const removeOrgSecret = (id: string) => {
  const current = getOrgSecrets() || {}
  const { [id]: _, ...secrets } = current
  setOrgSecrets(secrets)
}
