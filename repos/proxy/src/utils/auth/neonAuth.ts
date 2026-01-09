import * as jose from 'jose'
import { logger } from '@TPX/utils/logger'

let jwks: jose.JWTVerifyGetKey | null = null
let jwksUrl: string | null = null

export type TJWTPayload = {
  sub?: string
  userId?: string
  email?: string
  teamId?: string
  role?: string
  iat?: number
  exp?: number
  [key: string]: unknown
}

export type TJWTValidationResult = {
  valid: boolean
  payload?: TJWTPayload
  error?: string
}

/**
 * Initialize the JWKS client for JWT validation
 * @param url - JWKS URL from Neon Auth (e.g., https://auth.example.com/.well-known/jwks.json)
 */
export const initJWKS = (url: string): void => {
  if (!url) {
    throw new Error(`JWKS URL is required but not configured`)
  }

  jwksUrl = url
  jwks = jose.createRemoteJWKSet(new URL(url))
  logger.info(`JWKS client initialized with URL: ${url}`)
}

/**
 * Check if JWKS client is initialized
 */
export const isJWKSInitialized = (): boolean => {
  return jwks !== null
}

/**
 * Get the JWKS URL
 */
export const getJWKSUrl = (): string | null => {
  return jwksUrl
}

/**
 * Verify a JWT token using JWKS
 * @param token - JWT token to verify
 * @returns Validation result with payload if valid
 */
export const verifyToken = async (token: string): Promise<TJWTValidationResult> => {
  if (!jwks) {
    return {
      valid: false,
      error: `JWKS client not initialized. Call initJWKS first.`,
    }
  }

  try {
    const { payload } = await jose.jwtVerify(token, jwks)

    return {
      valid: true,
      payload: payload as TJWTPayload,
    }
  } catch (err) {
    const error = err as Error

    if (error.name === 'JWTExpired') {
      return {
        valid: false,
        error: `Token expired`,
      }
    }

    if (error.name === 'JWTClaimValidationFailed') {
      return {
        valid: false,
        error: `Token claim validation failed: ${error.message}`,
      }
    }

    if (error.name === 'JWSSignatureVerificationFailed') {
      return {
        valid: false,
        error: `Invalid token signature`,
      }
    }

    logger.error(`JWT verification failed:`, err)
    return {
      valid: false,
      error: error.message || `Token verification failed`,
    }
  }
}
