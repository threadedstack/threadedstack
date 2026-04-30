import type { AuthManager } from '@TSA/services/auth'

import { ConfigService } from '@TSA/services/config'
import { RefreshBufferMs } from '@TSA/constants/api'

export class TokenRefreshService {
  #auth: AuthManager
  #refreshing: Promise<boolean> | null = null

  constructor(auth: AuthManager) {
    this.#auth = auth
  }

  async maybeRefresh(): Promise<boolean> {
    const creds = this.#auth.creds()
    if (!creds || creds.apiKey) return true
    if (!creds.expiresAt) return true

    const expiresMs = new Date(creds.expiresAt).getTime()
    if (isNaN(expiresMs)) {
      process.stderr.write(
        `Warning: expiresAt value "${creds.expiresAt}" is not a valid date. Token refresh may not work.\n`
      )
      return true
    }

    const remaining = expiresMs - Date.now()
    if (remaining > RefreshBufferMs) return true

    return this.#tryRefresh()
  }

  async #tryRefresh(): Promise<boolean> {
    if (this.#refreshing) return this.#refreshing
    this.#refreshing = this.#doRefresh()
    try {
      return await this.#refreshing
    } finally {
      this.#refreshing = null
    }
  }

  async #doRefresh(): Promise<boolean> {
    const creds = this.#auth.creds()
    if (!creds?.token) return false

    const authUrl = this.#resolveNeonAuthUrl()
    if (!authUrl) {
      process.stderr.write(`Warning: cannot refresh token — no auth URL configured\n`)
      return false
    }

    try {
      const res = await fetch(`${authUrl}/api/auth/get-session`, {
        headers: {
          Accept: `application/json`,
          Authorization: `Bearer ${creds.token}`,
        },
      })

      if (!res.ok) {
        process.stderr.write(
          `Warning: token refresh request failed (HTTP ${res.status})\n`
        )
        return false
      }

      let data: any
      try {
        data = await res.json()
      } catch {
        process.stderr.write(
          `Warning: token refresh endpoint returned non-JSON response\n`
        )
        return false
      }

      const session = data?.session
      if (!session?.token) {
        process.stderr.write(
          `Warning: token refresh response did not include a valid session\n`
        )
        return false
      }

      const expiresAt =
        session.expiresAt instanceof Date
          ? session.expiresAt.toISOString()
          : String(session.expiresAt || ``)

      await this.#auth.loginWithToken({
        token: session.token,
        expiresAt,
        proxyUrl: creds.proxyUrl,
        insecure: creds.insecure,
        authUrl,
      })

      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Unknown refresh error`
      process.stderr.write(`Warning: token refresh failed: ${msg}\n`)
      return false
    }
  }

  #resolveNeonAuthUrl(): string | null {
    try {
      const config = ConfigService.loadGlobal()
      if (config?.auth?.authUrl) return config.auth.authUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : `unknown`
      process.stderr.write(`Warning: could not read config for auth URL: ${msg}\n`)
    }
    return process.env.TDSK_AUTH_URL || null
  }
}
