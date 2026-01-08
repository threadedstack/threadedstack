import type { TAuthUser } from '@TPX/types/auth.types'

// Extend Express Request type to include auth user
declare global {
  namespace Express {
    interface Request {
      user?: TAuthUser
    }
  }
}
