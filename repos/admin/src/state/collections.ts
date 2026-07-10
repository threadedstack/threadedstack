import type { TCollectionWithCount } from '@tdsk/domain'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId -> collectionId -> TCollectionWithCount
export const collectionsState =
  atomWithReset<Record<string, Record<string, TCollectionWithCount>>>(undefined)

// Derived: project-level collections
export const projectCollectionsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(collectionsState)?.[projectId] : undefined
})
