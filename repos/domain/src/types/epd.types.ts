/**
 * Endpoint type enumeration
 */
export enum EEndpointType {
  proxy = `proxy`,
  faas = `faas`,
  agent = `agent`,
}

export type TEndpointType = `${EEndpointType}`

export enum EEPVisibility {
  public = `public`,
  private = `private`,
}

export enum EEPAuthTypes {
  apikey = `apikey`,
  basic = `basic`,
  bearer = `bearer`,
}

export type TEPAuthType = `${EEPAuthTypes}`

export enum EEPCredentialOpts {
  body = `body`,
  header = `header`,
}

export type TEPCredentialOpts = `${EEPCredentialOpts}`

/**
 * Cached token with metadata
 */
export type TCachedToken = {
  accessToken: string
  expiresAt: number
  tokenType: string
}

export enum ETransformType {
  regex = `regex`,
  jsonpath = `jsonpath`,
  template = `template`,
}

export type TTransformType = `${ETransformType}`

export type TTransformRule = {
  path?: string
  value?: string
  pattern?: string
  replacement?: string
  type: TTransformType
}

export type TBodyTransformConfig = {
  rules?: TTransformRule[]
  injectSecrets?: boolean
}

/**
 * Domain whitelist configuration for an endpoint
 */
export type TDomainWhitelistConfig = {
  /** List of allowed domains (supports wildcards like *.example.com) */
  allowedDomains: string[]
  /** Whether to block requests from non-whitelisted domains */
  enforceWhitelist?: boolean
  /** Log blocked attempts for security auditing */
  logBlocked?: boolean
}

// TODO: update TEndpointOpts type to use this
export type TEndpointRetryOpts = {
  /** Number of times to retry the request */
  retries?: number
  /** Initial delay in milliseconds before first retry (default: 1000) */
  delay?: number
  /** Maximum delay in milliseconds for retry backoff (default: 30000) */
  max?: number
  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Whether to use exponential backoff (default: true) */
  exponentialBackoff?: boolean
}

export type TEndpointAuth = {
  secretName?: string
  headerName?: string
  type?: `bearer` | `basic` | `apikey`
}

/**
 * Result of domain validation
 */
export type TDomainValidationResult = {
  domain: string
  reason?: string
  allowed: boolean
  matchedPattern?: string
}

/**
 * OAuth configuration for an endpoint
 */
export type TOAuthConfig = {
  /** OAuth token endpoint URL */
  tokenUrl: string
  /** Client ID - can be a secret reference like {{CLIENT_ID}} */
  clientId: string
  /** Client secret - should be a secret reference like {{CLIENT_SECRET}} */
  clientSecret: string
  /** OAuth scopes to request */
  scopes?: string[]
  /** Additional parameters to send with token request */
  additionalParams?: Record<string, string>
  /** How to send credentials: 'header' (Basic auth) or 'body' (form params) */
  credentialStyle?: `header` | `body`
}

export type TSharedEndpointOpts<
  T extends TEndpointType = TEndpointType,
  P extends Record<string, unknown> = Record<string, unknown>,
> = P & {
  type: T
  /** Proxy-specific configuration (legacy support) */
  timeout?: number
  pathRegex?: string
  oauth?: TOAuthConfig
  auth?: TEndpointAuth
  headers?: Record<string, string>

  // TODO: update to use retry object instead of flat properties
  //retry: TEndpointRetryOpts

  /** Number of times to retry the request */
  retries?: number
  /** Initial delay in milliseconds before first retry (default: 1000) */
  retryDelay?: number
  /** Maximum delay in milliseconds for retry backoff (default: 30000) */
  retryMaxDelay?: number
  /** Backoff multiplier for exponential backoff (default: 2) */
  retryBackoffMultiplier?: number
  /** Whether to use exponential backoff (default: true) */
  retryExponentialBackoff?: boolean

  domainWhitelist?: TDomainWhitelistConfig
}

/**
 * FaaS endpoint configuration
 */
export type TFaaSEndpointConfig = TSharedEndpointOpts<
  EEndpointType.faas,
  {
    /** Function ID to call */
    functionId: string
    /** Arguments to pass to the function */
    arguments?: Record<string, any>
    /** Environment variables to expose to the function */
    envVars?: Record<string, string>
    /** Secret IDs to expose to the function (by ID) */
    secrets?: string[]
    /** Execution timeout in milliseconds */
    timeout?: number
    /** Maximum memory allocation in MB */
    memory?: number
  }
>

/**
 * Agent endpoint configuration
 */
export type TAgentEndpointConfig = TSharedEndpointOpts<
  EEndpointType.agent,
  {
    /** Agent ID to use for this endpoint */
    agentId: string
    /** Optional overrides for this specific endpoint */
    overrides?: {
      /** Override system prompt */
      systemPrompt?: string
      /** Override model */
      model?: string
      /** Override max tokens */
      maxTokens?: number
      /** Override tools */
      tools?: string[]
      /** Additional environment variables */
      envVars?: Record<string, string>
      /** Additional secrets (by ID) */
      secrets?: string[]
    }
  }
>

/**
 * Proxy endpoint configuration (existing functionality)
 */
export type TProxyEndpointConfig = TSharedEndpointOpts<
  EEndpointType.proxy,
  {
    /** Target URL for proxying */
    url: string
    /** HTTP method */
    method?: string
    /** Transform configuration */
    transform?: TBodyTransformConfig
  }
>

export type TEPOptsSwitch<T extends `${EEndpointType}`> =
  T extends `${EEndpointType.proxy}`
    ? TProxyEndpointConfig
    : T extends `${EEndpointType.faas}`
      ? TFaaSEndpointConfig
      : TAgentEndpointConfig

export type TEndpointOpts<T extends TEndpointType = EEndpointType> = TEPOptsSwitch<T>
