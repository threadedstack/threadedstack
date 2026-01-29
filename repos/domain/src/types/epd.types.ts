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

export type TEndpointOpts = {
  timeout?: number
  pathRegex?: string
  oauth?: TOAuthConfig
  auth?: TEndpointAuth

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

  transform?: TBodyTransformConfig
  domainWhitelist?: TDomainWhitelistConfig
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
