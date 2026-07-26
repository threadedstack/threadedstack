import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { enforceQuota } from '@TBE/middleware/enforceQuota'
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
import { invokeFunction } from '@TBE/endpoints/functions/invokeFunction'

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

import { getAgentStatus } from '@TBE/endpoints/agents/activity/getAgentStatus'
import { listAgentTurns } from '@TBE/endpoints/agents/activity/listAgentTurns'
import { listAgentMemories } from '@TBE/endpoints/agents/activity/listAgentMemories'
import { listAgentMessages } from '@TBE/endpoints/agents/activity/listAgentMessages'

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

import { permissionOverrides } from '@TBE/endpoints/permissionOverrides/permissionOverrides'

import { projectCollections } from '@TBE/endpoints/collections/collections'

import { getSchedule } from '@TBE/endpoints/schedules/getSchedule'
import { listSchedules } from '@TBE/endpoints/schedules/listSchedules'
import { getScheduleRun } from '@TBE/endpoints/schedules/getScheduleRun'
import { createSchedule } from '@TBE/endpoints/schedules/createSchedule'
import { updateSchedule } from '@TBE/endpoints/schedules/updateSchedule'
import { deleteSchedule } from '@TBE/endpoints/schedules/deleteSchedule'
import { triggerSchedule } from '@TBE/endpoints/schedules/triggerSchedule'
import { listScheduleRuns } from '@TBE/endpoints/schedules/listScheduleRuns'
import { getScheduleRunOutput } from '@TBE/endpoints/schedules/getScheduleRunOutput'

const projectEndpoints: TEndpointConfig = {
  path: `/:projectId/endpoints`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard(), enforceQuota(`endpoints`)],
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
    invokeFunction,
  },
}

const projectSecrets: TEndpointConfig = {
  path: `/:projectId/secrets`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard(), enforceQuota(`secrets`)],
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
  middleware: [projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    getAPConfig,
    upsertAPConfig,
    deleteAPConfig,
  },
}

/**
 * Read-only agent telemetry: /:agentId/activity
 *
 * Nested inside the agents group rather than mounted as a sibling on
 * `/:projectId/agents/:agentId/activity`. Express `use` matches on prefix, so a
 * sibling would still run the agents group's guards on the way past and then
 * run its own again — the same middleware twice per request, and the
 * `agents` feature gate applying anyway. Nesting is also the shape
 * `projectAgentConfig` already uses for its `/:agentId/config` routes.
 *
 * Carries no middleware of its own: the parent group's feature gate and
 * project access/member guards cover these routes, and each endpoint applies
 * its own authorize() on EPermResource.agent.
 */
const projectAgentActivity: TEndpointConfig = {
  path: `/:agentId/activity`,
  method: EPMethod.Use,
  endpoints: {
    getAgentStatus,
    listAgentTurns,
    listAgentMessages,
    listAgentMemories,
  },
}

const projectAgents: TEndpointConfig = {
  path: `/:projectId/agents`,
  method: EPMethod.Use,
  middleware: [featureGate(`agents`), projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    getAgent,
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    projectAgentConfig,
    projectAgentActivity,
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
  middleware: [projectAccessGuard(), projectMemberGuard()],
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

const projectOverrides: TEndpointConfig = {
  path: `/:projectId/overrides`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard()],
  endpoints: {
    ...permissionOverrides.endpoints,
  },
}

const projectSchedules: TEndpointConfig = {
  path: `/:projectId/schedules`,
  method: EPMethod.Use,
  middleware: [projectAccessGuard(), projectMemberGuard(), featureGate(`schedules`)],
  endpoints: {
    listSchedules,
    getSchedule,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
    listScheduleRuns,
    getScheduleRun,
    getScheduleRunOutput,
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
    projectSchedules,
    projectOverrides,
    projectCollections,
  },
}
