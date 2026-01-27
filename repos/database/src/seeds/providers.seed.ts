import type { TDBProviderInsert } from '@TDB/types'

import { OrgIds } from '@TDB/seeds/orgs.seed'
import { UserIds } from '@TDB/seeds/users.seed'
import { ProjectIds } from '@TDB/seeds/projects.seed'

/**
 * Providers Seed Data
 * External API provider configurations
 */

export const ProviderIds = {
  acmeOpenai: `70000000-0000-0000-0000-000000000001`,
  acmeAnthropic: `70000000-0000-0000-0000-000000000002`,
  startupOpenai: `70000000-0000-0000-0000-000000000003`,
  personalOpenai: `70000000-0000-0000-0000-000000000004`,
} as const

export const providersSeeds: TDBProviderInsert[] = [
  {
    id: ProviderIds.acmeOpenai,
    name: `OpenAI - Acme Org`,
    type: `openai`,
    orgId: OrgIds.acme,
    userId: null,
    projectId: null,
    options: {
      model: `gpt-4-turbo`,
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  {
    id: ProviderIds.acmeAnthropic,
    name: `Anthropic - Acme Project`,
    type: `anthropic`,
    orgId: null,
    userId: null,
    projectId: ProjectIds.acmeApi,
    options: {
      model: `claude-3-opus-20240229`,
      maxTokens: 4096,
    },
  },
  {
    id: ProviderIds.startupOpenai,
    name: `OpenAI - Startup`,
    type: `openai`,
    orgId: OrgIds.startup,
    userId: null,
    projectId: null,
    options: {
      model: `gpt-3.5-turbo`,
      temperature: 0.5,
      maxTokens: 2048,
    },
  },
  {
    id: ProviderIds.personalOpenai,
    name: `Personal OpenAI`,
    type: `openai`,
    orgId: null,
    userId: UserIds.viewer,
    projectId: null,
    options: {
      model: `gpt-3.5-turbo`,
      temperature: 0.7,
      maxTokens: 1024,
    },
  },
]
