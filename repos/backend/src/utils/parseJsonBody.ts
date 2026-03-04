import type { TRequest } from '@TBE/types'

import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { RequestBodyMaxSize } from '@TBE/constants/values'

/**
 * Parse JSON body from a raw request stream.
 *
 * Used by endpoint types that need parsed bodies (FaaS, Agent)
 * but run on routes that skip `express.json()` middleware
 * (proxy routes forward raw bodies upstream).
 *
 * If `req.body` is already parsed (e.g. by earlier middleware), returns it as-is.
 * Returns the parsed body, or an empty object if the body is empty.
 * Throws Exception(400) on malformed JSON, Exception(413) if body exceeds size limit.
 */
export const parseJsonBody = async (req: TRequest): Promise<any> => {
  if (req.body !== undefined && req.body !== null) return req.body

  const contentType = req.headers[`content-type`] || ``
  if (!contentType.includes(`application/json`)) return {}

  const raw = await new Promise<string>((resolve, reject) => {
    let data = ``
    let size = 0
    let rejected = false
    req.on(`data`, (chunk: Buffer) => {
      if (rejected) return
      size += chunk.length
      if (size > RequestBodyMaxSize) {
        rejected = true
        req.destroy()
        reject(
          new Exception(
            413,
            `Request body exceeds maximum size of ${RequestBodyMaxSize} bytes`
          )
        )
        return
      }
      data += chunk.toString()
    })
    req.on(`end`, () => resolve(data))
    req.on(`error`, reject)
  }).catch((err) => {
    if (err instanceof Exception) throw err
    logger.warn(
      `Failed to read request body: ${err instanceof Error ? err.message : String(err)}`
    )
    throw new Exception(400, `Failed to read request body`)
  })

  try {
    return raw ? JSON.parse(raw) : {}
  } catch (err: unknown) {
    logger.warn(
      `Failed to parse JSON body: ${err instanceof Error ? err.message : String(err)}`
    )
    throw new Exception(400, `Invalid JSON in request body`)
  }
}
