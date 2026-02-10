import type { TAgentFormState, TFaasFormState, TProxyFormState } from '@TAF/types'
import { EEPCredential, EEPAuthType } from '@tdsk/domain'

export const DefProxyState: TProxyFormState = {
  url: ``,
  method: `get`,
  headers: [],
  timeout: ``,
  pathRegex: ``,

  retries: ``,
  retryDelay: ``,
  retryMaxDelay: ``,
  retryBackoffMultiplier: ``,
  retryExponentialBackoff: true,

  authEnabled: false,
  authSecretName: ``,
  authHeaderName: ``,
  authType: EEPAuthType.bearer,

  oauthScopes: ``,
  oauthParams: [],
  oauthTokenUrl: ``,
  oauthClientId: ``,
  oauthEnabled: false,
  oauthClientSecret: ``,
  oauthCredentialType: EEPCredential.header,

  transformEnabled: false,
  transformInjectSecrets: false,

  whitelistDomains: ``,
  whitelistEnforce: true,
  whitelistEnabled: false,
  whitelistLogBlocked: true,
}

export const DefFaasState: TFaasFormState = {
  memory: ``,
  timeout: ``,
  secrets: [],
  envVars: [],
  arguments: [],
  functionId: ``,
}

export const DefAgentState: TAgentFormState = {
  model: ``,
  tools: [],
  secrets: [],
  envVars: [],
  agentId: ``,
  maxTokens: ``,
  systemPrompt: ``,
}
