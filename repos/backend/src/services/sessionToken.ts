import type { JwtPayload } from 'jsonwebtoken'

import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

export type TSessionTokenPayload = {
  userId: string
  agentId: string
  orgId: string
}

const SESSION_TTL_SEC = 3600 // 1 hour

let signingKey: Buffer | undefined

/**
 * Derive a signing key from TDSK_MASTER_KEY using HMAC-SHA256.
 * Keeps the signing key separate from the encryption key used for secrets.
 */
const getSigningKey = (): Buffer => {
  if (signingKey) return signingKey

  const masterKey = process.env.TDSK_MASTER_KEY
  if (!masterKey) throw new Error(`Required ENV 'TDSK_MASTER_KEY' is missing.`)

  signingKey = crypto
    .createHmac(`sha256`, Buffer.from(masterKey, `hex`))
    .update(`session-token-signing`)
    .digest()

  return signingKey
}

/**
 * Sign a short-lived JWT containing the session payload.
 * Used by POST /ai/sessions to issue tokens.
 */
export const signSessionToken = (payload: TSessionTokenPayload): string => {
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, getSigningKey(), {
    algorithm: `HS256`,
    expiresIn: SESSION_TTL_SEC,
  })
}

/**
 * Verify and decode a session JWT.
 * Returns the payload or null if invalid/expired.
 */
export const verifySessionToken = (token: string): TSessionTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, getSigningKey(), {
      algorithms: [`HS256`],
    }) as JwtPayload & TSessionTokenPayload

    if (!decoded.userId || !decoded.agentId || !decoded.orgId) return null

    return {
      userId: decoded.userId,
      agentId: decoded.agentId,
      orgId: decoded.orgId,
    }
  } catch {
    return null
  }
}

/**
 * Reset the cached signing key (for testing only).
 */
export const resetSigningKey = (): void => {
  signingKey = undefined
}
