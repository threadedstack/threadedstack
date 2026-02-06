import type { TDBThreadInsert } from '@TDB/types'

import { Thread } from '@tdsk/domain'
import { UserIds } from '@TDB/seeds/users.seed'
import { ConfigIds } from '@TDB/seeds/configs.seed'
import { ProjectIds } from '@TDB/seeds/projects.seed'
import { ProviderIds } from '@TDB/seeds/providers.seed'

/**
 * Threads Seed Data
 * Chat conversation threads
 */

export const ThreadIds = {
  memberDev: `c0000000-0000-0000-0000-000000000003`,
  adminPlanning: `c0000000-0000-0000-0000-000000000001`,
  adminSupport: `c0000000-0000-0000-0000-000000000002`,
  viewer: `c0000000-0000-0000-0000-000000000004`,
} as const

export const threadsSeeds: TDBThreadInsert[] = [
  new Thread({
    public: false,
    userId: UserIds.owner,
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
