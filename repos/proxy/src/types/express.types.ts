import type { TAuthHeaderObj } from '@tdsk/domain'

// Extend Express Request type to include auth user
declare global {
  namespace Express {
    interface Request {
      user?: TAuthHeaderObj
    }
  }
}
