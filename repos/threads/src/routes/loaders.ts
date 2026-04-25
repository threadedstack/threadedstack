import type { LoaderFunctionArgs } from 'react-router'

import { toast } from 'sonner'
import { init } from '@TTH/actions/init'
import { getOrgId, getSandboxes } from '@TTH/state/accessors'
import { fetchSandboxSessions } from '@TTH/actions/sandboxes/fetchSandboxSessions'

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

export const sandboxLoader = async ({ params }: LoaderFunctionArgs) => {
  // Ensure init() has completed — on deep-link React Router runs loaders in parallel
  await rootLoader()

  const { sandboxId } = params
  const orgId = getOrgId()
  if (!sandboxId || !orgId) return null

  const sandboxes = getSandboxes()
  const sandbox = sandboxes.find((s) => s.id === sandboxId)
  const projectId = sandbox?.projects?.[0]?.id
  if (!projectId) return null

  await safeFetch(() => fetchSandboxSessions({ orgId, sandboxId, projectId }))
  return null
}
