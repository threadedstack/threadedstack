import type { TApp } from '@TBE/types'
import rateLimit from 'express-rate-limit'

const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Too many requests, please try again later` },
})

const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: `Too many requests, please try again later` },
})

export const setupRateLimit = (app: TApp) => {
  app.use(`/_/ai/sessions`, authLimiter)
  app.use(`/_`, apiLimiter)
}
