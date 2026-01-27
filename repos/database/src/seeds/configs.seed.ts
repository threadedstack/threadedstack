import type { TDBConfigInsert } from '@TDB/types'
import { OrgIds } from '@TDB/seeds/orgs.seed'
import { UserIds } from '@TDB/seeds/users.seed'
import { ProjectIds } from '@TDB/seeds/projects.seed'

/**
 * Configs Seed Data
 * Exclusive Arc: userId OR orgId OR projectId (exactly one)
 */

export const ConfigIds = {
  user: `90000000-0000-0000-0000-000000000001`,
  acmeOrg: `90000000-0000-0000-0000-000000000002`,
  acmeApi: `90000000-0000-0000-0000-000000000003`,
  startup: `90000000-0000-0000-0000-000000000004`,
  personal: `90000000-0000-0000-0000-000000000005`,
} as const

export const configsSeeds: TDBConfigInsert[] = [
  {
    id: ConfigIds.user,
    userId: UserIds.owner,
    orgId: null,
    projectId: null,
    data: {
      theme: `dark`,
      language: `en`,
      notifications: {
        email: true,
        push: false,
      },
      preferences: {
        defaultOrg: OrgIds.acme,
      },
    },
  },
  {
    id: ConfigIds.acmeOrg,
    userId: null,
    orgId: OrgIds.acme,
    projectId: null,
    data: {
      billing: {
        plan: `enterprise`,
        paymentMethod: `invoice`,
      },
      security: {
        enforceSSO: true,
        allowedDomains: [`acme-corp.com`],
      },
      features: {
        aiAssistant: true,
        advancedAnalytics: true,
      },
    },
  },
  {
    id: ConfigIds.acmeApi,
    userId: null,
    orgId: null,
    projectId: ProjectIds.acmeApi,
    data: {
      deployment: {
        environment: `production`,
        region: `us-east-1`,
      },
      runtime: {
        nodeVersion: `20.x`,
        memoryLimit: 2048,
        timeout: 30,
      },
    },
  },
  {
    id: ConfigIds.startup,
    userId: null,
    orgId: OrgIds.startup,
    projectId: null,
    data: {
      branding: {
        primaryColor: `#007AFF`,
        logo: `https://example.com/logo.png`,
      },
      integrations: {
        slack: true,
        github: true,
      },
    },
  },
  {
    id: ConfigIds.personal,
    userId: UserIds.viewer,
    orgId: null,
    projectId: null,
    data: {
      theme: `light`,
      language: `en`,
      experimental: {
        betaFeatures: true,
      },
    },
  },
]
