import type { Function as FunctionModel } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by projectId
export const functionsState =
  atomWithReset<Record<string, Record<string, FunctionModel>>>(undefined)
export const activeFunctionIdState = atomWithReset<string>(
  getParamValue((part, before) => Boolean(before === `functions` && part))
)

// Derived: auto-filters to active project
export const projectFunctionsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(functionsState)?.[projectId] : undefined
})
