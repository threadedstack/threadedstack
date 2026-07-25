import type { Record as RecordModel } from '@tdsk/domain'
import { getContextRecords, setContextRecords } from '@TAF/state/accessors'

export const upsertRecord = (
  projectId: string,
  collectionName: string,
  record: RecordModel
) => {
  const current = getContextRecords(projectId, collectionName) || {}
  setContextRecords(projectId, collectionName, { ...current, [record.id]: record })
}
