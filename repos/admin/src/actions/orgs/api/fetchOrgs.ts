import { orgsApi } from '@TAF/services'
import { setOrgs, getOrgs } from '@TAF/state/accessors'

export const fetchOrgs = async () => {
  const resp = await orgsApi.list()

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Merge the list into existing state instead of replacing it.
    // The list endpoint is paginated and its entries lack detail-only fields
    // (e.g. resolvedPermissions), so replacing the map can evict or downgrade
    // the active org loaded by fetchOrg when both loaders run in parallel.
    const current = getOrgs() || {}
    const merged = { ...current }
    for (const [id, org] of Object.entries(resp.data)) {
      merged[id] = { ...current[id], ...org }
    }
    setOrgs(merged)
  }

  return resp
}
