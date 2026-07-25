import type { TRecordQuery } from '@tdsk/domain'
import { recordsApi } from '@TAF/services'
import { setRecords } from '@TAF/actions/records/local/setRecords'

export type TQueryRecordsOpts = {
  orgId: string
  projectId: string
  collectionName: string
  query: TRecordQuery
}

export const queryRecords = async (opts: TQueryRecordsOpts) => {
  const { orgId, projectId, collectionName, query } = opts
  const resp = await recordsApi.query(orgId, projectId, collectionName, query)
  if (resp.error) return { error: resp.error }

  resp.data && setRecords(projectId, collectionName, resp.data)
  return resp
}
