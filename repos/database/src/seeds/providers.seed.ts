import { Provider, EProvider } from '@tdsk/domain'
import { OrgIds, ProviderIds } from '@TDB/seeds/ids.seed'

export const providersSeeds: Provider[] = [
  new Provider({
    type: EProvider.ai,
    orgId: OrgIds.acme,
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
    orgId: OrgIds.acme,
    name: `Anthropic - Acme Org`,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
  new Provider({
    id: ProviderIds.startupAnthropic,
    type: EProvider.ai,
    orgId: OrgIds.startup,
    name: `Anthropic - Startup Org`,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
  new Provider({
    id: ProviderIds.personalOpenai,
    type: EProvider.ai,
    orgId: OrgIds.startup,
    name: `Personal OpenAI`,
    options: {
      maxTokens: 1024,
      temperature: 0.7,
      model: `gpt-3.5-turbo`,
    },
  }),
]
