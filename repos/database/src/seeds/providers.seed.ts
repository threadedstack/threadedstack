import type { TDBProviderInsert } from '@TDB/types'

import { Provider, EProvider } from '@tdsk/domain'
import { OrgIds, UserIds, ProviderIds, ProjectIds } from '@TDB/seeds/ids.seed'

export const providersSeeds: TDBProviderInsert[] = [
  new Provider({
    userId: undefined,
    type: EProvider.ai,
    orgId: OrgIds.acme,
    projectId: undefined,
    id: ProviderIds.acmeOpenai,
    name: `OpenAI - Acme Org`,
    options: {
      maxTokens: 4096,
      temperature: 0.7,
      model: `gpt-4-turbo`,
    },
  }),
  new Provider({
    id: ProviderIds.acmeAnthropic,
    type: EProvider.ai,
    orgId: undefined,
    userId: undefined,
    projectId: ProjectIds.acmeApi,
    name: `Anthropic - Acme Project`,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
  new Provider({
    id: ProviderIds.startupAnthropic,
    userId: undefined,
    type: EProvider.ai,
    projectId: undefined,
    orgId: OrgIds.startup,
    name: `Anthropic - Startup Org`,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
  new Provider({
    id: ProviderIds.personalOpenai,
    orgId: undefined,
    type: EProvider.ai,
    projectId: undefined,
    userId: UserIds.viewer,
    name: `Personal OpenAI`,
    options: {
      maxTokens: 1024,
      temperature: 0.7,
      model: `gpt-3.5-turbo`,
    },
  }),
]
