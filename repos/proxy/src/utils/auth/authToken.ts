import type { Request } from 'express'

/**
 * Extract JWT token from Authorization header
 */
export const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith(`Bearer `)) {
    return null
  }
  return authHeader.substring(7)
}
