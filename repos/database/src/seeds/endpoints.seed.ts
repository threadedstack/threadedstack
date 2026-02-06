import type { TDBEndpointInsert } from '@TDB/types'

import { FaaSEndpoint, AgentEndpoint, EEndpointType, ProxyEndpoint } from '@tdsk/domain'

import { AgentIds, ProjectIds, EndpointIds, FunctionIds } from '@TDB/seeds/ids.seed'

export const endpointsSeeds: TDBEndpointInsert[] = [
  new ProxyEndpoint({
    type: EEndpointType.proxy,
    id: EndpointIds.acmeApiGoogle,
    projectId: ProjectIds.acmeApi,
    path: `/google`,
    name: `Google Proxy`,
    method: `GET`,
    public: false,
    headers: {
      [`Content-Type`]: `application/json`,
      [`X-API-Version`]: `v1`,
    },
    options: {
      retries: 3,
      timeout: 30000,
      type: EEndpointType.proxy,
      url: `https://google.com`,
    },
  }),
  new ProxyEndpoint({
    type: EEndpointType.proxy,
    id: EndpointIds.acmeApiUsers,
    projectId: ProjectIds.acmeApi,
    name: `Acme Users`,
    path: `/api/v1/users`,
    method: `GET`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      retries: 1,
      timeout: 10000,
      type: EEndpointType.proxy,
      url: `https://fake-json-api.mock.beeceptor.com/users`,
    },
  }),
  new ProxyEndpoint({
    type: EEndpointType.proxy,
    id: EndpointIds.acmeApiUsers,
    projectId: ProjectIds.acmeApi,
    name: `Acme Posts`,
    path: `/api/v1/posts`,
    method: `POST`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      retries: 1,
      timeout: 10000,
      method: `POST`,
      type: EEndpointType.proxy,
      url: `https://jsonplaceholder.typicode.com/posts/1`,
    },
  }),
  new ProxyEndpoint({
    type: EEndpointType.proxy,
    id: EndpointIds.personalTest,
    projectId: ProjectIds.personal,
    name: `Test Endpoint`,
    path: `/test`,
    method: `GET`,
    public: true,
    headers: {},
    options: {
      method: `PUT`,
      type: EEndpointType.proxy,
      url: `https://dummy.restapiexample.com/public/api/v1/update/21`,
    },
  }),

  new FaaSEndpoint({
    name: `Webhook Receiver`,
    path: `/api/v1/webhooks`,
    type: EEndpointType.faas,
    projectId: ProjectIds.acmeApi,
    id: EndpointIds.acmeApiWebhooks,
    method: `POST`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      retries: 0,
      timeout: 5000,
      type: EEndpointType.faas,
      functionId: FunctionIds.acmeAuth,
    },
  }),
  new FaaSEndpoint({
    name: `User Validator`,
    path: `/api/v1/users/validate`,
    type: EEndpointType.faas,
    projectId: ProjectIds.acmeApi,
    id: EndpointIds.acmeApiValidator,
    method: `POST`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      retries: 0,
      timeout: 5000,
      type: EEndpointType.faas,
      functionId: FunctionIds.acmeUserValidator,
    },
  }),

  new AgentEndpoint({
    type: EEndpointType.agent,
    projectId: ProjectIds.startupAi,
    id: EndpointIds.startupInference,
    name: `AI Inference`,
    path: `/api/predict`,
    method: `POST`,
    public: false,
    headers: {
      [`Content-Type`]: `application/json`,
      [`X-Model-Version`]: `1.0`,
    },
    options: {
      retries: 2,
      timeout: 60000,
      type: EEndpointType.agent,
      agentId: AgentIds.codingAgent,
    },
  }),
]
