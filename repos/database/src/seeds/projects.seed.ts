import type { TDBProjectInsert } from '@TDB/types'

import { Project } from '@tdsk/domain'
import { OrgIds, ProjectIds } from '@TDB/seeds/ids.seed'

export const projectsSeeds: TDBProjectInsert[] = [
  new Project({
    orgId: OrgIds.acme,
    id: ProjectIds.acmeApi,
    name: `Acme API Backend`,
    gitUrl: `https://github.com/acme-corp/api-backend`,
    branch: `main`,
    meta: {
      version: `2.5.0`,
      framework: `express`,
      language: `typescript`,
      description: `Core REST API backend service`,
    },
  }),
  new Project({
    orgId: OrgIds.acme,
    name: `Acme Mobile App`,
    id: ProjectIds.acmeMobile,
    gitUrl: `https://github.com/acme-corp/mobile-app`,
    branch: `develop`,
    meta: {
      version: `1.8.2`,
      language: `typescript`,
      framework: `react-native`,
      description: `iOS and Android mobile application`,
    },
  }),
  new Project({
    orgId: OrgIds.acme,
    id: ProjectIds.acmeWeb,
    name: `Acme Web Dashboard`,
    gitUrl: `https://github.com/acme-corp/web-dashboard`,
    branch: `main`,
    meta: {
      version: `3.2.1`,
      framework: `react`,
      language: `typescript`,
      description: `Admin web dashboard`,
    },
  }),
  new Project({
    name: `Platform Core`,
    orgId: OrgIds.startup,
    id: ProjectIds.startupPlatform,
    gitUrl: `https://github.com/tech-startup/platform-core`,
    branch: `main`,
    meta: {
      version: `1.0.0`,
      framework: `nestjs`,
      language: `typescript`,
      description: `Main platform infrastructure`,
    },
  }),
  new Project({
    name: `AI Service`,
    orgId: OrgIds.startup,
    id: ProjectIds.startupAi,
    gitUrl: `https://github.com/tech-startup/ai-service`,
    branch: `main`,
    meta: {
      version: `0.5.3`,
      language: `python`,
      framework: `fastapi`,
      description: `Machine learning inference service`,
    },
  }),
  new Project({
    orgId: OrgIds.personal,
    id: ProjectIds.personal,
    name: `Personal Experiments`,
    gitUrl: `https://github.com/viewer/experiments`,
    branch: `main`,
    meta: {
      version: `0.1.0`,
      framework: `vanilla`,
      language: `javascript`,
      description: `Testing and experimentation repo`,
    },
  }),
]
