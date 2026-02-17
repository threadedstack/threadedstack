import type { Request } from 'express'
import type { TJWTPayload, TJWTValidationResult } from '@TPX/types'

import * as jose from 'jose'
import { EJWTError } from '@TPX/types'
import { logger } from '@TPX/utils/logger'
import {
  PublicRoutes,
  SessionRoutes,
  BearerPrefix,
  SessionPrefix,
} from '@TPX/constants/values'

export type TAuth = {
  url: string
}

export class Auth {
  jwksUrl: string | null = null
  jwks: jose.JWTVerifyGetKey | null = null

  constructor(opts: TAuth) {
    this.#init(opts)
  }

  /**
   * Initialize the JWKS client for JWT validation
   * @param opts.url - JWKS URL from Neon Auth (e.g., https://auth.example.com/.well-known/jwks.json)
   */
  #init = (opts: TAuth) => {
    const { url } = opts

    if (!url) throw new Error(`JWKS URL is required but not configured`)

    this.jwksUrl = url
    this.jwks = jose.createRemoteJWKSet(new URL(url))
  }

  /**
   * Check if the auth service has been initialized with the jwks URL
   */
  initialized = () => this.jwks !== null

  /**
   * Check if a route is public (doesn't require authentication)
   */
  isPublic = (path: string): boolean =>
    PublicRoutes.some((route) => path.startsWith(route))

  isSession = (path: string): boolean =>
    SessionRoutes.some((route) => path.startsWith(route))

  /**
   * Extract JWT token from Authorization header
   */
  extract = (req: Request): string | null => {
    const authHeader = req.headers.authorization
    if (!authHeader) return null

    if (authHeader.startsWith(BearerPrefix))
      return authHeader.slice(BearerPrefix.length).trim()

    if (authHeader.startsWith(SessionPrefix))
      return authHeader.slice(SessionPrefix.length).trim()

    logger.error(`Invalid Authorization header:`, authHeader)
    return null
  }

  /**
   * Verify a JWT token using JWKS
   * @param token - JWT token to verify
   * @returns Validation result with payload if valid
   */
  verify = async (token: string): Promise<TJWTValidationResult> => {
    if (!this.jwks)
      return {
        valid: false,
        error: `JWKS client not initialized. Call initJWKS first.`,
      }

    try {
      const { payload } = await jose.jwtVerify(token, this.jwks)

      return {
        valid: true,
        payload: payload as TJWTPayload,
      }
    } catch (err) {
      logger.error(`JWT verification failed:`, err)

      switch (err.name) {
        case EJWTError.expired: {
          return {
            valid: false,
            expired: true,
            error: `Token expired`,
          }
        }
        case EJWTError.claim: {
          return {
            valid: false,
            error: `Token claim validation failed: ${err.message}`,
          }
        }
        case EJWTError.signature: {
          return {
            valid: false,
            error: `Invalid token signature`,
          }
        }
        default: {
          return {
            valid: false,
            error: err.message || `Token verification failed`,
          }
        }
      }
    }
  }
}
