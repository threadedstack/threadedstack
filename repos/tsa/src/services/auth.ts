import type { TAuthCredentials, TTokenLoginOpts } from '@TSA/types'

import { ApiKeyPrefix } from '@TSA/constants'
import { ConfigService } from '@TSA/services/config'
import { isLocalUrl } from '@TSA/utils/api/isLocalUrl'
import { resolveProxyUrl } from '@TSA/utils/tasks/resolveUrls'

export class AuthManager {
  creds(): TAuthCredentials | null {
    try {
      const config = ConfigService.loadGlobal()
      const auth = config.auth
      if (!auth?.apiKey && !auth?.token) return null

      const proxyUrl = auth.proxyUrl || resolveProxyUrl(config)
      const insecure = auth.insecure

      if (auth.apiKey) return { apiKey: auth.apiKey, proxyUrl, insecure }

      return {
        proxyUrl,
        insecure,
        token: auth.token!,
        expiresAt: auth.expiresAt,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : `unknown error`
      process.stderr.write(`Warning: could not read credentials: ${msg}\n`)
      return null
    }
  }

  get bearer(): string | null {
    const c = this.creds()
    return c?.apiKey ?? c?.token ?? null
  }

  loggedIn(): boolean {
    return this.creds() !== null
  }

  isExpired(): boolean {
    const c = this.creds()
    if (!c?.expiresAt) return false
    return new Date(c.expiresAt).getTime() <= Date.now()
  }

  async login(apiKey: string, proxyUrl?: string, insecure?: boolean): Promise<void> {
    const url = proxyUrl || resolveProxyUrl()

    if (!apiKey.startsWith(ApiKeyPrefix)) {
      throw new Error(`Invalid API key format. Keys must start with "${ApiKeyPrefix}"`)
    }

    const isLocalProxy = isLocalUrl(url)
    const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    if (insecure || isLocalProxy) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

    try {
      const res = await fetch(`${url}/_/orgs`, {
        headers: {
          Accept: `application/json`,
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => ``)
        throw new Error(
          `Authentication failed (${res.status}): ${body || `Invalid API key or proxy URL`}`
        )
      }

      const config = ConfigService.loadGlobal()
      config.auth = { apiKey, proxyUrl: url, insecure }
      ConfigService.saveGlobal(config)
    } finally {
      if (originalTls !== undefined)
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls
      else delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    }
  }

  async loginWithToken(opts: TTokenLoginOpts): Promise<void> {
    const { token, neonAuthUrl, insecure } = opts
    const url = opts.proxyUrl || resolveProxyUrl()

    const isLocalProxy = isLocalUrl(url)
    const originalTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    if (insecure || isLocalProxy) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

    try {
      const res = await fetch(`${url}/_/orgs`, {
        headers: {
          Accept: `application/json`,
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => ``)
        throw new Error(
          `Authentication failed (${res.status}): ${body || `Invalid token or proxy URL`}`
        )
      }

      const expiresAt = this.#resolveExpiresAt(token, opts.expiresAt)

      const config = ConfigService.loadGlobal()
      config.auth = { token, expiresAt, proxyUrl: url, insecure, neonAuthUrl }
      ConfigService.saveGlobal(config)
    } finally {
      if (originalTls !== undefined)
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTls
      else delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    }
  }

  #resolveExpiresAt(token: string, sessionExpiresAt?: string): string | undefined {
    try {
      const parts = token.split(`.`)
      if (parts.length !== 3) return sessionExpiresAt

      const payload = JSON.parse(Buffer.from(parts[1], `base64url`).toString(`utf8`))

      if (typeof payload.exp === `number`) {
        const jwtMs = payload.exp * 1000
        const jwtExpiry = new Date(jwtMs).toISOString()
        if (!sessionExpiresAt) return jwtExpiry

        const sessionMs = new Date(sessionExpiresAt).getTime()
        return jwtMs < sessionMs ? jwtExpiry : sessionExpiresAt
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : `unknown`
      process.stderr.write(
        `Warning: could not decode JWT expiry, using session expiresAt: ${msg}\n`
      )
    }

    return sessionExpiresAt
  }

  logout(): void {
    try {
      const config = ConfigService.loadGlobal()
      delete config.auth
      ConfigService.saveGlobal(config)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `unknown`
      process.stderr.write(`Warning: could not clear credentials: ${msg}\n`)
    }
  }
}
