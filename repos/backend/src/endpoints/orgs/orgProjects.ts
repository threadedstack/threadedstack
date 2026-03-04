import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'

import { getProject } from '@TBE/endpoints/projects/getProject'
import { listProjects } from '@TBE/endpoints/projects/listProjects'
import { createProject } from '@TBE/endpoints/projects/createProject'
import { updateProject } from '@TBE/endpoints/projects/updateProject'
import { deleteProject } from '@TBE/endpoints/projects/deleteProject'

import { getEndpoint } from '@TBE/endpoints/endpoints/getEndpoint'
import { listEndpoints } from '@TBE/endpoints/endpoints/listEndpoints'
import { createEndpoint } from '@TBE/endpoints/endpoints/createEndpoint'
import { updateEndpoint } from '@TBE/endpoints/endpoints/updateEndpoint'
import { deleteEndpoint } from '@TBE/endpoints/endpoints/deleteEndpoint'

import { getFunction } from '@TBE/endpoints/functions/getFunction'
import { listFunctions } from '@TBE/endpoints/functions/listFunctions'
import { createFunction } from '@TBE/endpoints/functions/createFunction'
import { updateFunction } from '@TBE/endpoints/functions/updateFunction'
import { deleteFunction } from '@TBE/endpoints/functions/deleteFunction'

import { getSecret } from '@TBE/endpoints/secrets/getSecret'
import { listSecrets } from '@TBE/endpoints/secrets/listSecrets'
import { createSecret } from '@TBE/endpoints/secrets/createSecret'
import { updateSecret } from '@TBE/endpoints/secrets/updateSecret'
import { deleteSecret } from '@TBE/endpoints/secrets/deleteSecret'

import { getDomain } from '@TBE/endpoints/domains/getDomain'
import { listDomains } from '@TBE/endpoints/domains/listDomains'
import { createDomain } from '@TBE/endpoints/domains/createDomain'
import { updateDomain } from '@TBE/endpoints/domains/updateDomain'
import { deleteDomain } from '@TBE/endpoints/domains/deleteDomain'

import { getAgent } from '@TBE/endpoints/agents/getAgent'
import { listAgents } from '@TBE/endpoints/agents/listAgents'
import { createAgent } from '@TBE/endpoints/agents/createAgent'
import { updateAgent } from '@TBE/endpoints/agents/updateAgent'
import { deleteAgent } from '@TBE/endpoints/agents/deleteAgent'

import { addProjectMember } from '@TBE/endpoints/projects/addProjectMember'
import { listProjectMembers } from '@TBE/endpoints/projects/listProjectMembers'
import { removeProjectMember } from '@TBE/endpoints/projects/removeProjectMember'
import { updateProjectMemberRole } from '@TBE/endpoints/projects/updateProjectMemberRole'
import {
  getAgentProjectConfig,
  upsertAgentProjectConfig,
  deleteAgentProjectConfig,
} from '@TBE/endpoints/agents/agentProjectConfig'

const projectEndpoints: TEndpointConfig = {
  path: `/:projectId/endpoints`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    getEndpoint,
    listEndpoints,
    createEndpoint,
    updateEndpoint,
    deleteEndpoint,
  },
}

const projectFunctions: TEndpointConfig = {
  path: `/:projectId/functions`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    listFunctions,
    getFunction,
    createFunction,
    updateFunction,
    deleteFunction,
  },
}

const projectSecrets: TEndpointConfig = {
  path: `/:projectId/secrets`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    listSecrets,
    getSecret,
    createSecret,
    updateSecret,
    deleteSecret,
  },
}

const projectDomains: TEndpointConfig = {
  path: `/:projectId/domains`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    getDomain,
    listDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  },
}

const projectAgentConfig: TEndpointConfig = {
  path: `/:agentId/config`,
  method: EPMethod.Use,
  endpoints: {
    getAgentProjectConfig,
    upsertAgentProjectConfig,
    deleteAgentProjectConfig,
  },
}

const projectAgents: TEndpointConfig = {
  path: `/:projectId/agents`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    getAgent,
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    projectAgentConfig,
  },
}

const projectMembers: TEndpointConfig = {
  path: `/:projectId/members`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard()],
  endpoints: {
    addProjectMember,
    listProjectMembers,
    removeProjectMember,
    updateProjectMemberRole,
  },
}

export const orgProjects: TEndpointConfig = {
  path: `/:orgId/projects`,
  method: EPMethod.Use,
  endpoints: {
    getProject,
    listProjects,
    createProject,
    updateProject,
    deleteProject,
    projectSecrets,
    projectDomains,
    projectAgents,
    projectMembers,
    projectEndpoints,
    projectFunctions,
  },
}
