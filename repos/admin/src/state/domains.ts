import type { Domain } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const domainsState =
  atomWithReset<Record<string, Record<string, Domain>>>(undefined)
export const activeDomainIdState = atomWithReset<string>(undefined)

// Derived: org-level domains
export const orgDomainsState = atom((get) => get(domainsState)?.['org'])

// Derived: project-level domains
export const projectDomainsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(domainsState)?.[projectId] : undefined
})
