import type { TCollectionWithCount } from '@tdsk/domain'
import { setContextCollections } from '@TAF/state/accessors'

export const setCollections = (
  projectId: string,
  collections: TCollectionWithCount[]
) => {
  const map = Object.fromEntries(collections.map((c) => [c.id, c])) as Record<
    string,
    TCollectionWithCount
  >
  setContextCollections(projectId, map)
}
