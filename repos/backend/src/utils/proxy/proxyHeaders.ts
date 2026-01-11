import type { Request } from 'express'
import type { TBEConfig } from '@TBE/types'
import type { ClientRequest, IncomingMessage } from 'http'

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
