import type {
  Endpoint,
  THttpMethod,
  TProxyEndpointConfig,
  TFaaSEndpointConfig,
  TAgentEndpointConfig,
} from '@tdsk/domain'
import type {
  TProxyFormState,
  TFaasFormState,
  TAgentFormState,
} from '@TAF/types/endpoints.types'

import { toNum } from '@keg-hub/jsutils/toNum'
import { kvToObj, objToKV } from '@TAF/utils/transforms/kvs'
import { cleanSplit, EEPAuthType, EEPCredential, EEndpointType } from '@tdsk/domain'

// ============================================================================
// PROXY MAPPER
// ============================================================================

export const initProxyFromEndpoint = (endpoint: Endpoint): TProxyFormState => {
  const opts = (endpoint.options || {}) as TProxyEndpointConfig

  return {
    // Basic fields
    url: opts.url || ``,
    proxyMethod: opts.proxyMethod || (opts as any).method || ``,
    headers: objToKV(opts.headers || {}, `header`),

    // Basic options
    timeout: opts.timeout?.toString() || ``,
    retries: opts.retries?.toString() || ``,
    pathRegex: opts.pathRegex || ``,

    // Retry configuration
    retryDelay: opts.retryDelay?.toString() || ``,
    retryMaxDelay: opts.retryMaxDelay?.toString() || ``,
    retryBackoffMultiplier: opts.retryBackoffMultiplier?.toString() || ``,
    retryExponentialBackoff: opts.retryExponentialBackoff !== false,

    // Auth
    authEnabled: !!opts.auth,
    authType: opts.auth?.type || EEPAuthType.bearer,
    authSecretName: opts.auth?.secretName || ``,
    authHeaderName: opts.auth?.headerName || ``,

    // OAuth
    oauthEnabled: !!opts.oauth,
    oauthTokenUrl: opts.oauth?.tokenUrl || ``,
    oauthClientId: opts.oauth?.clientId || ``,
    oauthClientSecret: opts.oauth?.clientSecret || ``,
    oauthScopes: opts.oauth?.scopes?.join(`, `) || ``,
    oauthCredentialType: opts.oauth?.credentialType || EEPCredential.header,
    oauthParams: objToKV(opts.oauth?.additionalParams || {}, `oauth-param`),

    // Transform
    transformEnabled: !!opts.transform,
    transformInjectSecrets: opts.transform?.injectSecrets || false,

    // Whitelist
    whitelistEnabled: !!opts.domainWhitelist,
    whitelistDomains: opts.domainWhitelist?.allowedDomains?.join(`, `) || ``,
    whitelistEnforce: opts.domainWhitelist?.enforceWhitelist !== false,
    whitelistLogBlocked: opts.domainWhitelist?.logBlocked !== false,
  }
}

export const mapProxyStateToConfig = (state: TProxyFormState): TProxyEndpointConfig => {
  const config: TProxyEndpointConfig = {
    type: EEndpointType.proxy,
    url: state.url,
  }

  // Headers
  const headers = kvToObj(state.headers, false)
  if (Object.keys(headers).length > 0) {
    config.headers = headers
  }

  // Basic options
  if (state.proxyMethod) config.proxyMethod = state.proxyMethod as THttpMethod
  config.timeout = toNum(state.timeout)
  config.retries = toNum(state.retries)
  if (state.pathRegex) config.pathRegex = state.pathRegex

  // Retry configuration
  config.retryDelay = toNum(state.retryDelay)
  config.retryMaxDelay = toNum(state.retryMaxDelay)
  if (state.retryBackoffMultiplier) {
    config.retryBackoffMultiplier = Number.parseFloat(state.retryBackoffMultiplier)
  }
  if (state.retries) config.retryExponentialBackoff = state.retryExponentialBackoff

  // Auth
  if (state.authEnabled) {
    config.auth = {
      type: state.authType,
      secretName: state.authSecretName || undefined,
      headerName: state.authHeaderName || undefined,
    }
  }

  // OAuth
  if (state.oauthEnabled) {
    const additionalParams = kvToObj(state.oauthParams, false)

    config.oauth = {
      tokenUrl: state.oauthTokenUrl,
      clientId: state.oauthClientId,
      clientSecret: state.oauthClientSecret,
      scopes: cleanSplit(state.oauthScopes),
      credentialType: state.oauthCredentialType,
      additionalParams:
        Object.keys(additionalParams).length > 0 ? additionalParams : undefined,
    }
  }

  // Transform
  if (state.transformEnabled) {
    config.transform = {
      injectSecrets: state.transformInjectSecrets,
    }
  }

  // Whitelist
  if (state.whitelistEnabled) {
    config.domainWhitelist = {
      allowedDomains: cleanSplit(state.whitelistDomains),
      enforceWhitelist: state.whitelistEnforce,
      logBlocked: state.whitelistLogBlocked,
    }
  }

  return config
}

// ============================================================================
// FAAS MAPPER
// ============================================================================

export const initFaasFromEndpoint = (endpoint: Endpoint): TFaasFormState => {
  const opts = (endpoint.options || {}) as TFaaSEndpointConfig

  return {
    secrets: opts.secrets || [],
    functionId: opts.functionId || ``,
    memory: opts.memory?.toString() || ``,
    timeout: opts.timeout?.toString() || ``,
    envVars: objToKV(opts.envVars || {}, `faas-env`),
    arguments: objToKV(opts.arguments || {}, `faas-arg`),
  }
}

export const mapFaasStateToConfig = (state: TFaasFormState): TFaaSEndpointConfig => {
  const config: TFaaSEndpointConfig = {
    type: EEndpointType.faas,
    functionId: state.functionId,
  }

  const envVars = kvToObj(state.envVars, false)
  const args = kvToObj(state.arguments)

  if (state.secrets.length > 0) config.secrets = state.secrets
  if (Object.keys(envVars).length > 0) config.envVars = envVars
  if (state.memory) config.memory = toNum(state.memory)
  if (Object.keys(args).length > 0) config.arguments = args
  if (state.timeout) config.timeout = toNum(state.timeout)

  return config
}

// ============================================================================
// AGENT MAPPER
// ============================================================================

export const initAgentFromEndpoint = (endpoint: Endpoint): TAgentFormState => {
  const opts = (endpoint.options || {}) as TAgentEndpointConfig

  return {
    agentId: opts.agentId || ``,
    model: opts.overrides?.model || ``,
    tools: opts.overrides?.tools || [],
    secrets: opts.overrides?.secrets || [],
    maxTokens: opts.overrides?.maxTokens?.toString() || ``,
    systemPrompt: opts.overrides?.systemPrompt || ``,
    envVars: objToKV(opts.overrides?.envVars || {}, `agent-env`),
  }
}

export const mapAgentStateToConfig = (state: TAgentFormState): TAgentEndpointConfig => {
  const config: TAgentEndpointConfig = {
    type: EEndpointType.agent,
    agentId: state.agentId,
  }

  const envVars = kvToObj(state.envVars, false)

  const overrides: NonNullable<TAgentEndpointConfig[`overrides`]> = {}

  if (state.systemPrompt) overrides.systemPrompt = state.systemPrompt
  if (state.model) overrides.model = state.model
  if (state.maxTokens) overrides.maxTokens = toNum(state.maxTokens)
  if (state.tools.length > 0) overrides.tools = state.tools
  if (Object.keys(envVars).length > 0) overrides.envVars = envVars
  if (state.secrets.length > 0) overrides.secrets = state.secrets

  if (Object.keys(overrides).length > 0) {
    config.overrides = overrides
  }

  return config
}
