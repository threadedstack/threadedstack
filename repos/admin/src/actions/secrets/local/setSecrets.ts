import type { Secret } from '@tdsk/domain'
import { setProjectSecrets, setOrgSecrets as setOrgSecs } from '@TAF/state/accessors'

const toRecord = (secrets: Secret[]) =>
  Object.fromEntries(secrets.map((s) => [s.id, s])) as Record<string, Secret>

export const setSecrets = (projectId: string, secrets: Secret[]) => {
  setProjectSecrets(projectId, toRecord(secrets))
}

export const setOrgSecrets = (secrets: Secret[]) => {
  setOrgSecs(toRecord(secrets))
}
