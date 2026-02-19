import type { TAuthCredentials } from '@TRL/types'
import { ConfigService } from '@TRL/services/config'
import { DEFAULT_PROXY_URL } from '@TRL/constants'

const ApiKeyPrefix = `tdsk_`

export class AuthManager {
  getCredentials(): TAuthCredentials | null {
    try {
      const config = ConfigService.loadGlobal()
      if (!config.auth?.apiKey) return null
      return {
        apiKey: config.auth.apiKey,
        proxyUrl: config.auth.proxyUrl || DEFAULT_PROXY_URL,
        insecure: config.auth.insecure,
      }
    } catch {
      return null
    }
  }

  isLoggedIn(): boolean {
    return this.getCredentials() !== null
  }

  async login(apiKey: string, proxyUrl?: string, insecure?: boolean): Promise<void> {
    const url = proxyUrl || DEFAULT_PROXY_URL

    if (!apiKey.startsWith(ApiKeyPrefix)) {
      throw new Error(`Invalid API key format. Keys must start with "${ApiKeyPrefix}"`)
    }

    if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`

    const res = await fetch(`${url}/_/orgs`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: `application/json`,
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
