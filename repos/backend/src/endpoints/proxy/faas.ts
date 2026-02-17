import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TFaaSEndpointConfig, TFunctionResponse } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'

/**
 * Handle a FaaS-type endpoint by loading the linked function,
 * executing it inside a sandbox, and mapping the result to an HTTP response.
 */
export const handleFaaSEndpoint = async (
  req: TRequest,
  res: Response,
  endpoint: { options?: TFaaSEndpointConfig; projectId: string },
  db: TDatabase
): Promise<void> => {
  const opts = endpoint.options as TFaaSEndpointConfig | undefined
  const functionId = opts?.functionId

  if (!functionId) throw new Exception(400, `FaaS endpoint has no functionId configured`)

  // Load the function record from the database
  const { data: func, error } = await db.services.function.get(functionId)

  if (error || !func) throw new Exception(404, `Function not found: ${functionId}`)

  // Build TFunctionRequest from the Express request
  const functionRequest = {
    method: req.method,
    path: req.path,
    headers: req.headers as Record<string, string>,
    query: (req.query || {}) as Record<string, string>,
    body: req.body,
  }

  // Build TFunctionContext from endpoint options
  const functionContext = {
    envVars: opts?.envVars,
    args: opts?.arguments,
  }

  // Execute the function in a sandbox
  const result = await FunctionExecutor.execute(func as any, {
    request: functionRequest,
    context: functionContext,
  })

  if (!result.success) {
    logger.error(`FaaS execution failed for function ${functionId}: ${result.error}`)
    throw new Exception(
      500,
      `Function execution failed: ${result.error || 'Unknown error'}`
    )
  }

  // Map function output to HTTP response
  const output = (result.output || {}) as TFunctionResponse
  const statusCode = output.statusCode || 200
  const responseHeaders = output.headers
  const body = output.body ?? result.output

  // Apply custom response headers if present
  if (responseHeaders) {
    for (const [key, value] of Object.entries(responseHeaders)) {
      res.setHeader(key, value)
    }
  }

  res.status(statusCode).json(body)
}
