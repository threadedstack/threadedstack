import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getProject } from '@TBE/endpoints/projects/getProject'
import { listProjects } from '@TBE/endpoints/projects/listProjects'
import { createProject } from '@TBE/endpoints/projects/createProject'
import { updateProject } from '@TBE/endpoints/projects/updateProject'
import { deleteProject } from '@TBE/endpoints/projects/deleteProject'

export const projects: TEndpointConfig = {
  path: `/projects`,
  method: EPMethod.Use,
  endpoints: {
    getProject,
    listProjects,
    createProject,
    updateProject,
    deleteProject,
  },
}
