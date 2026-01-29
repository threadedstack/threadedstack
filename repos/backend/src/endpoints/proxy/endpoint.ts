import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { addEndpointHeaders } from '@TBE/utils/proxy'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { RetryService, ProxyService } from '@TBE/services/proxy'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware'

// -----------------------------------
// TODO: Needs lots of clean up
// -----------------------------------

/**
 * GET/POST/PUT/PATCH/DELETE /proxy/:projectId/:endpointId/*
 *
 * Proxy requests through configured endpoints with full options support:
 * - Headers with secret injection
 * - Timeout and retries with exponential backoff
 * - Path regex validation
 * - Authentication (bearer, basic, apikey)
 * - OAuth 2.0 token exchange
 * - Request/response body transformation
 * - Domain whitelist
 *
 * Requires project member+ role or public endpoint
 */
export const endpoint: TEndpointConfig = {
  path: `/:projectId/:endpointId`,
  method: EPMethod.All,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId, endpointId } = req.params

    // Extract the remaining path after /:projectId/:endpointId/
    const proxyPath = req.params[0] || ''

    if (!projectId || !endpointId)
      throw new Exception(400, `Project ID and Endpoint ID are required`)

    // Fetch endpoint from database
    const { data: endpoint, error: fetchError } =
      await db.services.endpoint.get(endpointId)

    if (fetchError || !endpoint) throw new Exception(404, `Endpoint not found`)

    // Verify endpoint belongs to the specified project
    if (endpoint.projectId !== projectId)
      throw new Exception(403, `Endpoint does not belong to this project`)

    // Check permissions unless endpoint is public
    if (!endpoint.public) {
      try {
        await checkPermission(req, EPermAction.read, EPermResource.endpoint, {
          projectId,
        })
      } catch (error) {
        throw new Exception(403, `Insufficient permissions to use this endpoint`)
      }
    }

    // Validate HTTP method matches (if endpoint specifies a method)
    if (endpoint.method && endpoint.method.toLowerCase() !== req.method.toLowerCase())
      throw new Exception(
        405,
        `Method ${req.method} not allowed. Endpoint accepts ${endpoint.method.toUpperCase()}`
      )

    // Fetch secrets for this project (for secret replacement)
    const { data: secrets = [] } = await db.services.secret.list()

    // Construct target URL
    const targetUrl = `${endpoint.url}/${proxyPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`

    // Create proxy service instance
    const proxyService = new ProxyService()

    try {
      // Apply endpoint options to proxy configuration
      const options = endpoint.options || {}
      const proxyConfig = proxyService.applyEndpointOptions(options, secrets)

      // Build retry configuration
      const retryService = new RetryService(req, options)

      // Helper function to execute the proxy request
      const executeProxy = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          // Create proxy middleware
          const proxy = createProxyMiddleware({
            target: endpoint.url,
            changeOrigin: true,
            pathRewrite: () => {
              // Rewrite path to remove /proxy/:projectId/:endpointId prefix
              return `/${proxyPath}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`
            },
            ...proxyConfig,

            // Request interceptor - apply headers, auth, oauth
            on: {
              proxyReq: async (proxyReq, request, response) => {
                try {
                  // Apply endpoint headers with secret replacement
                  if (endpoint.headers)
                    addEndpointHeaders(proxyReq, endpoint.headers, secrets)

                  // Extract request origin for domain whitelist validation
                  const requestOrigin = request.headers.origin || request.headers.referer

                  // Apply async options (auth, oauth, validations)
                  await proxyService.applyEndpointOptionsAsync(
                    proxyReq,
                    options,
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

              // Response interceptor - apply response transformation
              proxyRes: responseInterceptor(
                async (responseBuffer, proxyRes, request, response) => {
                  try {
                    // Check if response indicates an error
                    const statusCode = proxyRes.statusCode || 0

                    // Store status code for retry decision
                    if (statusCode >= 400) {
                      ;(request as any).__proxyStatusCode = statusCode
                    }

                    // Apply response body transformation
                    if (options.transform && options.transform.injectSecrets) {
                      const responseText = responseBuffer.toString('utf8')

                      try {
                        const responseJson = JSON.parse(responseText)
                        const transformed = proxyService.applyTransform(
                          responseJson,
                          options.transform,
                          secrets
                        )
                        return JSON.stringify(transformed)
                      } catch {
                        // Not JSON, return as-is
                        return responseBuffer
                      }
                    }

                    return responseBuffer
                  } catch (error) {
                    logger.error(`Error in proxyRes handler:`, error)
                    return responseBuffer
                  }
                }
              ),

              // Error handler with retry logic
              error: async (err, request, response) => {
                const statusCode = (request as any).__proxyStatusCode

                // Update retry metadata with the error
                retryService.meta.update(err)

                // Check if we should retry
                if (retryService.shouldRetry(err, statusCode)) {
                  logger.warn(`Proxy error (will retry): ${err.message}`, {
                    statusCode,
                    error: err,
                  })

                  // Reject to trigger retry in the outer loop
                  reject(err)
                } else {
                  logger.error(`Proxy error (no retry):`, err)
                  // Reject without retry
                  reject(err)
                }
              },
            },
          })

          // Execute proxy
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

          // Check if we should retry
          const statusCode = (req as any).__proxyStatusCode

          // No more retries, break the loop
          if (!retryService.shouldRetry(error, statusCode)) break

          // Execute the retry delay before next attempt
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
  },
}
