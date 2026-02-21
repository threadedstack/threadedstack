import type { TAuthCredentials } from '@TRL/types'
import { ConfigService } from '@TRL/services/config'
import { ApiKeyPrefix, DefaultProxyUrl } from '@TRL/constants'

export class AuthManager {
  creds(): TAuthCredentials | null {
    try {
      const config = ConfigService.loadGlobal()
      if (!config.auth?.apiKey) return null
      return {
        apiKey: config.auth.apiKey,
        insecure: config.auth.insecure,
        proxyUrl: config.auth.proxyUrl || DefaultProxyUrl,
      }
    } catch {
      return null
    }
  }

  loggedIn(): boolean {
    return this.creds() !== null
  }

  async login(apiKey: string, proxyUrl?: string, insecure?: boolean): Promise<void> {
    const url = proxyUrl || DefaultProxyUrl

    if (!apiKey.startsWith(ApiKeyPrefix)) {
      throw new Error(`Invalid API key format. Keys must start with "${ApiKeyPrefix}"`)
    }

    if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

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
  }

  logout(): void {
    try {
      const config = ConfigService.loadGlobal()
      delete config.auth
      ConfigService.saveGlobal(config)
    } catch {
      // Ignore errors during cleanup
    }
  }
}
