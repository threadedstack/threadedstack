import type { TLLMAdapterConfig } from '@tdsk/domain'

import crypto from 'node:crypto'

export type TSession = {
  agentId: string
  orgId: string
  userId: string
  llmConfig: TLLMAdapterConfig
  createdAt: number
}

export const SESSION_TTL = 3_600_000 // 1 hour

const sessions = new Map<string, TSession>()

let sweepInterval: ReturnType<typeof setInterval> | undefined

const isExpired = (session: TSession): boolean =>
  Date.now() - session.createdAt > SESSION_TTL

/**
 * Create a new session and return the opaque token
 */
export const createSession = (data: Omit<TSession, 'createdAt'>): string => {
  const token = crypto.randomUUID()
  sessions.set(token, { ...data, createdAt: Date.now() })

  if (!sweepInterval) {
    sweepInterval = setInterval(sweepExpired, 300_000) // 5 min
    sweepInterval.unref()
  }

  return token
}

/**
 * Retrieve a session by token. Returns undefined if missing or expired.
 */
export const getSession = (token: string): TSession | undefined => {
  const session = sessions.get(token)
  if (!session) return undefined

  if (isExpired(session)) {
    sessions.delete(token)
    return undefined
  }

  return session
}

/**
 * Delete a session by token
 */
export const deleteSession = (token: string): void => {
  sessions.delete(token)
}

/**
 * Sweep all expired sessions (called periodically)
 */
const sweepExpired = (): void => {
  for (const [token, session] of sessions) {
    if (isExpired(session)) sessions.delete(token)
  }
}

/**
 * Clear all sessions and stop sweep interval (for testing)
 */
export const resetSessionStore = (): void => {
  sessions.clear()
  if (sweepInterval) {
    clearInterval(sweepInterval)
    sweepInterval = undefined
  }
}
