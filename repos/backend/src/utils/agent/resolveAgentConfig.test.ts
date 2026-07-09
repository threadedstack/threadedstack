import type { TApp } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { SetupReadyTimeoutMS } from '@TBE/constants/sandbox'

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

const mockResolveAgentDeps = vi.fn().mockResolvedValue({
  environment: undefined,
  customFunctions: [],
})
vi.mock(`@TBE/utils/agent/resolveAgentDeps`, () => ({
  resolveAgentDeps: (...args: any[]) => mockResolveAgentDeps(...args),
}))

const mockResolveSandboxProviderChain = vi.fn().mockResolvedValue({
  sandboxConfig: { runtime: `claude-code` },
  chain: {
    primaryBrand: `anthropic`,
    primaryEnv: { CLAUDE_CODE_OAUTH_TOKEN: `tdsk_ph_primary` },
    placeholders: { tdsk_ph_primary: { secretId: `sc-1` } },
    fallbacks: [],
  },
})
vi.mock(`@TBE/utils/sandbox/resolveSandboxChain`, () => ({
  resolveSandboxProviderChain: (...args: any[]) =>
    mockResolveSandboxProviderChain(...args),
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
    provider: {
      resolveAIBrand: vi
        .fn()
        .mockImplementation((prov: { brand?: string }) => prov.brand || `anthropic`),
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

  it(`should throw 404 when agent.get returns no data`, async () => {
    const db = buildMockDb()
    ;(db.services.agent.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    })

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp())
    ).rejects.toThrow(`Agent not found`)
  })

  it(`should throw 500 when agent.get returns a DB error`, async () => {
    const db = buildMockDb()
    ;(db.services.agent.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: new Error(`DB error`),
    })

    await expect(
      resolveAgentConfig(`agent-1`, db as any, buildMockApp())
    ).rejects.toThrow(`DB error`)
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
      db,
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

  it(`should set sandbox options from environment instanceId when provided`, async () => {
    const k8sEnv = { temperature: 0.7, sandboxType: `kubernetes`, instanceId: `my-pod` }
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
    const mockWaitForPodReady = vi.fn().mockResolvedValue(undefined)
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
        sandbox: { startPod: mockStartPod, waitForPodReady: mockWaitForPodReady },
      },
    } as unknown as TApp

    const result = await resolveAgentConfig(`agent-1`, db as any, app, {
      userId: `user-1`,
      projectId: `proj-1`,
    })

    // The pod default env must come from the pre-resolved PRIMARY provider
    // (deterministic chain), never the legacy last-writer-wins merge
    expect(mockResolveSandboxProviderChain).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ orgId: `org-1`, sandboxId: `sb-1`, projectId: `proj-1` })
    )
    expect(mockStartPod).toHaveBeenCalledWith({
      userId: `user-1`,
      orgId: `org-1`,
      egressOpts: { allowList: [`*.example.com`] },
      projectId: `proj-1`,
      sandboxId: `sb-1`,
      providerChain: {
        primaryEnv: { CLAUDE_CODE_OAUTH_TOKEN: `tdsk_ph_primary` },
        placeholders: { tdsk_ph_primary: { secretId: `sc-1` } },
      },
    })
    expect(mockWaitForPodReady).toHaveBeenCalledWith(`started-pod-name`, {
      cloneCheck: true,
      timeoutMs: SetupReadyTimeoutMS,
    })
    expect(result.sandboxConfig.provider).toBe(`kubernetes`)
    expect(result.sandboxConfig.options).toEqual({ podName: `started-pod-name` })
  })

  it(`should invoke onPodStart after startPod and before the readiness wait`, async () => {
    const mockStartPod = vi.fn().mockResolvedValue(`started-pod-name`)
    const mockWaitForPodReady = vi.fn().mockResolvedValue(undefined)
    const onPodStart = vi.fn()
    const k8sEnv = { temperature: 0.7, sandboxType: `kubernetes`, sandboxId: `sb-1` }
    const agent = buildMockAgent({ environment: k8sEnv })
    const db = buildMockDb(agent)
    mockResolveAgentDeps.mockResolvedValueOnce({
      environment: k8sEnv,
      customFunctions: [],
    })
    const app = {
      locals: {
        config: { egress: {} },
        sandbox: { startPod: mockStartPod, waitForPodReady: mockWaitForPodReady },
      },
    } as unknown as TApp

    await resolveAgentConfig(`agent-1`, db as any, app, {
      userId: `user-1`,
      onPodStart,
    })

    expect(onPodStart).toHaveBeenCalledWith(`started-pod-name`)
    // Ordering: startPod → onPodStart → waitForPodReady
    expect(mockStartPod.mock.invocationCallOrder[0]).toBeLessThan(
      onPodStart.mock.invocationCallOrder[0]
    )
    expect(onPodStart.mock.invocationCallOrder[0]).toBeLessThan(
      mockWaitForPodReady.mock.invocationCallOrder[0]
    )
  })

  it(`should still report the pod via onPodStart when the readiness wait throws`, async () => {
    const mockStartPod = vi.fn().mockResolvedValue(`started-pod-name`)
    const mockWaitForPodReady = vi
      .fn()
      .mockRejectedValue(
        new Error(`Pod started-pod-name will never become ready (state: Failed)`)
      )
    const onPodStart = vi.fn()
    const k8sEnv = { temperature: 0.7, sandboxType: `kubernetes`, sandboxId: `sb-1` }
    const agent = buildMockAgent({ environment: k8sEnv })
    const db = buildMockDb(agent)
    mockResolveAgentDeps.mockResolvedValueOnce({
      environment: k8sEnv,
      customFunctions: [],
    })
    const app = {
      locals: {
        config: { egress: {} },
        sandbox: { startPod: mockStartPod, waitForPodReady: mockWaitForPodReady },
      },
    } as unknown as TApp

    await expect(
      resolveAgentConfig(`agent-1`, db as any, app, { onPodStart })
    ).rejects.toThrow(`will never become ready`)

    // The caller learned the pod name before the failure, so it can reap it
    expect(onPodStart).toHaveBeenCalledWith(`started-pod-name`)
  })

  it(`should throw 503 when K8s sandbox has no instanceId and no sandbox service`, async () => {
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

  // ── Provider failover chain (llmConfigs) ────────────────────────

  const twoProviderAgent = () =>
    buildMockAgent({
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
          options: { model: `gpt-4o` },
        },
      ],
    })

  it(`should return llmConfigs with a single entry equal to llmConfig for a one-provider agent`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result.llmConfigs).toHaveLength(1)
    expect(result.llmConfigs?.[0]).toBe(result.llmConfig)
  })

  it(`should resolve the full priority-ordered chain with the primary first`, async () => {
    const db = buildMockDb(twoProviderAgent())
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result.llmConfigs).toHaveLength(2)
    expect(result.llmConfigs?.[0]).toBe(result.llmConfig)
    expect(result.llmConfigs?.[0].provider).toBe(`anthropic`)
    expect(result.llmConfigs?.[1]).toEqual(
      expect.objectContaining({
        provider: `openai`,
        apiKey: `sk-test-key`,
        model: `claude-sonnet-4-20250514`,
        maxTokens: 2048,
        systemPrompt: `You are helpful.`,
      })
    )
    // Fallbacks share the effective agent params with the primary config
    expect(result.llmConfigs?.[1].temperature).toBe(result.llmConfig.temperature)
  })

  it(`should put the explicitly selected provider first and keep the rest as fallbacks`, async () => {
    const db = buildMockDb(twoProviderAgent())
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      providerId: `prov-2`,
    })

    expect(result.llmConfigs).toHaveLength(2)
    expect(result.llmConfigs?.[0]).toBe(result.llmConfig)
    expect(result.llmConfigs?.[0].provider).toBe(`openai`)
    expect(result.llmConfigs?.[1].provider).toBe(`anthropic`)
  })

  it(`should skip fallback providers whose API key cannot be resolved and warn`, async () => {
    const { SecretResolver } = await import(`@TBE/services/secrets/secretResolver`)
    const { logger } = await import(`@TBE/utils/logger`)
    ;(SecretResolver as any).mockImplementation(() => ({
      resolveApiKey: vi
        .fn()
        .mockImplementation(async (_agent: unknown, provider: { id: string }) =>
          provider.id === `prov-2` ? `` : `sk-test-key`
        ),
      resolveHeaders: vi.fn().mockResolvedValue(undefined),
      resolveBodyParams: vi.fn().mockResolvedValue(undefined),
    }))

    const db = buildMockDb(twoProviderAgent())
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result.llmConfigs).toHaveLength(1)
    expect(result.llmConfigs?.[0]).toBe(result.llmConfig)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`Skipping fallback provider prov-2`)
    )

    // Restore
    ;(SecretResolver as any).mockImplementation(() => ({
      resolveApiKey: vi.fn().mockResolvedValue(`sk-test-key`),
      resolveHeaders: vi.fn().mockResolvedValue(undefined),
      resolveBodyParams: vi.fn().mockResolvedValue(undefined),
    }))
  })

  it(`should not fail the primary path when a fallback provider's resolution throws`, async () => {
    const { SecretResolver } = await import(`@TBE/services/secrets/secretResolver`)
    const { logger } = await import(`@TBE/utils/logger`)
    ;(SecretResolver as any).mockImplementation(() => ({
      resolveApiKey: vi
        .fn()
        .mockImplementation(async (_agent: unknown, provider: { id: string }) => {
          if (provider.id === `prov-2`) throw new Error(`secret DB down`)
          return `sk-test-key`
        }),
      resolveHeaders: vi.fn().mockResolvedValue(undefined),
      resolveBodyParams: vi.fn().mockResolvedValue(undefined),
    }))

    const db = buildMockDb(twoProviderAgent())
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp())

    expect(result.llmConfigs).toHaveLength(1)
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`resolution failed: secret DB down`)
    )

    // Restore
    ;(SecretResolver as any).mockImplementation(() => ({
      resolveApiKey: vi.fn().mockResolvedValue(`sk-test-key`),
      resolveHeaders: vi.fn().mockResolvedValue(undefined),
      resolveBodyParams: vi.fn().mockResolvedValue(undefined),
    }))
  })

  it(`builds invokeProvider when opts.actions is non-empty and project-scoped`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      projectId: `proj-1`,
      actions: [`recordProposal`],
    })

    expect(result.invokeProvider).toBeDefined()
    expect(typeof result.invokeProvider?.invoke).toBe(`function`)
  })

  it(`does not build invokeProvider when opts.actions is empty`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      projectId: `proj-1`,
      actions: [],
    })

    expect(result.invokeProvider).toBeUndefined()
  })

  it(`does not build invokeProvider when opts.actions is absent`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      projectId: `proj-1`,
    })

    expect(result.invokeProvider).toBeUndefined()
  })

  it(`does not build invokeProvider without a project scope, even with actions`, async () => {
    const db = buildMockDb()
    const result = await resolveAgentConfig(`agent-1`, db as any, buildMockApp(), {
      actions: [`recordProposal`],
    })

    expect(result.invokeProvider).toBeUndefined()
  })
})

describe(`createRecordsProvider`, () => {
  let createRecordsProvider: typeof import('./resolveAgentConfig').createRecordsProvider

  const buildRecordDb = () => ({
    services: {
      record: {
        query: vi
          .fn()
          .mockResolvedValue({ data: [{ id: `rec_1`, data: { status: `open` } }] }),
        get: vi.fn().mockResolvedValue({ data: { id: `rec_1`, data: { a: 1 } } }),
        upsert: vi.fn().mockResolvedValue({ data: { id: `rec_new` } }),
        delete: vi.fn().mockResolvedValue({ data: { id: `rec_1` } }),
      },
    },
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import(`./resolveAgentConfig`)
    createRecordsProvider = mod.createRecordsProvider
  })

  it(`query bridges to the record service scoped to the project`, async () => {
    const db = buildRecordDb()
    const provider = createRecordsProvider(db as any, `proj-1`)
    const query = { where: [{ field: `status`, op: `eq` as any, value: `open` }] }
    const result = await provider.query(`tasks`, query)

    expect(db.services.record.query).toHaveBeenCalledWith(`proj-1`, `tasks`, query)
    expect(result).toEqual([{ id: `rec_1`, data: { status: `open` } }])
  })

  it(`query returns [] and warns when the service errors`, async () => {
    const db = buildRecordDb()
    db.services.record.query.mockResolvedValue({ error: { message: `boom` } })
    const provider = createRecordsProvider(db as any, `proj-1`)

    expect(await provider.query(`tasks`, {})).toEqual([])
  })

  it(`get bridges to the record service and maps the row`, async () => {
    const db = buildRecordDb()
    const provider = createRecordsProvider(db as any, `proj-1`)
    const result = await provider.get(`tasks`, `rec_1`)

    expect(db.services.record.get).toHaveBeenCalledWith(`proj-1`, `tasks`, `rec_1`)
    expect(result).toEqual({ id: `rec_1`, data: { a: 1 } })
  })

  it(`get returns null when the record is absent`, async () => {
    const db = buildRecordDb()
    db.services.record.get.mockResolvedValue({})
    const provider = createRecordsProvider(db as any, `proj-1`)

    expect(await provider.get(`tasks`, `nope`)).toBeNull()
  })

  it(`upsert bridges to the record service and returns the id`, async () => {
    const db = buildRecordDb()
    const provider = createRecordsProvider(db as any, `proj-1`)
    const record = { id: `rec_1`, data: { status: `done` } }
    const result = await provider.upsert(`tasks`, record)

    expect(db.services.record.upsert).toHaveBeenCalledWith(`proj-1`, `tasks`, record)
    expect(result).toEqual({ id: `rec_new` })
  })

  it(`upsert throws when the service returns an error`, async () => {
    const db = buildRecordDb()
    db.services.record.upsert.mockResolvedValue({ error: { message: `bad schema` } })
    const provider = createRecordsProvider(db as any, `proj-1`)

    await expect(provider.upsert(`tasks`, { data: {} })).rejects.toThrow(`bad schema`)
  })

  it(`delete reports whether a row was removed`, async () => {
    const db = buildRecordDb()
    const provider = createRecordsProvider(db as any, `proj-1`)

    expect(await provider.delete(`tasks`, `rec_1`)).toEqual({ deleted: true })
    expect(db.services.record.delete).toHaveBeenCalledWith(`proj-1`, `tasks`, `rec_1`)

    db.services.record.delete.mockResolvedValue({})
    expect(await provider.delete(`tasks`, `gone`)).toEqual({ deleted: false })
  })
})

describe(`createInvokeProvider`, () => {
  let createInvokeProvider: typeof import('./resolveAgentConfig').createInvokeProvider

  const buildInvokeDb = (func?: any) => ({
    services: {
      function: {
        list: vi.fn().mockResolvedValue({
          data: func ? [func] : [],
        }),
      },
    },
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import(`./resolveAgentConfig`)
    createInvokeProvider = mod.createInvokeProvider
  })

  it(`invoke routes an allowlisted function through invokeAction to the executor`, async () => {
    const { FunctionExecutor } = await import(`@TBE/services/functions/functionExecutor`)
    const func = { id: `fn-1`, name: `recordProposal`, projectId: `proj-1` }
    const db = buildInvokeDb(func)
    const provider = createInvokeProvider(
      buildMockApp(),
      db as any,
      `proj-1`,
      [`recordProposal`],
      `ag_self`
    )

    const result = await provider.invoke(`recordProposal`, { title: `Ship it` })

    expect(db.services.function.list).toHaveBeenCalledWith({
      where: { projectId: `proj-1`, name: `recordProposal` },
    })
    // The live invoke tool injects the running agent's OWN id as the trusted caller.
    expect(FunctionExecutor.execute).toHaveBeenCalledWith(func, {
      db,
      context: { args: { title: `Ship it` }, caller: { agentId: `ag_self` } },
    })
    expect(result).toEqual({ ok: true, data: `result` })
  })

  it(`invoke rejects a function that is not on the allowlist without executing`, async () => {
    const { FunctionExecutor } = await import(`@TBE/services/functions/functionExecutor`)
    const db = buildInvokeDb({ id: `fn-1`, name: `blocked` })
    const provider = createInvokeProvider(
      buildMockApp(),
      db as any,
      `proj-1`,
      [`allowed`],
      `ag_self`
    )

    const result = await provider.invoke(`blocked`, {})

    expect(result.ok).toBe(false)
    // The Function is resolved (authorship is the second authorization path),
    // but it is neither allowlisted nor authored by this agent — so it never runs.
    expect(db.services.function.list).toHaveBeenCalled()
    expect(FunctionExecutor.execute).not.toHaveBeenCalled()
  })
})
