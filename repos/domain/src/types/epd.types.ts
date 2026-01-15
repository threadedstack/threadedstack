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

export type TEndpointOpts = {
  timeout?: number
  retries?: number
  pathRegex?: string
  oauth?: TOAuthConfig
  transform?: TBodyTransformConfig
  domainWhitelist?: TDomainWhitelistConfig
  auth?: {
    secretName?: string
    headerName?: string
    type?: `bearer` | `basic` | `apikey`
  }
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
