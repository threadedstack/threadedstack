import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { Endpoint, TProxyEndpointConfig } from '@tdsk/domain'

import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { EEndpointType } from '@tdsk/domain'
import { HttpMethods } from '@TBE/constants/values'
import { addEndpointHeaders, assertSafeEgressUrl, guardedFetch } from '@TBE/utils/proxy'
import { BaseEndpoint } from '@TBE/services/endpoints/base'
import { ProxyService, RetryService } from '@TBE/services/proxy'
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware'

/**
 * ProxyEndpoint
 *
 * Handles HTTP proxying with auth/oauth/retry/transforms.
 * Holds a singleton ProxyService instance so the OAuth token cache
 * is shared across all requests.
 */
export class ProxyEndpoint extends BaseEndpoint {
  readonly type = EEndpointType.proxy

  /** Singleton ProxyService — fixes OAuth cache bug */
  private proxyService = new ProxyService()

  validateOptions(options: Record<string, any>): void {
    if (!options?.url) {
      throw new Exception(400, `Proxy endpoint requires a url in options`)
    }
    if (options.proxyMethod) {
      const lower = options.proxyMethod.toLowerCase()
      if (!HttpMethods.includes(lower))
        throw new Exception(
          400,
          `Invalid proxy method. Must be one of: ${HttpMethods.join(', ')}`
        )
    }
  }

  async execute(req: TRequest, res: Response, endpoint: Endpoint): Promise<void> {
    const opts = endpoint.options as TProxyEndpointConfig
    if (!opts?.url) throw new Exception(400, `Endpoint has no proxy configuration`)

    // SSRF egress guard: refuse a proxy target that is (or DNS-resolves to) a
    // private/loopback/link-local/cluster-internal address before any secret is
    // attached. Closes the credentialed-SSRF hole for the /proxy path and the
    // agent connector that reuses this executor.
    await assertSafeEgressUrl(opts.url)

    // Extract the remaining path after /:projectId/:endpointId/
    const proxyPath = req.params[0] || ''

    // Fetch secrets scoped to this project
    const secrets = await this.fetchSecrets(endpoint)

    // Construct target URL for logging
    const targetUrl = `${opts.url}/${proxyPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`

    try {
      const proxyConfig = this.proxyService.applyEndpointOptions(opts, secrets)
      // Build retry configuration (per-request)
      const retryService = new RetryService(req, opts)

      // Helper function to execute the proxy request
      const executeProxy = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const proxy = createProxyMiddleware({
            target: opts.url,
            changeOrigin: true,
            pathRewrite: () => {
              return `/${proxyPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`
            },
            ...proxyConfig,
            selfHandleResponse: true,

            on: {
              proxyReq: async (proxyReq, request, response) => {
                try {
                  // Override HTTP method for upstream if proxyMethod is set
                  const upstreamMethod = opts.proxyMethod
                  if (upstreamMethod) {
                    proxyReq.method = upstreamMethod.toUpperCase()
                  }

                  if (endpoint.headers)
                    addEndpointHeaders(proxyReq, endpoint.headers, secrets)

                  const requestOrigin = request.headers.origin || request.headers.referer

                  await this.proxyService.applyEndpointOptionsAsync(
                    proxyReq,
                    opts,
                    secrets,
                    requestOrigin,
                    `/${proxyPath}`
                  )

                  logger.debug(`Proxying ${request.method} ${targetUrl}`)
                } catch (error) {
                  logger.error(`Error in proxyReq handler:`, error)
                  reject(error)
                }
              },

              proxyRes: responseInterceptor(
                async (responseBuffer, proxyRes, request, response) => {
                  try {
                    const statusCode = proxyRes.statusCode || 0

                    // Follow redirects server-side to prevent CORS errors.
                    // copyHeaders already set 3xx status/headers on `response`,
                    // but they aren't sent until res.write() — so we can override them.
                    if (
                      statusCode >= 300 &&
                      statusCode < 400 &&
                      proxyRes.headers.location
                    ) {
                      const redirectUrl = new URL(
                        proxyRes.headers.location,
                        opts.url
                      ).toString()
                      logger.debug(`Following server-side redirect to ${redirectUrl}`)

                      // Guard every redirect hop — a public upstream 302'ing to
                      // an internal host (metadata/K8s/backend) is an SSRF vector.
                      const finalRes = await guardedFetch(redirectUrl)
                      const body = Buffer.from(await finalRes.arrayBuffer())

                      // Override status and headers set by copyHeaders
                      response.statusCode = finalRes.status
                      for (const name of response.getHeaderNames()) {
                        response.removeHeader(name)
                      }
                      finalRes.headers.forEach((value, key) => {
                        if (key !== 'content-encoding' && key !== 'transfer-encoding') {
                          response.setHeader(key, value)
                        }
                      })

                      return body
                    }

                    if (statusCode >= 400) {
                      ;(request as any).__proxyStatusCode = statusCode
                    }

                    if (opts.transform && opts.transform.injectSecrets) {
                      const responseText = responseBuffer.toString('utf8')

                      try {
                        const responseJson = JSON.parse(responseText)
                        const transformed = this.proxyService.applyTransform(
                          responseJson,
                          opts.transform,
                          secrets
                        )
                        return JSON.stringify(transformed)
                      } catch {
                        return responseBuffer
                      }
                    }

                    return responseBuffer
                  } catch (error) {
                    logger.error(`Error in proxyRes handler:`, error)
                    ;(response as any).setHeader('x-tdsk-transform-error', '1')
                    return responseBuffer
                  }
                }
              ),

              error: async (err, request, response) => {
                const statusCode = (request as any).__proxyStatusCode

                retryService.meta.update(err)

                if (retryService.shouldRetry(err, statusCode)) {
                  logger.warn(`Proxy error (will retry): ${err.message}`, {
                    statusCode,
                    error: err,
                  })
                  reject(err)
                } else {
                  logger.error(`Proxy error (no retry):`, err)
                  reject(err)
                }
              },
            },
          })

          proxy(req, res, (err) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
      }

      // Retry loop
      let lastError: any = null
      let success = false

      while (!success) {
        try {
          await executeProxy()
          success = true
          const metadata = retryService.meta.get()
          metadata && metadata.attempt > 0 && retryService.logStatus(true)
        } catch (error) {
          lastError = error

          // Don't retry if headers already sent — response is committed
          if (res.headersSent) break

          const statusCode = (req as any).__proxyStatusCode

          if (!retryService.shouldRetry(error, statusCode)) break

          await retryService.delayRetry()
        }
      }

      // If we exited the loop without success, send error response
      if (!success && lastError) {
        const metadata = retryService.meta.get()
        metadata && metadata.attempt > 0 && retryService.logStatus(false)

        if (!res.headersSent) {
          const statusCode = (req as any).__proxyStatusCode || 502
          const errorMessage =
            lastError instanceof Error ? lastError.message : 'Unknown error'
          throw new Exception(statusCode, `Proxy failed after retries: ${errorMessage}`)
        }
      }
    } catch (error) {
      logger.error(`Error setting up proxy:`, error)

      if (!res.headersSent) {
        if (error instanceof Exception) throw error

        const errorMessage = error instanceof Error ? error.message : `Unknown error`
        throw new Exception(500, `Failed to setup proxy: ${errorMessage}`)
      }
    }
  }
}
