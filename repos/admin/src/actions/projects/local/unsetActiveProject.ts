import { nav } from '@TAF/services/nav'
import {
  getActiveOrgId,
  resetProjects,
  resetActiveProjectId,
  resetEndpoints,
  resetFunctions,
  resetAgents,
  resetSecrets,
  resetDomains,
  resetThreads,
  resetMessages,
  resetAssets,
} from '@TAF/state/accessors'

export const unsetActiveProject = (navigate?: boolean) => {
  resetProjects()
  resetActiveProjectId()
  // Reset all scope-keyed atoms (clears all project + org keys)
  resetEndpoints()
  resetFunctions()
  resetAgents()
  resetSecrets()
  resetDomains()
  resetThreads()
  resetMessages()
  resetAssets()

  if (!navigate) return

  const orgId = getActiveOrgId()
  nav.to(`/orgs/${orgId}/projects`)
}
