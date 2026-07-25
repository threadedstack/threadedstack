import type { TCollectionWithCount } from '@tdsk/domain'
import { getContextCollections, setContextCollections } from '@TAF/state/accessors'

export const upsertCollection = (
  projectId: string,
  collection: Omit<TCollectionWithCount, `recordCount`> & { recordCount?: number }
) => {
  const current = getContextCollections(projectId) || {}
  const existing = current[collection.id]

  setContextCollections(projectId, {
    ...current,
    [collection.id]: {
      recordCount: 0,
      ...existing,
      ...collection,
    } as TCollectionWithCount,
  })
}
