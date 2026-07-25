import { recordsApi } from '@TAF/services'
import { removeRecord } from '@TAF/actions/records/local/removeRecord'

export type TDeleteRecordOpts = {
  orgId: string
  projectId: string
  collectionName: string
  id: string
}

export const deleteRecord = async (opts: TDeleteRecordOpts) => {
  const { orgId, projectId, collectionName, id } = opts
  const resp = await recordsApi.delete(orgId, projectId, collectionName, id)
  if (resp.error) return { error: resp.error }

  removeRecord(projectId, collectionName, id)
  return { success: true }
}
