import type { TDBConfigInsert } from '@TDB/types'
import { Config } from '@tdsk/domain'
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
  new Config({
    orgId: undefined,
    id: ConfigIds.user,
    projectId: undefined,
    userId: UserIds.owner,
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
  }),
  new Config({
    userId: undefined,
    orgId: OrgIds.acme,
    projectId: undefined,
    id: ConfigIds.acmeOrg,
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
  }),
  new Config({
    orgId: undefined,
    userId: undefined,
    id: ConfigIds.acmeApi,
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
  }),
  new Config({
    userId: undefined,
    projectId: undefined,
    id: ConfigIds.startup,
    orgId: OrgIds.startup,
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
  }),
  new Config({
    orgId: undefined,
    projectId: undefined,
    id: ConfigIds.personal,
    userId: UserIds.viewer,
    data: {
      theme: `light`,
      language: `en`,
      experimental: {
        betaFeatures: true,
      },
    },
  }),
]
