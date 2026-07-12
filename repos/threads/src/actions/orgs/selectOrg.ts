import type { TOrgWithRole } from '@tdsk/domain'

import { storage } from '@TTH/services/storage'
import { fetchOrg } from '@TTH/actions/orgs/fetchOrg'
import { monitorService } from '@TTH/services/monitorService'
import { listProjects } from '@TTH/actions/projects/listProjects'
import { listSandboxes } from '@TTH/actions/sandboxes/listSandboxes'
import { ActiveOrgIdStorageKey, ActiveProjectIdStorageKey } from '@TTH/constants/storage'
import {
  getOrgId,
  getOrgs,
  setOrgId,
  setSandboxes,
  setProjects,
  setActiveOrgRole,
  resetActiveProjectId,
  resetActiveOrgResolvedPerms,
} from '@TTH/state/accessors'

export const selectOrg = async (orgId: string) => {
  setOrgId(orgId)
  storage.set(ActiveOrgIdStorageKey, orgId)
  setSandboxes([])
  setProjects([])
  resetActiveProjectId()
  storage.remove(ActiveProjectIdStorageKey)

  // Reset resolved permissions for the previous org before setting the new org's role
  resetActiveOrgResolvedPerms()

  // Set the user's role for the newly selected org
  const orgs = getOrgs()
  const selectedOrg = orgs.find((o) => o.id === orgId)
  setActiveOrgRole((selectedOrg as TOrgWithRole)?.userRole ?? null)

  const [sandboxResult, projectResult] = await Promise.all([
    listSandboxes({ orgId }),
    listProjects({ orgId }),
  ])

  // A newer selectOrg() call may have already switched the active org while
  // these requests were in flight — only commit if this org is still active,
  // mirroring fetchOrg.ts's existing getOrgId() guard.
  if (getOrgId() === orgId) {
    if (sandboxResult.data) setSandboxes(sandboxResult.data)
    if (projectResult.data) setProjects(projectResult.data)
  }

  fetchOrg(orgId).catch((err: unknown) => {
    console.warn(
      `[selectOrg] Failed to load org permissions:`,
      err instanceof Error ? err.message : err
    )
  })

  monitorService.connect(orgId)
}
