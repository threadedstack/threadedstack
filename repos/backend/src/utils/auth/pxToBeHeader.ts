import type { TRequest } from '@tdsk/domain'

import { timingSafeEqual } from 'crypto'
import { logger } from '@TBE/utils/logger'
import { exists } from '@keg-hub/jsutils/exists'

/** NODE_ENVs allowed to run WITHOUT the proxy header configured (bare local starts, unit tests). */
const HeaderOptionalEnvs = new Set([`local`, `test`])

/**
 * Validate the shared proxy→backend header — the proof a request traversed
 * the auth proxy (which strips/rewrites the X-User-* principal headers).
 *
 * FAIL CLOSED: outside an explicit `local`/`test` NODE_ENV, a missing
 * configured header value REJECTS the request. Trusting X-User-* headers
 * without proxy proof would let any direct caller forge a principal. Local
 * dev normally has the value too (deploy/values.yaml sets
 * TDSK_BE_HEADER_VALUE); the local/test carve-out only covers bare starts and
 * unit tests that run without the values files loaded.
 */
export const pxToBeHeader = (req: TRequest) => {
  const { config } = req.app?.locals

  if (!exists(config.proxy.headerValue)) {
    const environment = config.server?.environment
    if (environment && HeaderOptionalEnvs.has(environment)) return

    logger.error(
      `SECURITY: config.proxy.headerValue (TDSK_BE_HEADER_VALUE) is not configured in env "${environment}" — rejecting request. The proxy header is the proof a request traversed the auth proxy; without it X-User-* headers cannot be trusted.`
    )
    throw new Error(`Invalid proxy validation`)
  }

  const validate = req.header(config.proxy.headerKey)
  if (!validate || typeof validate !== 'string')
    throw new Error(`Invalid proxy validation`)

  const expected = Buffer.from(config.proxy.headerValue as string)
  const received = Buffer.from(validate)

  if (expected.length !== received.length || !timingSafeEqual(expected, received))
    throw new Error(`Invalid proxy validation`)
}
