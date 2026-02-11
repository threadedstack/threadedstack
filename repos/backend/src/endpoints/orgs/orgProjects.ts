import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
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
import { getProvider } from '@TBE/endpoints/providers/getProvider'
import { listProviders } from '@TBE/endpoints/providers/listProviders'
import { createProvider } from '@TBE/endpoints/providers/createProvider'
import { updateProvider } from '@TBE/endpoints/providers/updateProvider'
import { deleteProvider } from '@TBE/endpoints/providers/deleteProvider'
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

const projectEndpoints: TEndpointConfig = {
  path: `/:projectId/endpoints`,
  method: EPMethod.Use,
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
  endpoints: {
    listSecrets,
    getSecret,
    createSecret,
    updateSecret,
    deleteSecret,
  },
}

const projectProviders: TEndpointConfig = {
  path: `/:projectId/providers`,
  method: EPMethod.Use,
  endpoints: {
    getProvider,
    listProviders,
    createProvider,
    updateProvider,
    deleteProvider,
  },
}

const projectDomains: TEndpointConfig = {
  path: `/:projectId/domains`,
  method: EPMethod.Use,
  endpoints: {
    getDomain,
    listDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  },
}

const projectAgents: TEndpointConfig = {
  path: `/:projectId/agents`,
  method: EPMethod.Use,
  endpoints: {
    getAgent,
    listAgents,
    createAgent,
    updateAgent,
    deleteAgent,
  },
}

export const orgProjects: TEndpointConfig = {
  path: `/:orgId/projects`,
  method: EPMethod.Use,
  endpoints: {
    listProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    projectEndpoints,
    projectFunctions,
    projectSecrets,
    projectProviders,
    projectDomains,
    projectAgents,
  },
}
