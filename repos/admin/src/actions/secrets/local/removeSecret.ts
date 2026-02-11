import { setSecrets, getSecrets } from '@TAF/state/accessors'

export const removeSecret = (id: string) => {
  const current = getSecrets() || {}
  const { [id]: removed, ...secrets } = current
  setSecrets(secrets)
}
