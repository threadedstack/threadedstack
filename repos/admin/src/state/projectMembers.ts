import type { Role } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId → Record<role.id, Role>
export const projectMembersState =
  atomWithReset<Record<string, Record<string, Role>>>(undefined)

// Derived: auto-filters to active project
export const activeProjectMembersState = atom((get) => {
  const projectId = get(activeProjectIdState)
  const all = get(projectMembersState)
  return projectId && all?.[projectId] ? all[projectId] : undefined
})
