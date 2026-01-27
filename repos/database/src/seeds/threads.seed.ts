import type { TDBThreadInsert } from '@TDB/types'

import { UserIds } from '@TDB/seeds/users.seed'
import { ConfigIds } from '@TDB/seeds/configs.seed'
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
  {
    id: ThreadIds.adminPlanning,
    userId: UserIds.owner,
    name: `Q1 Planning Discussion`,
    public: false,
    providerId: ProviderIds.acmeOpenai,
    configId: ConfigIds.acmeOrg,
    meta: {
      tags: [`planning`, `q1-2024`],
      priority: `high`,
    },
  },
  {
    id: ThreadIds.adminSupport,
    userId: UserIds.admin,
    name: `Customer Support Issues`,
    public: false,
    providerId: ProviderIds.acmeAnthropic,
    configId: null,
    meta: {
      tags: [`support`, `urgent`],
      category: `customer-service`,
    },
  },
  {
    id: ThreadIds.memberDev,
    userId: UserIds.member,
    name: `API Development Chat`,
    public: false,
    providerId: ProviderIds.startupOpenai,
    configId: null,
    meta: {
      tags: [`development`, `api`],
      project: `platform-core`,
    },
  },
  {
    id: ThreadIds.viewer,
    userId: UserIds.viewer,
    name: `Learning TypeScript`,
    public: true,
    providerId: ProviderIds.personalOpenai,
    configId: ConfigIds.personal,
    meta: {
      tags: [`learning`, `typescript`],
      visibility: `public`,
    },
  },
]
