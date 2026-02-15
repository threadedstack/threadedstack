import type { Request } from 'express'
import type { Secret } from '@tdsk/domain'
import type { TBEConfig } from '@TBE/types'
import type { ClientRequest, IncomingMessage } from 'http'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'

/**
 * Updates the headers of the request sent to the proxy url
 */
export const addProxyHeader = (proxyReq: ClientRequest, config: TBEConfig): void => {
  const { headerValue, headerKey } = config.proxy
  if (!headerKey) return

  proxyReq.removeHeader(headerKey)

  headerValue && proxyReq.setHeader(headerKey, headerValue)
}

/**
 * Adds custom endpoint headers to the proxy request with secret replacement
 *
 * @param proxyReq - The outgoing proxy request
 * @param headers - Custom headers from endpoint configuration
 * @param secrets - Available secrets for replacement (optional)
 */
export const addEndpointHeaders = (
  proxyReq: ClientRequest,
  headers: Record<string, string>,
  secrets?: Secret[]
): void => {
  if (!headers || typeof headers !== 'object') return

  // Replace secret references if secrets are provided
  const processedHeaders =
    secrets && secrets.length > 0
      ? SecretResolver.replaceInHeaders(headers, secrets)
      : headers

  // Apply each header to the proxy request
  Object.entries(processedHeaders).forEach(
    ([key, value]) => key && value && proxyReq.setHeader(key, value)
  )
}

/**
 * Updates the headers of the response to include the Access-Control-Allow-Origin header
 */
export const addOriginHeader = (
  proxyRes: IncomingMessage,
  req: Request,
  config: TBEConfig
) => {
  const origin = (req.get(`origin`) || ``).trim()

  ;(config.server.origins.includes(`*`) || config.server.origins.includes(origin)) &&
    (proxyRes.headers[`Access-Control-Allow-Origin`] = origin)
}
