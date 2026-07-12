import type { TProxyApp } from '@TPX/types'
import type { Request } from 'express'
import type rateLimit from 'express-rate-limit'
import type { Options } from 'express-rate-limit'
import { ipKeyGenerator } from 'express-rate-limit'

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
 * Rate limits /proxy — the route that injects org secrets and calls paid
 * external APIs/LLM providers. Must run AFTER setupApiKeyAuth so req.user
 * (apiKeyId/orgId) is populated for keying; setupRateLimit above runs
 * before auth and can't see that context.
 */
export const setupProxyRateLimit = (app: TProxyApp) => {
  app.use(`/proxy`, proxyLimiter)
}
