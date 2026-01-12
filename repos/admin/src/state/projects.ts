import type { Project } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const projectsState = atomWithReset<Record<string, Project>>(undefined)
export const activeProjectIdState = atomWithReset<string>(undefined)
