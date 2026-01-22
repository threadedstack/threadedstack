import type { Secret } from '@tdsk/domain'
import type { TEndpointOpts, TOAuthConfig } from '@tdsk/domain'
import type { Options } from 'http-proxy-middleware'
import type { ClientRequest } from 'http'

import axios from 'axios'
import { logger } from '@TBE/utils/logger'
import { replaceSecretsInObj } from '@TBE/utils/proxy/replaceSecretRefs'

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
      secrets && secrets.length > 0 ? replaceSecretsInObj(oauth, secrets) : oauth

    const {
      tokenUrl,
      clientId,
      clientSecret,
      scopes,
      additionalParams,
      credentialStyle = 'header',
    } = processedOAuth

    // Check cache
    const cacheKey = `${tokenUrl}:${clientId}`
    const cached = this.oauthTokenCache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      logger.debug(`Using cached OAuth token for ${cacheKey}`)
      return cached.token
    }

    // Prepare token request
    const params = new URLSearchParams()
    params.append('grant_type', 'client_credentials')

    if (scopes && scopes.length > 0) {
      params.append('scope', scopes.join(' '))
    }

    // Add additional parameters
    if (additionalParams) {
      Object.entries(additionalParams).forEach(([key, value]) => {
        params.append(key, value)
      })
    }

    // Prepare headers and body based on credential style
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    }

    if (credentialStyle === 'header') {
      // RFC 6749 - Basic Auth (recommended)
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      headers.Authorization = `Basic ${credentials}`
    } else {
      // Body credentials (less secure, but some providers require it)
      params.append('client_id', clientId)
      params.append('client_secret', clientSecret)
    }

    try {
      logger.debug(`Fetching OAuth token from ${tokenUrl}`)

      const response = await axios.post(tokenUrl, params.toString(), { headers })

      const { access_token, expires_in = 3600 } = response.data

      if (!access_token) {
        throw new Error('OAuth token response missing access_token')
      }

      // Cache token with 5-minute buffer before expiration
      const expiresAt = Date.now() + (expires_in - 300) * 1000

      this.oauthTokenCache.set(cacheKey, {
        token: access_token,
        expiresAt,
      })

      logger.debug(`OAuth token cached until ${new Date(expiresAt).toISOString()}`)

      return access_token
    } catch (error) {
      logger.error('OAuth token exchange failed:', error)
      throw new Error('Failed to obtain OAuth access token')
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
      logger.debug('Cleared all OAuth cache')
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
    auth: NonNullable<TEndpointOpts['auth']>,
    secrets?: Secret[]
  ): Promise<void> {
    const { type, secretName, headerName = 'Authorization' } = auth

    if (!secretName) {
      logger.warn('Auth configured but no secretName provided')
      return
    }

    // Find secret value
    const secret = secrets?.find((s) => s.name === secretName)

    if (!secret || !secret.value) {
      logger.warn(`Secret "${secretName}" not found for auth`)
      return
    }

    // Apply auth based on type
    switch (type) {
      case 'bearer':
        proxyReq.setHeader(headerName, `Bearer ${secret.value}`)
        logger.debug(`Applied Bearer auth to ${headerName}`)
        break

      case 'basic':
        // Assume secret.value is "username:password"
        const basicCreds = Buffer.from(secret.value).toString('base64')
        proxyReq.setHeader(headerName, `Basic ${basicCreds}`)
        logger.debug(`Applied Basic auth to ${headerName}`)
        break

      case 'apikey':
        // API key goes directly in the specified header
        proxyReq.setHeader(headerName, secret.value)
        logger.debug(`Applied API key to ${headerName}`)
        break

      default:
        logger.warn(`Unknown auth type: ${type}`)
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
      proxyReq.setHeader('Authorization', `Bearer ${token}`)
      logger.debug('Applied OAuth Bearer token')
    } catch (error) {
      logger.error('Failed to apply OAuth:', error)
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
    domainWhitelist: NonNullable<TEndpointOpts['domainWhitelist']>
  ): boolean {
    const { allowedDomains, enforceWhitelist = true, logBlocked = true } = domainWhitelist

    if (!enforceWhitelist) {
      return true
    }

    // If no origin provided, reject if whitelist is enforced
    if (!requestOrigin) {
      if (logBlocked) {
        logger.warn('Domain whitelist blocked request: no origin/referer header')
      }
      return false
    }

    try {
      // Parse origin - could be full URL or just hostname
      let hostname: string

      if (requestOrigin.startsWith('http://') || requestOrigin.startsWith('https://')) {
        const url = new URL(requestOrigin)
        hostname = url.hostname
      } else {
        // Just hostname provided
        hostname = requestOrigin
      }

      const isAllowed = allowedDomains.some((domain) => {
        // Support wildcards: *.example.com
        if (domain.startsWith('*.')) {
          const baseDomain = domain.slice(2)
          return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)
        }

        return hostname === domain
      })

      if (!isAllowed && logBlocked) {
        logger.warn(`Domain whitelist blocked request from origin: ${hostname}`)
      }

      return isAllowed
    } catch (error) {
      logger.error('Invalid request origin for whitelist validation:', error)
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

      if (!matches) {
        logger.debug(`Path regex ${pathRegex} did not match ${requestPath}`)
      }

      return matches
    } catch (error) {
      logger.error('Invalid path regex pattern:', error)
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
    if (options.retries) {
      logger.debug(`Retry count configured: ${options.retries}`)
    }

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

      if (!allowed) {
        throw new Error('Request origin not in domain whitelist')
      }
    }

    // Validate path regex
    if (options.pathRegex) {
      const matches = this.validatePathRegex(requestPath, options.pathRegex)

      if (!matches) {
        throw new Error('Request path does not match pathRegex')
      }
    }

    // Apply OAuth (takes precedence over basic auth)
    if (options.oauth) {
      await this.applyOAuth(proxyReq, options.oauth, secrets)
      return // OAuth applied, skip basic auth
    }

    // Apply basic authentication
    if (options.auth) {
      await this.applyAuth(proxyReq, options.auth, secrets)
    }
  }

  /**
   * Applies transform options to request/response bodies
   * @param body - Request or response body
   * @param transform - Transform configuration
   * @param secrets - Available secrets
   * @returns Transformed body
   */
  applyTransform(
    body: any,
    transform: NonNullable<TEndpointOpts['transform']>,
    secrets?: Secret[]
  ): any {
    if (!transform.injectSecrets || !secrets || secrets.length === 0) {
      return body
    }

    // Inject secrets into body
    if (typeof body === 'object' && body !== null) {
      return replaceSecretsInObj(body, secrets)
    }

    return body
  }
}
