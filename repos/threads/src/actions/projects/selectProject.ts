import { setActiveProjectId } from '@TTH/state/accessors'

export const selectProject = (projectId: string) => {
  setActiveProjectId(projectId)
}
