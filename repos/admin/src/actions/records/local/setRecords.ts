import type { Record as RecordModel } from '@tdsk/domain'
import { setContextRecords } from '@TAF/state/accessors'

const toRecord = (records: RecordModel[]) =>
  Object.fromEntries(records.map((r) => [r.id, r])) as Record<string, RecordModel>

export const setRecords = (
  projectId: string,
  collectionName: string,
  records: RecordModel[]
) => {
  setContextRecords(projectId, collectionName, toRecord(records))
}
