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
  setProjects,
  setSandboxes,
  setActiveOrgRole,
} from '@TTH/state/accessors'

let initPromise: Promise<void> | null = null

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

  // Restore saved org selection — scope loaders will override if the URL
  // contains an orgId, but pre-loading the saved org's data avoids a
  // second fetch when the user lands on /orgs/:savedOrgId.
  const savedOrgId = storage.get<string>(ActiveOrgIdStorageKey)
  const validSaved = savedOrgId && orgsResult.data?.some((o) => o.id === savedOrgId)
  const orgId = validSaved
    ? savedOrgId
    : resp.session?.activeOrganizationId ||
      (orgsResult.data?.length === 1 ? orgsResult.data[0].id : undefined)

  if (!orgId) return

  setOrgId(orgId)
  storage.set(ActiveOrgIdStorageKey, orgId)

  const selectedOrg = orgsResult.data?.find((o) => o.id === orgId)
  setActiveOrgRole((selectedOrg as TOrgWithRole)?.userRole ?? null)

  const [sandboxResult, projectResult] = await Promise.all([
    listSandboxes({ orgId }),
    listProjects({ orgId }),
  ])

  if (sandboxResult.data) setSandboxes(sandboxResult.data)
  if (projectResult.data) setProjects(projectResult.data)
}

export const init = () => {
  if (!initPromise)
    initPromise = initOnce().catch((err) => {
      initPromise = null
      throw err
    })

  return initPromise
}
