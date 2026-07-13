import type { TProxyApp } from '@TPX/types'
import type { Request } from 'express'
import type { Options } from 'express-rate-limit'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

const authLimiter = rateLimit({
  limit: 20,
  windowMs: 60_000,
  legacyHeaders: false,
  standardHeaders: 'draft-7',
  message: { error: `Too many requests, please try again later` },
})

const apiLimiter = rateLimit({
  limit: 1000,
  windowMs: 60_000,
  legacyHeaders: false,
  standardHeaders: 'draft-7',
  message: { error: `Too many requests, please try again later` },
})

/**
 * Keyed by API key first (the actual billable/throttleable principal on
 * /proxy traffic), falling back to org id, then IP for the deferred-auth
 * pass-through case where no API key was presented.
 */
const proxyLimiterKeyGenerator = (req: Request) =>
  req.user?.apiKeyId || req.user?.orgId || (req.ip ? ipKeyGenerator(req.ip) : `unknown`)

export const createProxyLimiter = (opts?: Partial<Options>) =>
  rateLimit({
    limit: 300,
    windowMs: 60_000,
    legacyHeaders: false,
    standardHeaders: 'draft-7',
    message: { error: `Too many requests, please try again later` },
    keyGenerator: proxyLimiterKeyGenerator,
    ...opts,
  })

const proxyLimiter = createProxyLimiter()

export const setupRateLimit = (app: TProxyApp) => {
  app.use(`/auth`, authLimiter)
  app.use(`/_`, apiLimiter)
}

/**
 * WebSocket upgrade requests never pass through Express (the raw http.Server
 * `upgrade` event is wired directly to a manual dispatch handler in
 * setupProxy.ts), so setupRateLimit's express-rate-limit middleware never
 * runs for them. This is a standalone, IP-keyed limiter callable from that
 * raw dispatch path — same window/limit shape as apiLimiter (WS routes live
 * under /_ and /ai) but backed by a plain Map instead of express-rate-limit's
 * Store, since there's no Express req/res to drive that middleware with.
 */
export const createUpgradeLimiter = (opts?: { limit?: number; windowMs?: number }) => {
  const limit = opts?.limit ?? 1000
  const windowMs = opts?.windowMs ?? 60_000
  const hits = new Map<string, { count: number; resetAt: number }>()

  return (ip?: string): boolean => {
    const key = ip ? ipKeyGenerator(ip) : `unknown`
    const now = Date.now()
    const entry = hits.get(key)

    if (!entry || now >= entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return true
    }

    entry.count += 1
    return entry.count <= limit
  }
}

export const checkUpgradeRateLimit = createUpgradeLimiter()

/**
 * Rate limits /proxy — the route that injects org secrets and calls paid
 * external APIs/LLM providers. Must run AFTER setupApiKeyAuth so req.user
 * (apiKeyId/orgId) is populated for keying; setupRateLimit above runs
 * before auth and can't see that context.
 */
export const setupProxyRateLimit = (app: TProxyApp) => {
  app.use(`/proxy`, proxyLimiter)
}
