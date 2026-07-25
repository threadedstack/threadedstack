import type { Record as RecordModel } from '@tdsk/domain'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId -> collectionName -> recordId -> RecordModel
export const recordsState =
  atomWithReset<Record<string, Record<string, Record<string, RecordModel>>>>(undefined)

// Derived: project-level records, keyed by collectionName -> recordId -> RecordModel
export const projectRecordsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(recordsState)?.[projectId] : undefined
})
