import type { Secret } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId
export const secretsState =
  atomWithReset<Record<string, Record<string, Secret>>>(undefined)
export const activeSecretIdState = atomWithReset<string>(undefined)

// orgSecretsState stays flat — org-only, no project variant
export const orgSecretsState = atomWithReset<Record<string, Secret>>(undefined)
export const activeOrgSecretIdState = atomWithReset<string>(undefined)

// Derived: auto-filters to active project
export const projectSecretsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(secretsState)?.[projectId] : undefined
})
