import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Agent, Function } from '@tdsk/domain'
import type { TDatabase } from '@tdsk/database'
import type { SecretResolver } from '@TBE/services/secrets/secretResolver'

import { resolveAgentDeps } from './resolveAgentDeps'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Re-import after mock so we can assert on calls
import { logger } from '@TBE/utils/logger'

// ── Helpers ──────────────────────────────────────────────────────────

const mockDb = {
  services: {
    secret: { get: vi.fn() },
    function: { getByIds: vi.fn() },
  },
} as unknown as TDatabase

const mockSecrets = {
  decrypt: vi.fn(),
} as unknown as SecretResolver

const buildAgent = (overrides: Partial<Agent> = {}) =>
  ({
    orgId: `org-1`,
    environment: undefined,
    getProjectConfig: vi.fn().mockReturnValue(null),
    ...overrides,
  }) as unknown as Agent

// ── resolveAgentDeps ─────────────────────────────────────────────────

describe(`resolveAgentDeps`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should resolve webProvider secret and custom functions when all present`, async () => {
    const agent = buildAgent({
      environment: {
        webProvider: { secretId: `secret-1` },
      } as Agent[`environment`],
    })
    ;(agent.getProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      functionIds: [`fn-1`, `fn-2`],
    })

    const wpSecret = { encryptedValue: `encrypted-data`, orgId: `org-1` }
    ;(mockDb.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: wpSecret,
    })
    ;(mockSecrets.decrypt as ReturnType<typeof vi.fn>).mockResolvedValue(
      `decrypted-api-key`
    )

    const mockFunctions = [
      { id: `fn-1`, name: `myFunc1` },
      { id: `fn-2`, name: `myFunc2` },
    ] as unknown as Function[]
    ;(mockDb.services.function.getByIds as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockFunctions,
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets, `project-1`)

    expect(result.environment?.webProvider?.apiKey).toBe(`decrypted-api-key`)
    expect(result.customFunctions).toEqual(mockFunctions)
    expect(mockDb.services.secret.get).toHaveBeenCalledWith(`secret-1`)
    expect(mockSecrets.decrypt).toHaveBeenCalledWith(wpSecret, `org-1`)
    expect(agent.getProjectConfig).toHaveBeenCalledWith(`project-1`)
    expect(mockDb.services.function.getByIds).toHaveBeenCalledWith([`fn-1`, `fn-2`])
  })

  it(`should return undefined environment and empty customFunctions when agent has no environment`, async () => {
    const agent = buildAgent({ environment: undefined })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets)

    expect(result.environment).toBeUndefined()
    expect(result.customFunctions).toEqual([])
    expect(mockDb.services.secret.get).not.toHaveBeenCalled()
    expect(mockSecrets.decrypt).not.toHaveBeenCalled()
  })

  it(`should skip decryption and return environment as-is when webProvider has no secretId`, async () => {
    const agent = buildAgent({
      environment: {
        webProvider: { type: `jina` },
      } as Agent[`environment`],
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets)

    expect(result.environment?.webProvider?.type).toBe(`jina`)
    expect(result.environment?.webProvider?.apiKey).toBeUndefined()
    expect(mockDb.services.secret.get).not.toHaveBeenCalled()
    expect(mockSecrets.decrypt).not.toHaveBeenCalled()
  })

  it(`should log warning and continue with original environment when secret is not found`, async () => {
    const agent = buildAgent({
      environment: {
        webProvider: { secretId: `secret-missing` },
      } as Agent[`environment`],
    })

    ;(mockDb.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets)

    expect(logger.warn).toHaveBeenCalledWith(
      `WebProvider secret not found or has no encrypted value`,
      expect.objectContaining({ secretId: `secret-missing` })
    )
    expect(result.environment?.webProvider?.apiKey).toBeUndefined()
    expect(mockSecrets.decrypt).not.toHaveBeenCalled()
  })

  it(`should log warning and continue with original environment when secret has no encryptedValue`, async () => {
    const agent = buildAgent({
      environment: {
        webProvider: { secretId: `secret-empty` },
      } as Agent[`environment`],
    })

    ;(mockDb.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { id: `secret-empty`, encryptedValue: null },
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets)

    expect(logger.warn).toHaveBeenCalledWith(
      `WebProvider secret not found or has no encrypted value`,
      expect.objectContaining({ secretId: `secret-empty` })
    )
    expect(result.environment?.webProvider?.apiKey).toBeUndefined()
    expect(mockSecrets.decrypt).not.toHaveBeenCalled()
  })

  it(`should log warning and continue with original environment when decryption returns null`, async () => {
    const agent = buildAgent({
      environment: {
        webProvider: { secretId: `secret-1` },
      } as Agent[`environment`],
    })

    ;(mockDb.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { encryptedValue: `encrypted-data`, orgId: `org-1` },
    })
    ;(mockSecrets.decrypt as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets)

    expect(logger.warn).toHaveBeenCalledWith(
      `Failed to decrypt webProvider secret`,
      expect.objectContaining({ secretId: `secret-1` })
    )
    expect(result.environment?.webProvider?.apiKey).toBeUndefined()
  })

  it(`should log warning and continue with original environment when decryption throws`, async () => {
    const agent = buildAgent({
      environment: {
        webProvider: { secretId: `secret-1` },
      } as Agent[`environment`],
    })

    ;(mockDb.services.secret.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { encryptedValue: `encrypted-data`, orgId: `org-1` },
    })
    ;(mockSecrets.decrypt as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error(`decrypt failed`)
    )

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets)

    expect(logger.warn).toHaveBeenCalledWith(
      `Failed to resolve webProvider API key`,
      expect.objectContaining({
        secretId: `secret-1`,
        error: `decrypt failed`,
      })
    )
    expect(result.environment?.webProvider?.apiKey).toBeUndefined()
    expect(result.customFunctions).toEqual([])
  })

  it(`should return empty customFunctions when functionIds is empty`, async () => {
    const agent = buildAgent()
    ;(agent.getProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      functionIds: [],
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets, `project-1`)

    expect(result.customFunctions).toEqual([])
    expect(mockDb.services.function.getByIds).not.toHaveBeenCalled()
  })

  it(`should return empty customFunctions when no projectId is provided`, async () => {
    const agent = buildAgent()

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets)

    expect(result.customFunctions).toEqual([])
    expect(agent.getProjectConfig).not.toHaveBeenCalled()
    expect(mockDb.services.function.getByIds).not.toHaveBeenCalled()
  })

  it(`should log warning and return empty customFunctions when getByIds returns error`, async () => {
    const agent = buildAgent()
    ;(agent.getProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      functionIds: [`fn-1`],
    })

    ;(mockDb.services.function.getByIds as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: new Error(`DB query failed`),
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets, `project-1`)

    expect(logger.warn).toHaveBeenCalledWith(
      `Failed to load custom functions`,
      expect.objectContaining({
        functionIds: [`fn-1`],
        error: `DB query failed`,
      })
    )
    expect(result.customFunctions).toEqual([])
  })

  it(`should return empty customFunctions when getProjectConfig returns no functionIds`, async () => {
    const agent = buildAgent()
    ;(agent.getProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({})

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets, `project-1`)

    expect(result.customFunctions).toEqual([])
    expect(mockDb.services.function.getByIds).not.toHaveBeenCalled()
  })

  it(`should return custom functions from getByIds data`, async () => {
    const agent = buildAgent()
    ;(agent.getProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      functionIds: [`fn-a`, `fn-b`, `fn-c`],
    })

    const mockFunctions = [
      { id: `fn-a`, name: `funcA` },
      { id: `fn-b`, name: `funcB` },
      { id: `fn-c`, name: `funcC` },
    ] as unknown as Function[]
    ;(mockDb.services.function.getByIds as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockFunctions,
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets, `project-1`)

    expect(result.customFunctions).toEqual(mockFunctions)
    expect(result.customFunctions).toHaveLength(3)
    expect(mockDb.services.function.getByIds).toHaveBeenCalledWith([
      `fn-a`,
      `fn-b`,
      `fn-c`,
    ])
  })

  it(`should log warning when some custom functions are not found`, async () => {
    const agent = buildAgent()
    ;(agent.getProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      functionIds: [`fn-a`, `fn-b`, `fn-c`],
    })

    const mockFunctions = [{ id: `fn-a`, name: `funcA` }] as unknown as Function[]
    ;(mockDb.services.function.getByIds as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockFunctions,
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets, `project-1`)

    expect(result.customFunctions).toEqual(mockFunctions)
    expect(result.customFunctions).toHaveLength(1)
    expect(logger.warn).toHaveBeenCalledWith(`Some custom functions not found`, {
      missingIds: [`fn-b`, `fn-c`],
    })
  })

  it(`should not log warning when all custom functions are found`, async () => {
    const agent = buildAgent()
    ;(agent.getProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      functionIds: [`fn-a`, `fn-b`],
    })

    const mockFunctions = [
      { id: `fn-a`, name: `funcA` },
      { id: `fn-b`, name: `funcB` },
    ] as unknown as Function[]
    ;(mockDb.services.function.getByIds as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: mockFunctions,
    })

    const result = await resolveAgentDeps(agent, mockDb, mockSecrets, `project-1`)

    expect(result.customFunctions).toEqual(mockFunctions)
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
