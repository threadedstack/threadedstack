import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'
import { projectMemberGuard } from '@TBE/middleware/projectMemberGuard'

import { getRecord } from '@TBE/endpoints/collections/getRecord'
import { upsertRecord } from '@TBE/endpoints/collections/upsertRecord'
import { queryRecords } from '@TBE/endpoints/collections/queryRecords'
import { deleteRecord } from '@TBE/endpoints/collections/deleteRecord'
import { getCollection } from '@TBE/endpoints/collections/getCollection'
import { listCollections } from '@TBE/endpoints/collections/listCollections'
import { createCollection } from '@TBE/endpoints/collections/createCollection'
import { updateCollection } from '@TBE/endpoints/collections/updateCollection'
import { deleteCollection } from '@TBE/endpoints/collections/deleteCollection'

/**
 * Records nested under a collection: /:name/records
 * Query: POST .../records/query. The parent group's guards + feature gate
 * cover these routes; each endpoint carries its own authorize() check.
 */
const collectionRecords: TEndpointConfig = {
  path: `/:name/records`,
  method: EPMethod.Use,
  endpoints: {
    upsertRecord,
    queryRecords,
    getRecord,
    deleteRecord,
  },
}

/**
 * Collections scoped under a project: /:orgId/projects/:projectId/collections
 * Gated by the `collections` feature flag and the project access/member guards,
 * mirroring the schedules group. Each endpoint additionally applies authorize()
 * on EPermResource.collection.
 */
export const projectCollections: TEndpointConfig = {
  path: `/:projectId/collections`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard(), featureGate(`collections`)],
  endpoints: {
    listCollections,
    getCollection,
    createCollection,
    updateCollection,
    deleteCollection,
    collectionRecords,
  },
}
