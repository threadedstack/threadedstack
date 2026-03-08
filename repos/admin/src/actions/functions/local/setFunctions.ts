import type { Function as FunctionModel } from '@tdsk/domain'
import { setProjectFunctions } from '@TAF/state/accessors'

export const setFunctions = (projectId: string, functions: FunctionModel[]) => {
  const map = functions.reduce(
    (acc, f) => {
      acc[f.id] = f
      return acc
    },
    {} as Record<string, FunctionModel>
  )

  setProjectFunctions(projectId, map)
}
