import type { Function as FunctionModel } from '@tdsk/domain'
import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export const upsertFunction = (projectId: string, func: FunctionModel) => {
  const current = getProjectFunctions(projectId) || {}
  setProjectFunctions(projectId, { ...current, [func.id]: func })
}
