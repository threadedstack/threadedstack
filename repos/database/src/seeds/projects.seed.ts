import type { TDBProjectInsert } from '@TDB/types'
import { OrgIds } from '@TDB/seeds/orgs.seed'

/**
 * Projects Seed Data
 */

export const ProjectIds = {
  acmeApi: `50000000-0000-0000-0000-000000000001`,
  acmeMobile: `50000000-0000-0000-0000-000000000002`,
  acmeWeb: `50000000-0000-0000-0000-000000000003`,
  startupPlatform: `50000000-0000-0000-0000-000000000004`,
  startupAi: `50000000-0000-0000-0000-000000000005`,
  personal: `50000000-0000-0000-0000-000000000006`,
} as const

export const projectsSeeds: TDBProjectInsert[] = [
  {
    id: ProjectIds.acmeApi,
    orgId: OrgIds.acme,
    name: `Acme API Backend`,
    gitUrl: `https://github.com/acme-corp/api-backend`,
    branch: `main`,
    meta: {
      description: `Core REST API backend service`,
      language: `typescript`,
      framework: `express`,
      version: `2.5.0`,
    },
  },
  {
    id: ProjectIds.acmeMobile,
    orgId: OrgIds.acme,
    name: `Acme Mobile App`,
    gitUrl: `https://github.com/acme-corp/mobile-app`,
    branch: `develop`,
    meta: {
      description: `iOS and Android mobile application`,
      language: `typescript`,
      framework: `react-native`,
      version: `1.8.2`,
    },
  },
  {
    id: ProjectIds.acmeWeb,
    orgId: OrgIds.acme,
    name: `Acme Web Dashboard`,
    gitUrl: `https://github.com/acme-corp/web-dashboard`,
    branch: `main`,
    meta: {
      description: `Admin web dashboard`,
      language: `typescript`,
      framework: `react`,
      version: `3.2.1`,
    },
  },
  {
    id: ProjectIds.startupPlatform,
    orgId: OrgIds.startup,
    name: `Platform Core`,
    gitUrl: `https://github.com/tech-startup/platform-core`,
    branch: `main`,
    meta: {
      description: `Main platform infrastructure`,
      language: `typescript`,
      framework: `nestjs`,
      version: `1.0.0`,
    },
  },
  {
    id: ProjectIds.startupAi,
    orgId: OrgIds.startup,
    name: `AI Service`,
    gitUrl: `https://github.com/tech-startup/ai-service`,
    branch: `main`,
    meta: {
      description: `Machine learning inference service`,
      language: `python`,
      framework: `fastapi`,
      version: `0.5.3`,
    },
  },
  {
    id: ProjectIds.personal,
    orgId: OrgIds.personal,
    name: `Personal Experiments`,
    gitUrl: `https://github.com/viewer/experiments`,
    branch: `main`,
    meta: {
      description: `Testing and experimentation repo`,
      language: `javascript`,
      framework: `vanilla`,
      version: `0.1.0`,
    },
  },
]
