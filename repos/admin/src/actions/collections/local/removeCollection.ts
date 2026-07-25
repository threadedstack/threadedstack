import { getContextCollections, setContextCollections } from '@TAF/state/accessors'

export const removeCollection = (projectId: string, id: string) => {
  const current = getContextCollections(projectId) || {}
  const { [id]: _, ...rest } = current
  setContextCollections(projectId, rest)
}
