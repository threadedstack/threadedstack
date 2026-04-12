import { storage } from '@TTH/services/storage'
import { ActiveOrgIdStorageKey } from '@TTH/constants/storage'
import { setOrgId, setSandboxes, setProjects } from '@TTH/state/accessors'
import { listSandboxes } from '@TTH/actions/sandboxes/listSandboxes'
import { listProjects } from '@TTH/actions/projects/listProjects'

export const selectOrg = async (orgId: string) => {
  setOrgId(orgId)
  storage.set(ActiveOrgIdStorageKey, orgId)
  setSandboxes([])
  setProjects([])

  const [sandboxResult, projectResult] = await Promise.all([
    listSandboxes({ orgId }),
    listProjects({ orgId }),
  ])

  if (sandboxResult.data) setSandboxes(sandboxResult.data)
  if (projectResult.data) setProjects(projectResult.data)
}
