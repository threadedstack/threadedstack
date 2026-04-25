import type { TOrgWithRole } from '@tdsk/domain'

import { auth } from '@TTH/services/auth'
import { orgsApi } from '@TTH/services/orgsApi'
import { storage } from '@TTH/services/storage'
import { ActiveOrgIdStorageKey } from '@TTH/constants/storage'
import { listProjects } from '@TTH/actions/projects/listProjects'
import { listSandboxes } from '@TTH/actions/sandboxes/listSandboxes'
import {
  setOrgs,
  setUser,
  setOrgId,
  setSandboxes,
  setProjects,
  setActiveOrgRole,
} from '@TTH/state/accessors'

let initPromise: Promise<void> | null = null

export const init = () => {
  if (!initPromise) initPromise = initOnce()
  return initPromise
}

const initOnce = async () => {
  let resp
  try {
    resp = await auth.session()
  } catch (err) {
    console.warn(`[init] Auth session check failed:`, err)
    return
  }
  if (!resp?.user) return

  setUser(resp.user)

  // Fetch org list
  const orgsResult = await orgsApi.list()
  if (orgsResult.data?.length) setOrgs(orgsResult.data)

  // Restore saved org selection, or session's active org
  const savedOrgId = storage.get<string>(ActiveOrgIdStorageKey)
  const validSaved = savedOrgId && orgsResult.data?.some((o) => o.id === savedOrgId)
  const orgId = validSaved
    ? savedOrgId
    : resp.session?.activeOrganizationId ||
      // Auto-select when user belongs to exactly one org
      (orgsResult.data?.length === 1 ? orgsResult.data[0].id : undefined)

  // Multiple orgs with no selection — UI will show org picker
  if (!orgId) return

  setOrgId(orgId)
  storage.set(ActiveOrgIdStorageKey, orgId)

  // Set the user's role for the selected org
  const selectedOrg = orgsResult.data?.find((o) => o.id === orgId)
  setActiveOrgRole((selectedOrg as TOrgWithRole)?.userRole ?? null)

  const [sandboxResult, projectResult] = await Promise.all([
    listSandboxes({ orgId }),
    listProjects({ orgId }),
  ])

  if (sandboxResult.data) setSandboxes(sandboxResult.data)
  if (projectResult.data) setProjects(projectResult.data)
}
