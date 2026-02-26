import type { Thread } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const threadsState =
  atomWithReset<Record<string, Record<string, Thread>>>(undefined)
export const activeThreadIdState = atomWithReset<string>(undefined)

// Derived: org-level threads
export const orgThreadsState = atom((get) => get(threadsState)?.['org'])

// Derived: project-level threads
export const projectThreadsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(threadsState)?.[projectId] : undefined
})

// Derived: active thread (searches all scopes)
export const activeThreadState = atom((get) => {
  const threadId = get(activeThreadIdState)
  if (!threadId) return undefined
  const all = get(threadsState)
  if (!all) return undefined
  for (const scope of Object.values(all)) {
    if (scope?.[threadId]) return scope[threadId]
  }
  return undefined
})
