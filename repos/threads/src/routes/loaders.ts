import type { LoaderFunctionArgs } from 'react-router'
import type { TOrgWithRole } from '@tdsk/domain'

import { toast } from 'sonner'
import { init } from '@TTH/actions/init'
import { storage } from '@TTH/services/storage'
import { ActiveOrgIdStorageKey } from '@TTH/constants/storage'
import { listProjects } from '@TTH/actions/projects/listProjects'
import { listSandboxes } from '@TTH/actions/sandboxes/listSandboxes'
import { fetchSandboxSessions } from '@TTH/actions/sandboxes/fetchSandboxSessions'
import {
  getOrgs,
  getOrgId,
  setOrgId,
  getProjects,
  setProjects,
  setSandboxes,
  setActiveOrgRole,
  setActiveProjectId,
  resetActiveProjectId,
} from '@TTH/state/accessors'

/**
 * Best-effort fetch for page/detail loaders.
 * Fires the fetch without awaiting — navigation completes immediately and
 * data loads in the background.
 * Components read from Jotai and re-render when data arrives.
 */
const safeFetch = (fn: () => Promise<any>) => {
  fn()?.catch((err: unknown) => {
    console.warn(
      `[Loader] Background fetch failed:`,
      err instanceof Error ? err.message : err
    )
  })
}

export const rootLoader = async () => {
  try {
    await init()
  } catch (err) {
    console.error(`[rootLoader] init failed:`, err)
    toast.error(`Failed to load application`, {
      description: err instanceof Error ? err.message : `Please refresh to try again`,
    })
  }
  return null
}

export const orgScopeLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId } = params
  if (!orgId) return null

  // Set org state
  const currentOrgId = getOrgId()
  if (currentOrgId !== orgId) {
    setOrgId(orgId)
    storage.set(ActiveOrgIdStorageKey, orgId)

    const orgs = getOrgs()
    const selectedOrg = orgs.find((o) => o.id === orgId)
    setActiveOrgRole((selectedOrg as TOrgWithRole)?.userRole ?? null)

    // Clear and re-fetch scoped data when switching orgs
    setSandboxes([])
    setProjects([])
    resetActiveProjectId()
  }

  // Fetch projects and sandboxes if not loaded
  if (!getProjects().length || currentOrgId !== orgId) {
    safeFetch(async () => {
      const [sandboxResult, projectResult] = await Promise.all([
        listSandboxes({ orgId }),
        listProjects({ orgId }),
      ])
      if (sandboxResult.data) setSandboxes(sandboxResult.data)
      if (projectResult.data) setProjects(projectResult.data)
    })
  }

  return null
}

export const projectScopeLoader = async ({ params }: LoaderFunctionArgs) => {
  const { projectId } = params
  if (!projectId) return null

  setActiveProjectId(projectId)
  return null
}

export const sandboxLoader = async ({ params }: LoaderFunctionArgs) => {
  const { orgId, sandboxId, projectId } = params
  if (!sandboxId || !orgId || !projectId) return null

  safeFetch(() => fetchSandboxSessions({ orgId, sandboxId, projectId }))
  return null
}
