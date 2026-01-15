import type { Project } from '@tdsk/domain'

import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export const projectsState = atomWithReset<Record<string, Project>>(undefined)
export const activeProjectIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `projects` && part))
)

export const activeProjectState = atom((get) => {
  const projectId = get(activeProjectIdState)
  const projects = get(projectsState)
  return projectId && projects?.[projectId] ? projects[projectId] : undefined
})
