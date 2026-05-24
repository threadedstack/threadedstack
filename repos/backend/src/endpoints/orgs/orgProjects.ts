import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { projectAccessGuard } from '@TBE/middleware/projectAccessGuard'
import { projectMemberGuard } from '@TBE/middleware/projectMemberGuard'

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

import { listPorts } from '@TBE/endpoints/sandboxes/listPorts'
import { exposePort } from '@TBE/endpoints/sandboxes/exposePort'
import { removePort } from '@TBE/endpoints/sandboxes/removePort'

import { addProjectMember } from '@TBE/endpoints/projects/addProjectMember'
import { listProjectMembers } from '@TBE/endpoints/projects/listProjectMembers'
import { removeProjectMember } from '@TBE/endpoints/projects/removeProjectMember'
import { updateProjectMemberRole } from '@TBE/endpoints/projects/updateProjectMemberRole'

import { getAPConfig } from '@TBE/endpoints/agents/getAPConfig'
import { deleteAPConfig } from '@TBE/endpoints/agents/deleteAPConfig'
import { upsertAPConfig } from '@TBE/endpoints/agents/upsertAPConfig'

import { getSandbox } from '@TBE/endpoints/sandboxes/getSandbox'
import { stopSandbox } from '@TBE/endpoints/sandboxes/stopSandbox'
import { copySandbox } from '@TBE/endpoints/sandboxes/copySandbox'
import { listSessions } from '@TBE/endpoints/sandboxes/listSessions'
import { startSandbox } from '@TBE/endpoints/sandboxes/startSandbox'
import { getSBPConfig } from '@TBE/endpoints/sandboxes/getSBPConfig'
import { listInstances } from '@TBE/endpoints/sandboxes/listInstances'
import { listSandboxes } from '@TBE/endpoints/sandboxes/listSandboxes'
import { execInSandbox } from '@TBE/endpoints/sandboxes/execInSandbox'
import { fileOperation } from '@TBE/endpoints/sandboxes/fileOperation'
import { createSandbox } from '@TBE/endpoints/sandboxes/createSandbox'
import { updateSandbox } from '@TBE/endpoints/sandboxes/updateSandbox'
import { deleteSandbox } from '@TBE/endpoints/sandboxes/deleteSandbox'
import { connectSandbox } from '@TBE/endpoints/sandboxes/connectSandbox'
import { deleteSBPConfig } from '@TBE/endpoints/sandboxes/deleteSBPConfig'
import { upsertSBPConfig } from '@TBE/endpoints/sandboxes/upsertSBPConfig'
import { getSandboxStatus } from '@TBE/endpoints/sandboxes/getSandboxStatus'
import { execStreamInSandbox } from '@TBE/endpoints/sandboxes/execStreamInSandbox'

const projectEndpoints: TEndpointConfig = {
  path: `/:projectId/endpoints`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard()],
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
  middleware: [projectAccessGuard(), projectMemberGuard()],
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
  middleware: [projectAccessGuard(), projectMemberGuard()],
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
  middleware: [projectAccessGuard(), projectMemberGuard()],
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
    getAPConfig,
    upsertAPConfig,
    deleteAPConfig,
  },
}

const projectAgents: TEndpointConfig = {
  path: `/:projectId/agents`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard()],
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
  middleware: [projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    addProjectMember,
    listProjectMembers,
    removeProjectMember,
    updateProjectMemberRole,
  },
}

const projectSandboxConfig: TEndpointConfig = {
  path: `/:sandboxId/config`,
  method: EPMethod.Use,
  endpoints: {
    getSBPConfig,
    upsertSBPConfig,
    deleteSBPConfig,
  },
}

const projectSandboxes: TEndpointConfig = {
  path: `/:projectId/sandboxes`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    listSandboxes,
    getSandbox,
    createSandbox,
    updateSandbox,
    deleteSandbox,
    copySandbox,
    stopSandbox,
    startSandbox,
    execInSandbox,
    fileOperation,
    connectSandbox,
    listSessions,
    listInstances,
    getSandboxStatus,
    execStreamInSandbox,
    projectSandboxConfig,
    listPorts,
    exposePort,
    removePort,
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
    projectSandboxes,
  },
}
