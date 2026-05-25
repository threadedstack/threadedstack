import type { LoaderFunctionArgs } from 'react-router'
import type { TOrgWithRole } from '@tdsk/domain'

import { toast } from 'sonner'
import { init } from '@TTH/actions/init'
import { storage } from '@TTH/services/storage'
import { listProjects } from '@TTH/actions/projects/listProjects'
import { listSandboxes } from '@TTH/actions/sandboxes/listSandboxes'
import { fetchInstances } from '@TTH/actions/sandboxes/fetchInstances'
import { fetchSandboxSessions } from '@TTH/actions/sandboxes/fetchSandboxSessions'
import { ActiveOrgIdStorageKey, ActiveProjectIdStorageKey } from '@TTH/constants/storage'
import {
  getOrgs,
  getOrgId,
  setOrgId,
  getProjects,
  setProjects,
  setSandboxes,
  getWaitlisted,
  setActiveOrgRole,
  setActiveProjectId,
  resetActiveProjectId,
} from '@TTH/state/accessors'

const safeFetch = (fn: () => Promise<any>, context?: string) => {
  fn()?.catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[Loader] Background fetch failed:`, msg)
    toast.error(`Failed to load ${context || `data`}`, { id: context, description: msg })
  })
}

export const rootLoader = async () => {
  if (getWaitlisted()) return null

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
  if (getWaitlisted()) return null
  const { orgId } = params
  if (!orgId) return null

  await init()

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
    storage.remove(ActiveProjectIdStorageKey)
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
    }, `projects`)
  }

  return null
}

export const projectScopeLoader = async ({ params }: LoaderFunctionArgs) => {
  const { projectId } = params
  if (!projectId) return null

  setActiveProjectId(projectId)
  storage.set(ActiveProjectIdStorageKey, projectId)
  return null
}

export const sandboxLoader = async ({ params }: LoaderFunctionArgs) => {
  if (getWaitlisted()) return null
  const { orgId, sandboxId, projectId } = params
  if (!sandboxId || !orgId || !projectId) return null

  await init()
  safeFetch(() => fetchSandboxSessions({ orgId, sandboxId, projectId }), `sessions`)
  safeFetch(() => fetchInstances({ orgId, sandboxId, projectId }), `instances`)
  return null
}

export const instanceLoader = async ({ params }: LoaderFunctionArgs) => {
  if (getWaitlisted()) return null
  const { orgId, sandboxId, projectId, instanceId } = params
  if (!sandboxId || !orgId || !projectId || !instanceId) return null

  await init()
  safeFetch(() => fetchSandboxSessions({ orgId, sandboxId, projectId }), `sessions`)
  safeFetch(() => fetchInstances({ orgId, sandboxId, projectId }), `instances`)
  return null
}
