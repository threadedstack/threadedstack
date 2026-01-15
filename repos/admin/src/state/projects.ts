import type { Project } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export const projectsState = atomWithReset<Record<string, Project>>(undefined)
export const activeProjectIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `projects` && part))
)
