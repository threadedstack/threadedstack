import type { TTsaConfig, TAuthConfig, TProjectConfig } from '@TSA/types/config.types'

import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect } from 'vitest'

describe(`Config Types`, () => {
  it(`TTsaConfig has correct shape`, () => {
    const config: TTsaConfig = {
      org: `org_1`,
      agent: `agent_1`,
      sandbox: { provider: ESandboxType.local, timeout: 300000 },
      auth: { apiKey: `tdsk_test`, proxyUrl: `https://example.com` },
      behavior: { autoResume: true, maxHistory: 50, confirmTools: false },
      display: { theme: `dark`, verbose: false, markdown: true, timestamps: false },
    }
    expect(config.auth.apiKey).toBe(`tdsk_test`)
    expect(config.display.theme).toBe(`dark`)
    expect(config.sandbox.provider).toBe(ESandboxType.local)
  })

  it(`TProjectConfig has correct shape`, () => {
    const config: TProjectConfig = {
      agent: `agent_1`,
      org: `org_1`,
      context: [`AGENTS.md`],
      hooks: {},
      tools: { confirm: [], block: [] },
    }
    expect(config.context).toEqual([`AGENTS.md`])
  })

  it(`TAuthConfig fields are optional except apiKey`, () => {
    const auth: TAuthConfig = { apiKey: `tdsk_test` }
    expect(auth.proxyUrl).toBeUndefined()
    expect(auth.insecure).toBeUndefined()
  })
})
