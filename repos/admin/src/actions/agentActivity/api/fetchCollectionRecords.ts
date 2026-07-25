import { recordsApi } from '@TAF/services/recordsApi'
import { setCollectionRecords } from '@TAF/actions/agentActivity/local/setAgentActivity'

/**
 * Fetch one collection's records for the activity Collections browser and write
 * them into the collection-records atom, keyed by project + collection name.
 *
 * Called from a click handler (never a loader or effect): a collection's records
 * are only read once the user opens that collection, so fetching every
 * collection up front would be wasteful. Reuses `recordsApi.query`, the same
 * injection-safe query endpoint the Collections page uses; a collection that
 * does not exist comes back as an empty list (not an error), which renders an
 * empty state rather than hanging.
 */
export const fetchCollectionRecords = async (
  orgId: string,
  projectId: string,
  collectionName: string
) => {
  const resp = await recordsApi.query(orgId, projectId, collectionName, { limit: 50 })
  if (!resp.error) setCollectionRecords(projectId, collectionName, resp.data ?? [])
  return { error: resp.error }
}
