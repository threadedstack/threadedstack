import { storage } from '@TTH/services/storage'
import { setActiveProjectId } from '@TTH/state/accessors'
import { ActiveProjectIdStorageKey } from '@TTH/constants/storage'

export const selectProject = (projectId: string) => {
  setActiveProjectId(projectId)
  storage.set(ActiveProjectIdStorageKey, projectId)
}
