import type { TOrgWithRole } from '@tdsk/domain'

import { storage } from '@TTH/services/storage'
import { ActiveOrgIdStorageKey } from '@TTH/constants/storage'
import { listProjects } from '@TTH/actions/projects/listProjects'
import { listSandboxes } from '@TTH/actions/sandboxes/listSandboxes'
import {
  getOrgs,
  setOrgId,
  setSandboxes,
  setProjects,
  setActiveOrgRole,
  resetActiveProjectId,
} from '@TTH/state/accessors'

export const selectOrg = async (orgId: string) => {
  setOrgId(orgId)
  storage.set(ActiveOrgIdStorageKey, orgId)
  setSandboxes([])
  setProjects([])
  resetActiveProjectId()

  // Set the user's role for the newly selected org
  const orgs = getOrgs()
  const selectedOrg = orgs.find((o) => o.id === orgId)
  setActiveOrgRole((selectedOrg as TOrgWithRole)?.userRole ?? null)

  const [sandboxResult, projectResult] = await Promise.all([
    listSandboxes({ orgId }),
    listProjects({ orgId }),
  ])

  if (sandboxResult.data) setSandboxes(sandboxResult.data)
  if (projectResult.data) setProjects(projectResult.data)
}
