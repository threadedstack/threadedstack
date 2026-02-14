import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import type { TAuthCredentials } from '@TRL/types'

const DefaultProxyUrl = `https://px.local.threadedstack.app`
const ApiKeyPrefix = `tdsk_`
const ConfigPath = join(homedir(), `.config`, `tdsk`, `repl-auth.json`)

export class AuthManager {
  getCredentials(): TAuthCredentials | null {
    try {
      if (!existsSync(ConfigPath)) return null
      const raw = readFileSync(ConfigPath, `utf-8`)
      const data = JSON.parse(raw)
      if (!data?.apiKey || !data?.proxyUrl) return null
      return data as TAuthCredentials
    } catch {
      return null
    }
  }

  isLoggedIn(): boolean {
    return this.getCredentials() !== null
  }

  async login(apiKey: string, proxyUrl?: string, insecure?: boolean): Promise<void> {
    const url = proxyUrl || DefaultProxyUrl

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

    const dir = dirname(ConfigPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    const credentials: TAuthCredentials = { apiKey, proxyUrl: url, insecure }
    writeFileSync(ConfigPath, JSON.stringify(credentials, null, 2), `utf-8`)
  }

  logout(): void {
    try {
      if (existsSync(ConfigPath)) unlinkSync(ConfigPath)
    } catch {
      // Ignore errors during cleanup
    }
  }
}
