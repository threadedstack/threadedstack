import type { TAgentFormState, TFaasFormState, TProxyFormState } from '@TAF/types'

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
  authType: `bearer`,
  authSecretName: ``,
  authHeaderName: ``,

  oauthScopes: ``,
  oauthParams: [],
  oauthTokenUrl: ``,
  oauthClientId: ``,
  oauthEnabled: false,
  oauthClientSecret: ``,
  oauthCredentialStyle: `header`,

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
