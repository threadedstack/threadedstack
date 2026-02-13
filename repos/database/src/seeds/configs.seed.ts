import { Config } from '@tdsk/domain'
import { Ids, OrgIds, UserIds, ProjectIds, ConfigIds } from '@TDB/seeds/ids.seed'

export const configsSeeds: Config[] = [
  new Config({
    orgId: undefined,
    id: ConfigIds.user,
    projectId: undefined,
    userId: Ids.super.user,
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
        memory: 2048,
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
