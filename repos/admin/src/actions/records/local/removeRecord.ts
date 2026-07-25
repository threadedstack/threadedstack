import { getContextRecords, setContextRecords } from '@TAF/state/accessors'

export const removeRecord = (projectId: string, collectionName: string, id: string) => {
  const current = getContextRecords(projectId, collectionName) || {}
  const { [id]: _, ...records } = current
  setContextRecords(projectId, collectionName, records)
}
