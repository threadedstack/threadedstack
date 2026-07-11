import type { TDatabase } from '@tdsk/database'

import { logger } from '@TBE/utils/logger'

/**
 * Triggers Caddy's on-demand TLS by hitting the domain over HTTPS with the
 * pre-warm header, then marks the domain verified in the database on
 * success. Fire-and-forget on failure — the certificate will be generated
 * on the domain's first real request either way, so a failed pre-warm must
 * never fail domain creation.
 */
export const prewarmDomainCertificate = async (
  db: TDatabase,
  domain: string,
  prewarmHeader: string
): Promise<void> => {
  try {
    const prewarmRes = await fetch(`https://${domain}`, {
      method: `GET`,
      headers: { [prewarmHeader]: `true` },
      signal: AbortSignal.timeout(10000),
    })

    if (prewarmRes.status < 400) {
      await db.services.domain.verified(domain)
    } else {
      const text = await prewarmRes.text()
      logger.warn(`Pre-warm request failed (this may be normal): ${text}`)
    }
  } catch (err: any) {
    logger.warn(`Pre-warm request failed (this may be normal): ${err.message}`)
    // Don't fail the request, the certificate will be generated on first real request
  }
}
