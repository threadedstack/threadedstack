import { describe, it, expect, vi, beforeEach } from 'vitest'

import { resolveSandboxProviderChain } from './resolveSandboxChain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: vi.fn().mockImplementation(() => ({})),
}))

const mockChain = vi.fn()
vi.mock(`@TBE/utils/sandbox/resolveProviderEnv`, () => ({
  resolveProviderEnvChain: (...args: any[]) => mockChain(...args),
}))

const emptyChain = {
  primaryBrand: ``,
  primaryEnv: {},
  placeholders: {},
  fallbacks: [],
  errors: [],
}

const makeDb = (record: unknown) =>
  ({
    services: { sandbox: { get: vi.fn().mockResolvedValue({ data: record }) } },
  }) as any

describe(`resolveSandboxProviderChain`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChain.mockResolvedValue({ ...emptyChain })
  })

  it(`throws when the sandbox record is missing`, async () => {
    await expect(
      resolveSandboxProviderChain(makeDb(null), { orgId: `og_1`, sandboxId: `sb_x` })
    ).rejects.toThrow(`Sandbox config not found: sb_x`)
  })

  it(`throws when the sandbox belongs to another org (defense in depth)`, async () => {
    const db = makeDb({ orgId: `og_OTHER`, config: { runtime: `claude-code` } })
    await expect(
      resolveSandboxProviderChain(db, { orgId: `og_1`, sandboxId: `sb_x` })
    ).rejects.toThrow(`does not belong to org og_1`)
    expect(mockChain).not.toHaveBeenCalled()
  })

  it(`throws when the provider chain resolves with errors`, async () => {
    mockChain.mockResolvedValue({ ...emptyChain, errors: [`unscoped placeholder`] })
    const db = makeDb({ orgId: `og_1`, config: { runtime: `claude-code` } })
    await expect(
      resolveSandboxProviderChain(db, { orgId: `og_1`, sandboxId: `sb_x` })
    ).rejects.toThrow(`Provider auth configuration error: unscoped placeholder`)
  })

  it(`resolves the effective project config and passes ai links by priority`, async () => {
    const projectConfig = { runtime: `codex` }
    const links = [
      { provider: { id: `pv_a`, type: `ai` }, priority: 1, model: `m1` },
      { provider: { id: `pv_git`, type: `git` }, priority: 0 },
      { provider: { id: `pv_b`, type: `ai` }, priority: 0, model: null },
    ]
    const record = {
      orgId: `og_1`,
      config: { runtime: `claude-code` },
      providerLinks: links,
      getEffectiveConfig: vi.fn().mockReturnValue({
        config: projectConfig,
        providerLinks: links,
      }),
    }
    mockChain.mockResolvedValue({
      ...emptyChain,
      primaryBrand: `anthropic`,
      primaryEnv: { CLAUDE_CODE_OAUTH_TOKEN: `ph_1` },
      placeholders: { ph_1: { secretId: `sc_1` } },
      fallbacks: [{ brand: `zai`, env: {} }],
    })

    const result = await resolveSandboxProviderChain(makeDb(record), {
      orgId: `og_1`,
      sandboxId: `sb_x`,
      projectId: `pj_1`,
    })

    expect(record.getEffectiveConfig).toHaveBeenCalledWith(`pj_1`)
    // Git providers filtered out; ai links passed with priority + model
    expect(mockChain).toHaveBeenCalledWith(
      `codex`,
      [
        { provider: links[0].provider, priority: 1, model: `m1` },
        { provider: links[2].provider, priority: 0, model: undefined },
      ],
      expect.anything(),
      `og_1`
    )
    expect(result.sandboxConfig).toBe(projectConfig)
    expect(result.chain).toEqual({
      primaryBrand: `anthropic`,
      primaryEnv: { CLAUDE_CODE_OAUTH_TOKEN: `ph_1` },
      placeholders: { ph_1: { secretId: `sc_1` } },
      fallbacks: [{ brand: `zai`, env: {} }],
    })
  })
})
