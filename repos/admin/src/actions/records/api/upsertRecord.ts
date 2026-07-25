import { recordsApi } from '@TAF/services'
import { upsertRecord as upsertRecordLocal } from '@TAF/actions/records/local/upsertRecord'

export type TUpsertRecordOpts = {
  orgId: string
  projectId: string
  collectionName: string
  data: { id?: string; data: Record<string, any> }
}

export const upsertRecord = async (opts: TUpsertRecordOpts) => {
  const { orgId, projectId, collectionName, data } = opts
  const resp = await recordsApi.upsert(orgId, projectId, collectionName, data)
  if (resp.data) upsertRecordLocal(projectId, collectionName, resp.data)

  return resp
}
