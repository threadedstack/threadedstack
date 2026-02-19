import { describe, it, expect } from 'vitest'
import type {
  TReplConfig,
  TProjectConfig,
  TAuthConfig,
  TSandboxConfig,
  TDisplayConfig,
  TBehaviorConfig,
} from './config.types'

describe('Config Types', () => {
  it('TReplConfig has correct shape', () => {
    const config: TReplConfig = {
      auth: { apiKey: 'tdsk_test', proxyUrl: 'https://example.com' },
      org: 'org_1',
      agent: 'agent_1',
      display: { theme: 'dark', verbose: false, markdown: true, timestamps: false },
      behavior: { autoResume: true, maxHistory: 50, confirmTools: false },
      sandbox: { provider: 'local', timeout: 300000 },
    }
    expect(config.auth.apiKey).toBe('tdsk_test')
    expect(config.display.theme).toBe('dark')
    expect(config.sandbox.provider).toBe('local')
  })

  it('TProjectConfig has correct shape', () => {
    const config: TProjectConfig = {
      agent: 'agent_1',
      org: 'org_1',
      context: ['AGENTS.md'],
      hooks: {},
      tools: { confirm: [], block: [] },
    }
    expect(config.context).toEqual(['AGENTS.md'])
  })

  it('TAuthConfig fields are optional except apiKey', () => {
    const auth: TAuthConfig = { apiKey: 'tdsk_test' }
    expect(auth.proxyUrl).toBeUndefined()
    expect(auth.insecure).toBeUndefined()
  })
})
