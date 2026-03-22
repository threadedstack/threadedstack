import type { TApp } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual(`@tdsk/domain`)
  return {
    ...actual,
    deriveKey: vi.fn().mockResolvedValue(Buffer.alloc(32, `key`)),
    decryptValue: vi.fn().mockResolvedValue(`sk-test-key`),
  }
})

vi.mock(`@TBE/utils/providers/resolveProviderType`, () => ({
  resolveProviderType: vi.fn().mockReturnValue(`anthropic`),
}))

const mockResolveAgentDeps = vi.fn().mockResolvedValue({
  environment: undefined,
  customFunctions: [],
})
vi.mock(`@TBE/utils/agent/resolveAgentDeps`, () => ({
  resolveAgentDeps: (...args: any[]) => mockResolveAgentDeps(...args),
}))

vi.mock(`@TBE/services/secrets/secretResolver`, () => ({
  SecretResolver: vi.fn().mockImplementation(() => ({
    resolveApiKey: vi.fn().mockResolvedValue(`sk-test-key`),
    resolveHeaders: vi.fn().mockResolvedValue(undefined),
    resolveBodyParams: vi.fn().mockResolvedValue(undefined),
  })),
}))

vi.mock(`@TBE/services/functions/functionExecutor`, () => ({
  FunctionExecutor: {
    execute: vi
      .fn()
      .mockResolvedValue({ duration: 100, output: `result`, success: true }),
  },
}))

/** Helper to create a fake encrypted value that passes the minimum length check */
const fakeEncrypted = () =>
  Buffer.concat([
    Buffer.alloc(12, `iv`),
    Buffer.alloc(16, `tag`),
    Buffer.from(`ciphertext`),
  ]).toString(`base64`)

const buildMockAgent = (overrides?: Record<string, any>) => ({
  id: `agent-1`,
  orgId: `org-1`,
  model: `claude-sonnet-4-20250514`,
  maxTokens: 2048,
  systemPrompt: `You are helpful.`,
  environment: { temperature: 0.7 },
  envVars: {},
  tools: [`web_search`],
  providers: [
    {
      id: `prov-1`,
      secretId: `secret-1`,
      type: `ai`,
      orgId: `org-1`,
      name: `anthropic`,
      brand: `anthropic`,
      options: {},
    },
  ],
  primaryProvider: {
    id: `prov-1`,
    secretId: `secret-1`,
    type: `ai`,
    orgId: `org-1`,
    name: `anthropic`,
    brand: `anthropic`,
    options: {},
  },
  secrets: [
    { encryptedValue: fakeEncrypted(), agentId: `agent-1`, providerId: `prov-1` },
  ],
  resolveModel: (_pid: string, provDefault?: string) =>
    overrides?.model || `claude-sonnet-4-20250514` || provDefault,
  getEffectiveConfig: vi.fn().mockReturnThis(),
  ...overrides,
})

const buildMockDb = (agentOverride?: any) => ({
  services: {
    agent: {
      get: vi.fn().mockResolvedValue({
        data: agentOverride ?? buildMockAgent(),
      }),
    },
    skill: {
      listForAgent: vi.fn().mockResolvedValue({ data: [] }),
    },
    secret: {
      get: vi.fn().mockResolvedValue({
        data: { encryptedValue: fakeEncrypted(), orgId: `org-1` },
      }),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    message: {
      create: vi.fn().mockResolvedValue({ data: {} }),
      listByThread: vi.fn().mockResolvedValue({ data: [] }),
    },
    thread: {
      create: vi.fn().mockResolvedValue({ data: { id: `thread-1` } }),
    },
    function: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      get: vi.fn().mockResolvedValue({ data: null }),
    },
  },
})

const buildMockApp = () =>
  ({
    locals: {
      config: { egress: {} },
      sandbox: undefined,
    },
  }) as unknown as TApp

describe(`resolveAgentConfig`, () => {
  let resolveAgentConfig: typeof import('./resolveAgentConfig').resolveAgentConfig

  beforeEach(async () => {
    vi.clearAllMocks()
    mockResolveAgentDeps.mockResolvedValue({
      environment: undefined,
      customFunctions: [],
    })
    const mod = await import(`./resolveAgentConfig`)
    resolveAgentConfig = mod.resolveAgentConfig
  })

  it(`should throw 404 when agent not found`, async () => {
    const db = buildMockDb()
    ;(db.services.agent.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    })

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp())
    ).rejects.toThrow(`Agent not found`)
  })

  it(`should throw 404 when agent.get returns error`, async () => {
    const db = buildMockDb()
    ;(db.services.agent.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: new Error(`DB error`),
    })

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp())
    ).rejects.toThrow(`Agent not found`)
  })

  it(`should throw 404 when agent has no providers`, async () => {
    const agent = buildMockAgent({ providers: [], primaryProvider: undefined })
    const db = buildMockDb(agent)

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp())
    ).rejects.toThrow(`Agent has no provider configured`)
  })

  it(`should throw 400 when no API key found`, async () => {
    const { SecretResolver } = await import(`@TBE/services/secrets/secretResolver`)
    ;(SecretResolver as any).mockImplementation(() => ({
      resolveApiKey: vi.fn().mockResolvedValue(``),
      resolveHeaders: vi.fn().mockResolvedValue(undefined),
      resolveBodyParams: vi.fn().mockResolvedValue(undefined),
    }))

    const db = buildMockDb()

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp())
    ).rejects.toThrow(`No API key found for agent provider`)

    // Restore
    ;(SecretResolver as any).mockImplementation(() => ({
      resolveApiKey: vi.fn().mockResolvedValue(`sk-test-key`),
      resolveHeaders: vi.fn().mockResolvedValue(undefined),
      resolveBodyParams: vi.fn().mockResolvedValue(undefined),
    }))
  })

  it(`should return resolved config on happy path`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result).toEqual(
      expect.objectContaining({
        orgId: `org-1`,
        agent: expect.objectContaining({ id: `agent-1` }),
        effectiveAgent: expect.objectContaining({ id: `agent-1` }),
        llmConfig: expect.objectContaining({
          apiKey: `sk-test-key`,
          provider: `anthropic`,
        }),
        sandboxConfig: expect.objectContaining({
          provider: `local`,
          timeout: 300000,
        }),
        skills: [],
        customFunctions: [],
        db: expect.objectContaining({
          createMessage: expect.any(Function),
          listMessages: expect.any(Function),
        }),
        onExecuteFunction: expect.any(Function),
      })
    )
  })

  it(`should continue with empty skills array and log error on skills failure`, async () => {
    const { logger } = await import(`@TBE/utils/logger`)
    const db = buildMockDb()
    const skillsError = new Error(`Skills DB error`)
    ;(db.services.skill.listForAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: skillsError,
    })

    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result.skills).toEqual([])
    expect(logger.error).toHaveBeenCalledWith(
      `Failed to load skills for agent agent-1`,
      expect.objectContaining({ error: skillsError })
    )
  })

  it(`should apply overrides for temperature, model, and systemPrompt`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      overrides: {
        temperature: 0.2,
        model: `gpt-4o`,
        systemPrompt: `Be concise.`,
      },
    })

    expect(result.llmConfig.temperature).toBe(0.2)
    expect(result.llmConfig.model).toBe(`gpt-4o`)
    expect(result.llmConfig.systemPrompt).toBe(`Be concise.`)
  })

  it(`should select explicit provider when providerId is given`, async () => {
    const agent = buildMockAgent({
      providers: [
        {
          id: `prov-1`,
          secretId: `secret-1`,
          type: `ai`,
          orgId: `org-1`,
          name: `anthropic`,
          brand: `anthropic`,
          options: {},
        },
        {
          id: `prov-2`,
          secretId: `secret-2`,
          type: `ai`,
          orgId: `org-1`,
          name: `openai`,
          brand: `openai`,
          options: {},
        },
      ],
    })
    const db = buildMockDb(agent)

    const { resolveProviderType } = await import(
      `@TBE/utils/providers/resolveProviderType`
    )
    ;(resolveProviderType as ReturnType<typeof vi.fn>).mockReturnValue(`openai`)

    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      providerId: `prov-2`,
    })

    expect(result.llmConfig.provider).toBe(`openai`)
  })

  it(`should throw 400 when explicit providerId not found on agent`, async () => {
    const db = buildMockDb()

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
        providerId: `nonexistent-provider`,
      })
    ).rejects.toThrow(`Provider nonexistent-provider is not configured for this agent`)
  })

  it(`should call agent.get with sanitize false`, async () => {
    const db = buildMockDb()

    await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(db.services.agent.get).toHaveBeenCalledWith(`agent-1`, { sanitize: false })
  })

  it(`should return onExecuteFunction that handles missing function`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    const execResult = await result.onExecuteFunction(`nonexistent-fn`, {})
    expect(execResult).toEqual({
      duration: 0,
      output: null,
      success: false,
      error: `Function not found`,
    })
  })

  it(`should return onExecuteFunction that delegates to FunctionExecutor for known functions`, async () => {
    const { FunctionExecutor } = await import(`@TBE/services/functions/functionExecutor`)
    const mockFn = { id: `fn-1`, name: `testFunc` }

    mockResolveAgentDeps.mockResolvedValue({
      environment: undefined,
      customFunctions: [mockFn],
    })

    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    const execResult = await result.onExecuteFunction(`fn-1`, { arg: `value` })

    expect(FunctionExecutor.execute).toHaveBeenCalledWith(mockFn, {
      context: { args: { arg: `value` } },
    })
    expect(execResult).toEqual({ duration: 100, output: `result`, success: true })
  })

  it(`should apply project-level config when projectId is provided`, async () => {
    const projectAgent = buildMockAgent({ id: `agent-1-proj` })
    const agent = buildMockAgent({
      getEffectiveConfig: vi.fn().mockReturnValue(projectAgent),
    })
    const db = buildMockDb(agent)

    await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      projectId: `proj-1`,
    })

    expect(agent.getEffectiveConfig).toHaveBeenCalledWith(`proj-1`)
  })

  it(`should include skills from db in the result`, async () => {
    const mockSkills = [
      { id: `skill-1`, name: `Research` },
      { id: `skill-2`, name: `Coding` },
    ]
    const db = buildMockDb()
    ;(db.services.skill.listForAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockSkills,
    })

    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result.skills).toEqual(mockSkills)
  })

  // ── K8s sandbox paths ───────────────────────────────────────────

  it(`should set sandbox podName from environment when provided`, async () => {
    const k8sEnv = { temperature: 0.7, sandboxType: `kubernetes`, podName: `my-pod` }
    const agent = buildMockAgent({ environment: k8sEnv })
    const db = buildMockDb(agent)
    mockResolveAgentDeps.mockResolvedValueOnce({
      environment: k8sEnv,
      customFunctions: [],
    })

    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result.sandboxConfig.provider).toBe(`kubernetes`)
    expect(result.sandboxConfig.options).toEqual({ podName: `my-pod` })
  })

  it(`should start pod via sandbox.startPod when sandboxId provided`, async () => {
    const mockStartPod = vi.fn().mockResolvedValue(`started-pod-name`)
    const k8sEnv = { temperature: 0.7, sandboxType: `kubernetes`, sandboxId: `sb-1` }
    const agent = buildMockAgent({ environment: k8sEnv })
    const db = buildMockDb(agent)
    mockResolveAgentDeps.mockResolvedValueOnce({
      environment: k8sEnv,
      customFunctions: [],
    })
    const app = {
      locals: {
        config: { egress: { allowList: [`*.example.com`] } },
        sandbox: { startPod: mockStartPod },
      },
    } as unknown as TApp

    const result = await resolveAgentConfig(`agent-1`, db as any, app, {
      userId: `user-1`,
      projectId: `proj-1`,
    })

    expect(mockStartPod).toHaveBeenCalledWith({
      userId: `user-1`,
      orgId: `org-1`,
      egressOpts: { allowList: [`*.example.com`] },
      projectId: `proj-1`,
      sandboxId: `sb-1`,
    })
    expect(result.sandboxConfig.provider).toBe(`kubernetes`)
    expect(result.sandboxConfig.options).toEqual({ podName: `started-pod-name` })
  })

  it(`should throw 503 when K8s sandbox has no podName and no sandbox service`, async () => {
    const k8sEnv = { temperature: 0.7, sandboxType: `kubernetes` }
    const agent = buildMockAgent({ environment: k8sEnv })
    const db = buildMockDb(agent)
    mockResolveAgentDeps.mockResolvedValueOnce({
      environment: k8sEnv,
      customFunctions: [],
    })

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp())
    ).rejects.toThrow(`K8s sandbox not available`)
  })
})
