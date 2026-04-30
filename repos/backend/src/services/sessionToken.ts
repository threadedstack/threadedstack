import type { JwtPayload } from 'jsonwebtoken'

import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { logger } from '@TBE/utils/logger'
import { SessionTtlSec } from '@TBE/constants/values'

export type TSessionTokenPayload = {
  userId: string
  agentId: string
  orgId: string
  projectId?: string
}

export type TShellTokenPayload = {
  orgId: string
  userId: string
  sandboxId: string
}

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
    expiresIn: SessionTtlSec,
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

    if (!decoded.userId || !decoded.agentId || !decoded.orgId) {
      logger.warn(
        `Session token rejected: missing required claims (userId/agentId/orgId)`
      )
      return null
    }

    return {
      orgId: decoded.orgId,
      userId: decoded.userId,
      agentId: decoded.agentId,
      ...(decoded.projectId && { projectId: decoded.projectId }),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    message.includes(`expired`)
      ? logger.debug(`Session token expired`)
      : logger.warn(`Session token verification failed: ${message}`)

    return null
  }
}

/**
 * Sign a short-lived JWT for shell WebSocket auth (browser flow).
 * Used by POST /_/sandboxes/:id/connect to issue tokens.
 */
export const signShellToken = (payload: TShellTokenPayload): string => {
  return jwt.sign(
    { ...payload, kind: `shell`, jti: crypto.randomUUID() },
    getSigningKey(),
    {
      algorithm: `HS256`,
      expiresIn: SessionTtlSec,
    }
  )
}

/**
 * Verify and decode a shell session JWT.
 * Returns the payload or null if invalid/expired.
 */
export const verifyShellToken = (token: string): TShellTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, getSigningKey(), {
      algorithms: [`HS256`],
    }) as JwtPayload & TShellTokenPayload & { kind?: string }

    if (decoded.kind !== `shell`) {
      logger.warn(`Shell token rejected: wrong kind="${decoded.kind}", expected "shell"`)
      return null
    }
    if (!decoded.userId || !decoded.orgId || !decoded.sandboxId) {
      logger.warn(
        `Shell token rejected: missing required claims (userId/orgId/sandboxId)`
      )
      return null
    }

    return {
      orgId: decoded.orgId,
      userId: decoded.userId,
      sandboxId: decoded.sandboxId,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    message.includes(`expired`)
      ? logger.debug(`Shell token expired`)
      : logger.warn(`Shell token verification failed: ${message}`)

    return null
  }
}

/**
 * Reset the cached signing key (for testing only).
 */
export const resetSigningKey = (): void => {
  signingKey = undefined
}
