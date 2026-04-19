import type { TProxyApp } from '@TPX/types'
import rateLimit from 'express-rate-limit'

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

export const setupRateLimit = (app: TProxyApp) => {
  app.use(`/auth`, authLimiter)
  app.use(`/_`, apiLimiter)
}
