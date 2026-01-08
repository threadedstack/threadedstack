import type { Request } from 'express'
import type { TTokenPayload } from '@TPX/types'

import jwt from 'jsonwebtoken'

/**
 * Verify a refresh token and return the payload
 */
export const verifyRefreshToken = (
  token: string,
  secret: string
): TTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, secret) as TTokenPayload & { type?: string }
    if (decoded.type !== `refresh`) {
      return null
    }
    return decoded
  } catch {
    return null
  }
}

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

/**
 * Generate a JWT access token
 */
export const generateAccessToken = (
  payload: Omit<TTokenPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string
): string => {
  return jwt.sign(payload, secret, { expiresIn })
}

/**
 * Generate a JWT refresh token
 */
export const generateRefreshToken = (
  payload: Omit<TTokenPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string
): string => {
  return jwt.sign({ ...payload, type: `refresh` }, secret, { expiresIn })
}
