import { Ids } from '@TDB/seeds/ids.seed'
import { Provider, EProvider } from '@tdsk/domain'

export const providersSeeds: Provider[] = [
  new Provider({
    type: EProvider.ai,
    orgId: Ids.org.acme,
    name: `OpenAI - Acme Org`,
    id: Ids.provider.acmeOpenai,
    options: {
      maxTokens: 4096,
      temperature: 0.7,
      model: `gpt-4-turbo`,
    },
  }),
  new Provider({
    type: EProvider.ai,
    orgId: Ids.org.acme,
    name: `Anthropic - Acme Org`,
    id: Ids.provider.acmeAnthropic,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
  new Provider({
    type: EProvider.ai,
    orgId: Ids.org.startup,
    name: `Anthropic - Startup Org`,
    id: Ids.provider.startupAnthropic,
    options: {
      maxTokens: 4096,
      model: `claude-3-opus-20240229`,
    },
  }),
  new Provider({
    type: EProvider.ai,
    orgId: Ids.org.personal,
    name: `Personal OpenAI`,
    id: Ids.provider.personalOpenai,
    options: {
      maxTokens: 1024,
      temperature: 0.7,
      model: `gpt-3.5-turbo`,
    },
  }),
]
