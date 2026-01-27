import type { TDBEndpointInsert } from '@TDB/types'
import { ProjectIds } from '@TDB/seeds/projects.seed'

/**
 * Endpoints Seed Data
 */

export const EndpointIds = {
  acmeApiUsers: `a0000000-0000-0000-0000-000000000001`,
  acmeApiAuth: `a0000000-0000-0000-0000-000000000002`,
  personalTest: `a0000000-0000-0000-0000-000000000005`,
  acmeApiWebhooks: `a0000000-0000-0000-0000-000000000003`,
  startupInference: `a0000000-0000-0000-0000-000000000004`,
} as const

export const endpointsSeeds: TDBEndpointInsert[] = [
  {
    id: EndpointIds.acmeApiUsers,
    projectId: ProjectIds.acmeApi,
    name: `Users API`,
    path: `/api/v1/users`,
    url: `https://api.acme-corp.com/users`,
    method: `GET`,
    public: false,
    headers: {
      [`Content-Type`]: `application/json`,
      [`X-API-Version`]: `v1`,
    },
    options: {
      timeout: 30000,
      retries: 3,
    },
  },
  {
    id: EndpointIds.acmeApiAuth,
    projectId: ProjectIds.acmeApi,
    name: `Authentication`,
    path: `/api/v1/auth`,
    url: `https://api.acme-corp.com/auth`,
    method: `POST`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      timeout: 10000,
      retries: 1,
    },
  },
  {
    id: EndpointIds.acmeApiWebhooks,
    projectId: ProjectIds.acmeApi,
    name: `Webhook Receiver`,
    path: `/api/v1/webhooks`,
    url: `https://api.acme-corp.com/webhooks`,
    method: `POST`,
    public: true,
    headers: {
      [`Content-Type`]: `application/json`,
    },
    options: {
      timeout: 5000,
      retries: 0,
    },
  },
  {
    id: EndpointIds.startupInference,
    projectId: ProjectIds.startupAi,
    name: `AI Inference`,
    path: `/api/predict`,
    url: `https://ai.tech-startup.io/predict`,
    method: `POST`,
    public: false,
    headers: {
      [`Content-Type`]: `application/json`,
      [`X-Model-Version`]: `1.0`,
    },
    options: {
      timeout: 60000,
      retries: 2,
    },
  },
  {
    id: EndpointIds.personalTest,
    projectId: ProjectIds.personal,
    name: `Test Endpoint`,
    path: `/test`,
    url: `http://localhost:3000/test`,
    method: `GET`,
    public: true,
    headers: null,
    options: null,
  },
]
