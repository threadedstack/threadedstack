import { orgsApi } from '@TAF/services'
import { setOrgs, getOrgs } from '@TAF/state/accessors'

/**
 * Fetch orgs and reconcile them into state.
 *
 * Entries are always merged per-entry instead of replaced wholesale: the list
 * endpoint's entries lack detail-only fields (e.g. resolvedPermissions), so a
 * plain replace can downgrade the active org loaded by fetchOrg when both
 * loaders run in parallel (the original clobber race).
 *
 * A full (non-paginated) refresh is authoritative for which orgs exist, so
 * entries absent from the response are evicted (orgs deleted server-side).
 * A paginated fetch only sees one page, so nothing can be evicted safely and
 * entries outside the page are preserved.
 */
export const fetchOrgs = async (params?: { limit?: number; offset?: number }) => {
  const resp = await orgsApi.list(params)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const current = getOrgs() || {}
    const paginated = params?.limit !== undefined || params?.offset !== undefined
    const merged: typeof current = paginated ? { ...current } : {}

    for (const [id, org] of Object.entries(resp.data)) {
      merged[id] = { ...current[id], ...org }
    }

    setOrgs(merged)
  }

  return resp
}
