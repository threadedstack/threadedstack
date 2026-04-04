import type { Sandbox } from '@tdsk/domain'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

type TSandboxes = Record<string, Sandbox>

export const sandboxesState = atomWithReset<TSandboxes>(undefined)

// Derived: project-level agents
export const projectSandboxesState = atom((get): TSandboxes => {
  const sandboxes = get(sandboxesState)
  const projectId = get(activeProjectIdState)

  if (!sandboxes || !projectId) return {}

  return Object.fromEntries(
    Object.entries(sandboxes).filter(([, sb]) => sb.projectId === projectId)
  )
})
