import type { TRetryConfig } from '@TBE/types'
import { EHttpMethod, EApiKeyScope } from '@tdsk/domain'

export const sigs = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

export const AuthIgnore = [`/`, `/health`]

export const LoggerIgnore = {
  methods: [`OPTIONS`],
  routes: [`/.well-known/appspecific/com.chrome.devtools.json`],
}

export const HttpMethods = Object.values(EHttpMethod)
export const AllowedScopes: string[] = Object.values(EApiKeyScope)

// Retry on specific HTTP status codes
// 408: Request Timeout
// 429: Too Many Requests
// 500: Internal Server Error
// 502: Bad Gateway
// 503: Service Unavailable
// 504: Gateway Timeout
export const AllowedRetryCodes = [408, 429, 500, 502, 503, 504]

/**
 * Default retry configuration
 */
export const DefRetryCfg: TRetryConfig = {
  maxRetries: 3,
  // 1 second
  initialDelay: 1000,
  // 30 seconds
  maxDelay: 30000,
  backoffMultiplier: 2,
  exponentialBackoff: true,
}

export const DBPaging = {
  max: 200,
  default: 50,
}

export const SecretRefTest = /\{\{([^}]+)\}\}/
export const SecretRefPattern = /\{\{([^}]+)\}\}/g
