import type { Secret } from '@tdsk/domain'
import type { ClientRequest } from 'http'
import type { Options } from 'http-proxy-middleware'
import type { TOAuthConfig, TEndpointOpts, TBodyTransformConfig } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isDomainAllowed } from '@TBE/utils/proxy/domainMatch'
import { guardedFetch } from '@TBE/utils/proxy/egressGuard'
import { Exception, EEPCredential, EEPAuthType } from '@tdsk/domain'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'

/**
 * OAuth token cache entry
 */
type TOAuthToken = {
  token: string
  expiresAt: number
}

/**
 * ProxyService
 *
 * Service for applying endpoint options to proxy requests.
 * Handles OAuth token management, authentication, validation, and transformations.
 */
export class ProxyService {
  /**
   * OAuth token cache
   * Key: `${tokenUrl}:${clientId}`
   */
  private oauthTokenCache: Map<string, TOAuthToken>

  constructor() {
    this.oauthTokenCache = new Map()
  }

  /**
   * Fetches or refreshes an OAuth access token
   * @param oauth - OAuth configuration
   * @param secrets - Available secrets for replacement
   * @returns Access token string
   */
  async getOAuthToken(oauth: TOAuthConfig, secrets?: Secret[]): Promise<string> {
    // Replace secret references in OAuth config
    const processedOAuth =
      secrets && secrets.length > 0 ? SecretResolver.replaceInObj(oauth, secrets) : oauth

    const {
      scopes,
      tokenUrl,
      clientId,
      clientSecret,
      additionalParams,
      credentialType = EEPCredential.header,
    } = processedOAuth

    const cacheKey = `${tokenUrl}:${clientId}`
    const cached = this.oauthTokenCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      logger.debug(`Using cached OAuth token for ${cacheKey}`)
      return cached.token
    }

    const params = new URLSearchParams()
    params.append(`grant_type`, `client_credentials`)

    if (scopes && scopes.length > 0) params.append(`scope`, scopes.join(` `))

    additionalParams &&
      Object.entries(additionalParams).forEach(([key, value]) => {
        params.append(key, value)
      })

    // Prepare headers and body based on credential style
    const headers: Record<string, string> = {
      [`Content-Type`]: `application/x-www-form-urlencoded`,
    }

    if (credentialType === EEPCredential.header) {
      // RFC 6749 - Basic Auth (recommended)
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(`base64`)
      headers.Authorization = `Basic ${credentials}`
    } else {
      // Body credentials (less secure, but some providers require it)
      params.append(`client_id`, clientId)
      params.append(`client_secret`, clientSecret)
    }

    try {
      logger.debug(`Fetching OAuth token from ${tokenUrl}`)

      // SSRF guard: the token exchange ships the client-credentials secret, so a
      // tokenUrl pointing at an internal host (metadata / K8s API / backend) must
      // be refused before the credentialed request goes out. guardedFetch also
      // guards each redirect hop.
      const response = await guardedFetch(tokenUrl, {
        headers,
        method: `POST`,
        body: params.toString(),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Request failed with status ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      const { access_token: token, expires_in = 3600 } = data

      if (!token) throw new Exception(502, `OAuth token response missing access_token`)

      // Cache token with 5-minute buffer before expiration
      const expiresAt = Date.now() + (expires_in - 300) * 1000

      this.oauthTokenCache.set(cacheKey, {
        token,
        expiresAt,
      })

      logger.debug(`OAuth token cached until ${new Date(expiresAt).toISOString()}`)
      return token
    } catch (error) {
      logger.error(`OAuth token exchange failed:`, error)
      throw new Exception(502, `Failed to obtain OAuth access token`)
    }
  }

  /**
   * Clears OAuth token cache (useful for testing or forced refresh)
   * @param cacheKey - Optional specific cache key to clear, or clears all if not provided
   */
  clearOAuthCache(cacheKey?: string): void {
    if (cacheKey) {
      this.oauthTokenCache.delete(cacheKey)
      logger.debug(`Cleared OAuth cache for ${cacheKey}`)
    } else {
      this.oauthTokenCache.clear()
      logger.debug(`Cleared all OAuth cache`)
    }
  }

  /**
   * Applies endpoint authentication options to proxy request
   * @param proxyReq - Outgoing proxy request
   * @param auth - Auth configuration
   * @param secrets - Available secrets for replacement
   */
  async applyAuth(
    proxyReq: ClientRequest,
    auth: NonNullable<TEndpointOpts[`auth`]>,
    secrets?: Secret[]
  ): Promise<void> {
    const { type, secretId, headerName = `Authorization` } = auth

    if (!secretId) {
      logger.warn(`Auth configured but no secretId provided`)
      throw new Exception(400, `Auth configured but no secretId provided`)
    }

    const secret = secrets?.find((s) => s.id === secretId)

    if (!secret || !secret.value) {
      logger.warn(`Secret with ID "${secretId}" not found for auth`)
      throw new Exception(404, `Secret not found for auth`)
    }

    switch (type) {
      case EEPAuthType.bearer:
        proxyReq.setHeader(headerName, `Bearer ${secret.value}`)
        logger.debug(`Applied Bearer auth to ${headerName}`)
        break

      case EEPAuthType.basic: {
        const basicCreds = Buffer.from(secret.value).toString('base64')
        proxyReq.setHeader(headerName, `Basic ${basicCreds}`)
        logger.debug(`Applied Basic auth to ${headerName}`)
        break
      }

      case EEPAuthType.apikey:
        proxyReq.setHeader(headerName, secret.value)
        logger.debug(`Applied API key to ${headerName}`)
        break

      default:
        throw new Exception(400, `Unknown auth type: ${type}`)
    }
  }

  /**
   * Applies OAuth authentication to proxy request
   * @param proxyReq - Outgoing proxy request
   * @param oauth - OAuth configuration
   * @param secrets - Available secrets for replacement
   */
  async applyOAuth(
    proxyReq: ClientRequest,
    oauth: TOAuthConfig,
    secrets?: Secret[]
  ): Promise<void> {
    try {
      const token = await this.getOAuthToken(oauth, secrets)
      proxyReq.setHeader(`Authorization`, `Bearer ${token}`)
      logger.debug(`Applied OAuth Bearer token`)
    } catch (error) {
      logger.error(`Failed to apply OAuth:`, error)
      throw error
    }
  }

  /**
   * Validates incoming request origin against domain whitelist
   * @param requestOrigin - Origin of the incoming request (from Origin or Referer header)
   * @param domainWhitelist - Domain whitelist configuration
   * @returns True if allowed, false otherwise
   */
  validateDomainWhitelist(
    requestOrigin: string | undefined,
    domainWhitelist: NonNullable<TEndpointOpts[`domainWhitelist`]>
  ): boolean {
    const { allowedDomains, logBlocked = true, enforceWhitelist = true } = domainWhitelist

    if (!enforceWhitelist) return true

    // If no origin provided, reject if whitelist is enforced
    if (!requestOrigin) {
      logBlocked &&
        logger.warn(`Domain whitelist blocked request: no origin/referer header`)
      return false
    }

    try {
      // Parse origin - could be full URL or just hostname
      let hostname: string

      if (requestOrigin.startsWith(`http://`) || requestOrigin.startsWith(`https://`)) {
        const url = new URL(requestOrigin)
        hostname = url.hostname
      } else {
        // Just hostname provided
        hostname = requestOrigin
      }

      const isAllowed = isDomainAllowed(hostname, allowedDomains)

      !isAllowed &&
        logBlocked &&
        logger.warn(`Domain whitelist blocked request from origin: ${hostname}`)

      return isAllowed
    } catch (error) {
      logger.error(`Invalid request origin for whitelist validation:`, error)
      return false
    }
  }

  /**
   * Validates request path against regex pattern
   * @param requestPath - Request path to validate
   * @param pathRegex - Path regex pattern
   * @returns True if matches, false otherwise
   */
  validatePathRegex(requestPath: string, pathRegex: string): boolean {
    try {
      const regex = new RegExp(pathRegex)
      const matches = regex.test(requestPath)

      !matches && logger.debug(`Path regex ${pathRegex} did not match ${requestPath}`)

      return matches
    } catch (error) {
      logger.error(`Invalid path regex pattern:`, error)
      return false
    }
  }

  /**
   * Applies all endpoint options to the proxy middleware configuration
   * @param options - Endpoint options from database
   * @param secrets - Available secrets for replacement
   * @returns Modified proxy middleware options
   */
  applyEndpointOptions(options: TEndpointOpts, secrets?: Secret[]): Partial<Options> {
    const proxyOptions: Partial<Options> = {}

    // Apply timeout
    if (options.timeout) {
      proxyOptions.timeout = options.timeout
      logger.debug(`Applied timeout: ${options.timeout}ms`)
    }

    // Note: http-proxy-middleware doesn't natively support retries
    // Retries would need to be implemented in the error handler
    if (options.retries) logger.debug(`Retry count configured: ${options.retries}`)

    return proxyOptions
  }

  /**
   * Applies endpoint options that require async operations (auth, oauth)
   * This should be called in the onProxyReq handler
   * @param proxyReq - Outgoing proxy request
   * @param options - Endpoint options
   * @param secrets - Available secrets
   * @param requestOrigin - Origin of the incoming request (from Origin or Referer header)
   * @param requestPath - Request path for path regex validation
   */
  async applyEndpointOptionsAsync(
    proxyReq: ClientRequest,
    options: TEndpointOpts,
    secrets: Secret[] | undefined,
    requestOrigin: string | undefined,
    requestPath: string
  ): Promise<void> {
    // Validate domain whitelist (checks incoming request origin, not target URL)
    if (options.domainWhitelist) {
      const allowed = this.validateDomainWhitelist(requestOrigin, options.domainWhitelist)
      if (!allowed) throw new Exception(403, `Request origin not in domain whitelist`)
    }

    // Validate path regex
    if (options.pathRegex) {
      const matches = this.validatePathRegex(requestPath, options.pathRegex)
      if (!matches) throw new Exception(403, `Request path does not match pathRegex`)
    }

    // Apply OAuth (takes precedence over basic auth)
    if (options.oauth) {
      await this.applyOAuth(proxyReq, options.oauth, secrets)
      return
    }

    // Apply basic authentication
    options.auth && (await this.applyAuth(proxyReq, options.auth, secrets))
  }

  /**
   * Applies transform options to request/response bodies
   * @param body - Request or response body
   * @param transform - Transform configuration
   * @param secrets - Available secrets
   * @returns Transformed body
   */
  applyTransform(body: any, transform: TBodyTransformConfig, secrets?: Secret[]): any {
    if (!transform.injectSecrets || !secrets || secrets.length === 0) return body

    return isObj(body) ? SecretResolver.replaceInObj(body, secrets) : body
  }
}
