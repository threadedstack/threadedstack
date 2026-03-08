import { getProjectFunctions, setProjectFunctions } from '@TAF/state/accessors'

export const removeFunction = (projectId: string, id: string) => {
  const current = getProjectFunctions(projectId) || {}
  const { [id]: _, ...rest } = current
  setProjectFunctions(projectId, rest)
}
