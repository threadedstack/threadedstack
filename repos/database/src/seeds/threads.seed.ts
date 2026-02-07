import { Thread } from '@tdsk/domain'
import {
  Ids,
  UserIds,
  ConfigIds,
  ThreadIds,
  ProjectIds,
  ProviderIds,
} from '@TDB/seeds/ids.seed'

export const threadsSeeds: Thread[] = [
  new Thread({
    public: false,
    userId: Ids.super.user,
    id: ThreadIds.adminPlanning,
    configId: ConfigIds.acmeOrg,
    name: `Q1 Planning Discussion`,
    projectId: ProjectIds.acmeWeb,
    providerId: ProviderIds.acmeOpenai,
    meta: {
      priority: `high`,
      tags: [`planning`, `q1-2024`],
    },
  }),
  new Thread({
    public: false,
    configId: undefined,
    userId: UserIds.admin,
    id: ThreadIds.adminSupport,
    projectId: ProjectIds.acmeApi,
    name: `Customer Support Issues`,
    providerId: ProviderIds.acmeAnthropic,
    meta: {
      tags: [`support`, `urgent`],
      category: `customer-service`,
    },
  }),
  new Thread({
    public: false,
    configId: undefined,
    userId: UserIds.member,
    id: ThreadIds.memberDev,
    name: `API Development Chat`,
    projectId: ProjectIds.startupPlatform,
    providerId: ProviderIds.startupAnthropic,
    meta: {
      project: `platform-core`,
      tags: [`development`, `api`],
    },
  }),
  new Thread({
    public: true,
    id: ThreadIds.viewer,
    userId: UserIds.viewer,
    name: `Learning TypeScript`,
    configId: ConfigIds.personal,
    projectId: ProjectIds.personal,
    providerId: ProviderIds.personalOpenai,
    meta: {
      visibility: `public`,
      tags: [`learning`, `typescript`],
    },
  }),
]
