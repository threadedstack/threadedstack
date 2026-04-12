import type { Sandbox } from '@tdsk/domain'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const sandboxesState =
  atomWithReset<Record<string, Record<string, Sandbox>>>(undefined)

// Derived: org-level sandboxes
export const orgSandboxesState = atom((get) => get(sandboxesState)?.[`org`])

// Derived: project-level sandboxes
export const projectSandboxesState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(sandboxesState)?.[projectId] : undefined
})
