import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Agent as AgentService } from './agent'

// Mock the logger to avoid config/db initialization side-effects
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock drizzle-orm utilities
vi.mock(`drizzle-orm`, async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>(`drizzle-orm`)
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, _tag: `eq` })),
    and: vi.fn((...args) => args),
    getTableName: vi.fn(() => `agents`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the agents schema
vi.mock(`@TDB/schemas/agents`, () => ({
  agents: {
    id: { name: `id` },
    orgId: { name: `org_id` },
    name: { name: `name` },
    providerId: { name: `provider_id` },
  },
}))

// Mock the agentProjects schema
vi.mock(`@TDB/schemas/agentProjects`, () => ({
  agentProjects: {
    agentId: { name: `agent_id` },
    projectId: { name: `project_id` },
    alias: { name: `alias` },
  },
}))

// Mock the secrets schema
vi.mock(`@TDB/schemas/secrets`, () => ({
  secrets: {
    id: { name: `id` },
    agentId: { name: `agent_id` },
    orgId: { name: `org_id` },
    projectId: { name: `project_id` },
    providerId: { name: `provider_id` },
  },
}))

// Mock the agentProviders schema
vi.mock(`@TDB/schemas/agentProviders`, () => ({
  agentProviders: {
    agentId: { name: `agent_id` },
    providerId: { name: `provider_id` },
    priority: { name: `priority` },
    model: { name: `model` },
  },
}))

// Mock the Agent domain model
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Agent: vi.fn(function MockAgent(data: any) {
      return {
        ...data,
        id: data?.id || `mock-id`,
        secrets: data?.secrets || [],
        _isModel: true,
      }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Mirrors the chained API used by the Agent service including
 * agent_projects junction table operations.
 */
const createMockDb = () => {
  const returningFn = vi.fn()
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
  const onConflictDoNothingFn = vi.fn()
  const valuesFn = vi.fn(() => ({
    returning: returningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
    onConflictDoNothing: onConflictDoNothingFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  const whereReturningFn = vi.fn()
  const whereFn = vi.fn(() => ({ returning: whereReturningFn }))
  const setFn = vi.fn(() => ({ where: whereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  const deleteWhereFn = vi.fn()
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  const apFindFirst = vi.fn()

  const txDeleteWhereFn = vi.fn()
  const txDeleteFn = vi.fn(() => ({ where: txDeleteWhereFn }))
  const txOnConflictFn = vi.fn()
  const txInsertValuesFn = vi.fn(() => ({ onConflictDoUpdate: txOnConflictFn }))
  const txInsertFn = vi.fn(() => ({ values: txInsertValuesFn }))
  const transactionFn = vi.fn(async (cb: any) => {
    await cb({ delete: txDeleteFn, insert: txInsertFn })
  })

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
      transaction: transactionFn,
      query: {
        agents: { findFirst, findMany },
        agentProjects: { findFirst: apFindFirst },
      },
    } as any,
    returningFn,
    valuesFn,
    setFn,
    whereFn,
    whereReturningFn,
    deleteWhereFn,
    findFirst,
    findMany,
    insertFn,
    onConflictDoNothingFn,
    onConflictDoUpdateFn,
    deleteFn,
    apFindFirst,
    transactionFn,
    txDeleteFn,
    txDeleteWhereFn,
    txInsertFn,
    txInsertValuesFn,
    txOnConflictFn,
  }
}

describe(`Agent service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: AgentService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { Agent } = await import(`./agent`)
    service = new Agent({
      db: mocks.db,
      config: {} as any,
    })
  })

  // ---------- with() ----------
  describe(`with`, () => {
    it(`should not crash when opts is undefined (CRIT-05)`, () => {
      const result = service.with(undefined as any)

      expect(result).toBeDefined()
      expect(result.secrets).toBe(true)
      expect(result.providers).toEqual({ with: { provider: true } })
      expect(result.projects).toEqual({ with: { project: true } })
    })

    it(`should always include secrets, providers, and projects`, () => {
      const result = service.with({})

      expect(result.secrets).toBe(true)
      expect(result.providers).toEqual({ with: { provider: true } })
      expect(result.projects).toEqual({ with: { project: true } })
    })

    it(`should preserve custom with options (CRIT-06)`, () => {
      const result = service.with({ org: true })

      expect(result.org).toBe(true)
      expect(result.secrets).toBe(true)
      expect(result.providers).toEqual({ with: { provider: true } })
      expect(result.projects).toEqual({ with: { project: true } })
    })

    it(`should override projects with nested project relation`, () => {
      const result = service.with({ projects: { columns: { id: true } } } as any)

      // projects key is always overridden to include { with: { project: true } }
      expect(result.projects).toEqual({ with: { project: true } })
    })
  })

  // ---------- model() ----------
  describe(`model`, () => {
    it(`should handle data.projects being undefined (SV-08)`, () => {
      const data = { id: `agent-1`, name: `TestAgent` } as any
      const result = service.model(data)

      expect(result).toBeDefined()
      // @ts-ignore
      expect(result._isModel).toBe(true)
    })

    it(`should handle data.projects being null`, () => {
      const data = { id: `agent-1`, name: `TestAgent`, projects: null } as any
      const result = service.model(data)

      expect(result).toBeDefined()
      expect(result._isModel).toBe(true)
    })

    it(`should handle data.projects being an empty array`, () => {
      const data = { id: `agent-1`, name: `TestAgent`, projects: [] } as any
      const result = service.model(data)

      expect(result).toBeDefined()
      expect(result.projects).toEqual([])
    })

    it(`should map project links to link.project`, () => {
      const projA = { id: `p1`, name: `ProjectA` }
      const projB = { id: `p2`, name: `ProjectB` }
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [
          { agentId: `agent-1`, projectId: `p1`, project: projA },
          { agentId: `agent-1`, projectId: `p2`, project: projB },
        ],
      } as any

      const result = service.model(data)

      expect(result.projects).toEqual([projA, projB])
    })

    it(`should sanitize secrets by default`, () => {
      const mockSanitize = vi.fn(() => ({ id: `s1`, value: `****` }))
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [{ id: `s1`, value: `secret-val`, sanitize: mockSanitize }],
      } as any

      // The Agent mock returns data as-is, so secrets will be the input secrets
      // The model() method then calls secret.sanitize() on each secret
      const result = service.model(data)

      expect(mockSanitize).toHaveBeenCalledOnce()
      expect(result.secrets).toEqual([{ id: `s1`, value: `****` }])
    })

    it(`should skip sanitization when sanitize: false`, () => {
      const mockSanitize = vi.fn(() => ({ id: `s1`, value: `****` }))
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [{ id: `s1`, value: `secret-val`, sanitize: mockSanitize }],
      } as any

      const result = service.model(data, { sanitize: false })

      expect(mockSanitize).not.toHaveBeenCalled()
      expect(result.secrets[0].value).toBe(`secret-val`)
    })

    it(`should not fail when secrets is empty and sanitize is true`, () => {
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [],
      } as any

      const result = service.model(data, { sanitize: true })

      expect(result.secrets).toEqual([])
    })

    it(`should handle providers being undefined`, () => {
      const data = { id: `agent-1`, name: `TestAgent`, projects: [] } as any
      const result = service.model(data)

      expect(result).toBeDefined()
      expect(result.providerLinks).toEqual([])
    })

    it(`should map provider junction records to providerLinks`, () => {
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        providers: [
          {
            agentId: `agent-1`,
            providerId: `prov-1`,
            priority: 0,
            model: `claude-3`,
            provider: { id: `prov-1`, name: `Anthropic` },
          },
          {
            agentId: `agent-1`,
            providerId: `prov-2`,
            priority: 1,
            model: null,
            provider: { id: `prov-2`, name: `OpenAI` },
          },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks).toHaveLength(2)
      expect(result.providerLinks[0]).toMatchObject({
        provider: { id: `prov-1`, name: `Anthropic` },
        model: `claude-3`,
        priority: 0,
      })
      expect(result.providerLinks[1]).toMatchObject({
        provider: { id: `prov-2`, name: `OpenAI` },
        model: null,
        priority: 1,
      })
    })

    it(`should sort providers by priority`, () => {
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        providers: [
          {
            agentId: `agent-1`,
            providerId: `prov-2`,
            priority: 2,
            model: null,
            provider: { id: `prov-2`, name: `OpenAI` },
          },
          {
            agentId: `agent-1`,
            providerId: `prov-1`,
            priority: 0,
            model: `claude-3`,
            provider: { id: `prov-1`, name: `Anthropic` },
          },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks).toHaveLength(2)
      expect(result.providerLinks[0].priority).toBe(0)
      expect(result.providerLinks[0].provider.id).toBe(`prov-1`)
      expect(result.providerLinks[1].priority).toBe(2)
      expect(result.providerLinks[1].provider.id).toBe(`prov-2`)
    })
  })

  // ---------- get() ----------
  describe(`get`, () => {
    it(`should call super.get with this.with() and return model data`, async () => {
      const record = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [],
      }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.get(`agent-1`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should return error when not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.get(`missing-id`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should skip sanitization when sanitize: false is passed`, async () => {
      const mockSanitize: any = vi.fn(function () {
        return { id: `s1`, value: `****`, sanitize: mockSanitize }
      })
      const record = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [{ id: `s1`, value: `real`, sanitize: mockSanitize }],
      }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.get(`agent-1`, { sanitize: false })

      expect(result.data).toBeDefined()
      // Single model() call with sanitize: false skips sanitization entirely
      expect(mockSanitize).not.toHaveBeenCalled()
    })

    it(`should sanitize secrets by default on get`, async () => {
      const mockSanitize: any = vi.fn(function () {
        return { id: `s1`, value: `****`, sanitize: mockSanitize }
      })
      const record = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [{ id: `s1`, value: `real`, sanitize: mockSanitize }],
      }
      mocks.findFirst.mockResolvedValue(record)

      await service.get(`agent-1`)

      // Single model() call sanitizes secrets by default
      expect(mockSanitize).toHaveBeenCalledTimes(1)
    })

    it(`should not crash when opts is undefined`, async () => {
      const record = { id: `agent-1`, name: `TestAgent`, projects: [], secrets: [] }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.get(`agent-1`)

      expect(result.data).toBeDefined()
    })
  })

  // ---------- by() ----------
  describe(`by`, () => {
    it(`should handle object argument by({ orgId: 'abc' }) (CRIT-01)`, async () => {
      const record = {
        id: `agent-1`,
        orgId: `abc`,
        name: `TestAgent`,
        projects: [],
        secrets: [],
      }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.by({ orgId: `abc` }, { sanitize: true })

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should handle string arguments by('orgId', 'abc')`, async () => {
      const record = {
        id: `agent-1`,
        orgId: `abc`,
        name: `TestAgent`,
        projects: [],
        secrets: [],
      }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.by(`orgId`, `abc`, { sanitize: true })

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should return error when not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.by({ orgId: `abc` }, { sanitize: true })

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`not found`)
    })

    it(`should not call model when normalizedOpts is falsy`, async () => {
      const record = {
        id: `agent-1`,
        orgId: `abc`,
        name: `TestAgent`,
        projects: [],
        secrets: [],
      }
      mocks.findFirst.mockResolvedValue(record)

      // When passing string args without opts, normalizedOpts is undefined
      // so the model() call is skipped (if result.data && normalizedOpts)
      const result = await service.by(`orgId`, `abc`)

      expect(result.data).toBeDefined()
      // Data should still come from super.by which calls base model()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })
  })

  // ---------- list() ----------
  describe(`list`, () => {
    it(`should return array of agent models`, async () => {
      const records = [
        { id: `agent-1`, name: `A`, projects: [], secrets: [] },
        { id: `agent-2`, name: `B`, projects: [], secrets: [] },
      ]
      mocks.findMany.mockResolvedValue(records)

      const result = await service.list()

      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[1]._isModel).toBe(true)
    })

    it(`should return empty array when nothing found`, async () => {
      mocks.findMany.mockResolvedValue([])

      const result = await service.list()

      expect(result.data).toEqual([])
    })

    it(`should sanitize secrets by default on list`, async () => {
      const mockSanitize: any = vi.fn(function () {
        return { id: `s1`, value: `****`, sanitize: mockSanitize }
      })
      const records = [
        {
          id: `agent-1`,
          name: `A`,
          projects: [],
          secrets: [{ id: `s1`, value: `real`, sanitize: mockSanitize }],
        },
      ]
      mocks.findMany.mockResolvedValue(records)

      await service.list()

      // Single model() call sanitizes secrets by default
      expect(mockSanitize).toHaveBeenCalledTimes(1)
    })

    it(`should skip sanitization when sanitize: false on list`, async () => {
      const mockSanitize: any = vi.fn(function () {
        return { id: `s1`, value: `****`, sanitize: mockSanitize }
      })
      const records = [
        {
          id: `agent-1`,
          name: `A`,
          projects: [],
          secrets: [{ id: `s1`, value: `real`, sanitize: mockSanitize }],
        },
      ]
      mocks.findMany.mockResolvedValue(records)

      await service.list({ sanitize: false })

      // Single model() call with sanitize: false skips sanitization entirely
      expect(mockSanitize).not.toHaveBeenCalled()
    })
  })

  // ---------- create() ----------
  describe(`create`, () => {
    it(`should create agent without projects`, async () => {
      const record = { id: `agent-1`, name: `TestAgent` }
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.insertFn).toHaveBeenCalledOnce()
    })

    it(`should create agent with projects (calls #relations)`, async () => {
      const record = { id: `agent-1`, name: `TestAgent` }
      const fullRecord = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [
          { agentId: `agent-1`, projectId: `p1`, project: { id: `p1`, name: `Proj` } },
        ],
        secrets: [],
      }

      // First call: super.create returning
      mocks.returningFn.mockResolvedValueOnce([record])
      // #relations: insert into agentProjects
      mocks.onConflictDoNothingFn.mockResolvedValue(undefined)
      // Second call: this.get() -> findFirst for re-fetching
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
        projects: [{ id: `p1`, name: `Proj` }],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      // insert should be called for agent creation and for agentProjects relation
      expect(mocks.insertFn).toHaveBeenCalled()
    })

    it(`should skip #relations when projects is empty`, async () => {
      const record = { id: `agent-1`, name: `TestAgent` }
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
        projects: [],
      } as any)

      // Only called once for the agent insert, not for agentProjects
      expect(mocks.insertFn).toHaveBeenCalledOnce()
    })

    it(`should return error on db exception`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })

    it(`should call #relations with providerInputs when provided`, async () => {
      const record = { id: `agent-1`, name: `TestAgent` }
      const fullRecord = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        providers: [
          {
            agentId: `agent-1`,
            providerId: `prov-1`,
            priority: 0,
            model: null,
            provider: { id: `prov-1`, name: `Anthropic` },
          },
        ],
        secrets: [],
      }

      // super.create returning
      mocks.returningFn.mockResolvedValueOnce([record])
      // this.get() -> findFirst for re-fetching
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
        providerInputs: [{ id: `prov-1` }],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      // transaction should be called for providerInputs (delete + insert within tx)
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      expect(mocks.txInsertFn).toHaveBeenCalledOnce()
      expect(mocks.txInsertValuesFn).toHaveBeenCalledWith([
        { priority: 0, agentId: `agent-1`, providerId: `prov-1`, model: null },
      ])
    })

    it(`should skip provider relations when providerInputs not provided`, async () => {
      const record = { id: `agent-1`, name: `TestAgent` }
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
      } as any)

      // transaction should NOT be called when no providerInputs
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should create agent with secretIds (reassigns secrets to agent)`, async () => {
      const record = { id: `agent-1`, name: `TestAgent` }
      const fullRecord = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [],
        secrets: [{ id: `s1`, name: `MySecret`, sanitize: vi.fn(() => ({ id: `s1` })) }],
      }

      // super.create returning
      mocks.returningFn.mockResolvedValueOnce([record])
      // #relations: update secrets (set agentId)
      mocks.whereReturningFn.mockResolvedValue(undefined)
      // this.get() -> findFirst
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.create({
        name: `TestAgent`,
        orgId: `org-1`,
        providerId: `prov-1`,
        secretIds: [`s1`],
      } as any)

      expect(result.data).toBeDefined()
      expect(mocks.insertFn).toHaveBeenCalled()
    })
  })

  // ---------- update() ----------
  describe(`update`, () => {
    it(`should return error when agent.id is missing`, async () => {
      const result = await service.update({ name: `NoId` } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Agent ID is required for update`)
      expect(result.data).toBeNull()
    })

    it(`should update agent data without projects`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.update({ id: `agent-1`, name: `Updated` } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it(`should delete old project relations and re-create on update with projects`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      const fullRecord = {
        id: `agent-1`,
        name: `Updated`,
        projects: [
          { agentId: `agent-1`, projectId: `p2`, project: { id: `p2`, name: `NewProj` } },
        ],
        secrets: [],
      }

      // super.update returning
      mocks.whereReturningFn.mockResolvedValue([record])
      // db.delete(agentProjects).where(...)
      mocks.deleteWhereFn.mockResolvedValue(undefined)
      // #relations: insert into agentProjects
      mocks.onConflictDoNothingFn.mockResolvedValue(undefined)
      // this.get() -> findFirst
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `agent-1`,
        name: `Updated`,
        projects: [{ id: `p2`, name: `NewProj` }],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      // db.delete should be called for clearing old agentProjects
      expect(mocks.deleteFn).toHaveBeenCalled()
    })

    it(`should detach old secrets and re-attach new ones on update with secretIds`, async () => {
      const record = { id: `agent-1`, name: `Updated`, orgId: `org-1` }
      const fullRecord = {
        id: `agent-1`,
        name: `Updated`,
        orgId: `org-1`,
        projects: [],
        secrets: [{ id: `s2`, name: `NewSecret`, sanitize: vi.fn(() => ({ id: `s2` })) }],
      }

      // super.update returning
      mocks.whereReturningFn.mockResolvedValue([record])
      // this.get() -> findFirst
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `agent-1`,
        name: `Updated`,
        secretIds: [`s2`],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(mocks.setFn).toHaveBeenCalled()
    })

    it(`should detach all secrets when secretIds is empty array`, async () => {
      const record = { id: `agent-1`, name: `Updated`, orgId: `org-1` }
      const fullRecord = {
        id: `agent-1`,
        name: `Updated`,
        orgId: `org-1`,
        projects: [],
        secrets: [],
      }

      mocks.whereReturningFn.mockResolvedValue([record])
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `agent-1`,
        name: `Updated`,
        secretIds: [],
      } as any)

      expect(result.data).toBeDefined()
      // update called for agent + detach (no attach since secretIds is empty)
      expect(mocks.setFn).toHaveBeenCalled()
    })

    it(`should not touch secrets when secretIds is undefined`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      await service.update({ id: `agent-1`, name: `Updated` } as any)

      // Only one set call for the agent update itself
      expect(mocks.setFn).toHaveBeenCalledOnce()
    })

    it(`should replace providers when providerInputs is provided`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      const fullRecord = {
        id: `agent-1`,
        name: `Updated`,
        projects: [],
        providers: [
          {
            agentId: `agent-1`,
            providerId: `prov-new`,
            priority: 0,
            model: null,
            provider: { id: `prov-new`, name: `NewProv` },
          },
        ],
        secrets: [],
      }

      // super.update returning
      mocks.whereReturningFn.mockResolvedValue([record])
      // this.get() -> findFirst
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `agent-1`,
        name: `Updated`,
        providerInputs: [{ id: `prov-new` }],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      // Transaction handles diff-based upsert (delete NOT IN list + insert onConflictDoUpdate)
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      expect(mocks.txInsertFn).toHaveBeenCalledOnce()
      expect(mocks.txInsertValuesFn).toHaveBeenCalledWith([
        { priority: 0, agentId: `agent-1`, providerId: `prov-new`, model: null },
      ])
    })

    it(`should clear all providers when providerInputs is empty array`, async () => {
      const record = { id: `agent-1`, name: `Updated` }
      const fullRecord = {
        id: `agent-1`,
        name: `Updated`,
        projects: [],
        providers: [],
        secrets: [],
      }

      // super.update returning
      mocks.whereReturningFn.mockResolvedValue([record])
      // this.get() -> findFirst
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `agent-1`,
        name: `Updated`,
        providerInputs: [],
      } as any)

      expect(result.data).toBeDefined()
      // Transaction is called — #upsertProviders runs even for empty arrays
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      // tx.delete called to clear all providers
      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      // tx.insert NOT called because empty inputs -> no rows to insert
      expect(mocks.txInsertFn).not.toHaveBeenCalled()
    })
  })

  // ---------- upsert() ----------
  describe(`upsert`, () => {
    it(`should upsert agent without projects`, async () => {
      const record = { id: `agent-1`, name: `Upserted` }
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.upsert({ id: `agent-1`, name: `Upserted` } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })

    it(`should upsert agent with projects (calls #relations)`, async () => {
      const record = { id: `agent-1`, name: `Upserted` }
      const fullRecord = {
        id: `agent-1`,
        name: `Upserted`,
        projects: [
          { agentId: `agent-1`, projectId: `p1`, project: { id: `p1`, name: `Proj` } },
        ],
        secrets: [],
      }

      // super.upsert returning
      mocks.returningFn.mockResolvedValueOnce([record])
      // #relations
      mocks.onConflictDoNothingFn.mockResolvedValue(undefined)
      // this.get()
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.upsert({
        id: `agent-1`,
        name: `Upserted`,
        projects: [{ id: `p1`, name: `Proj` }],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
    })
  })

  // ---------- addProject() ----------
  describe(`addProject`, () => {
    it(`should insert into agentProjects and return data`, async () => {
      const relation = {
        id: `rel-1`,
        agentId: `agent-1`,
        projectId: `p1`,
        alias: `MyAlias`,
      }
      mocks.returningFn.mockResolvedValue([relation])

      const result = await service.addProject(`agent-1`, `p1`, `MyAlias`)

      expect(result.data).toEqual(relation)
      expect(result.error).toBeNull()
      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.valuesFn).toHaveBeenCalledWith({
        alias: `MyAlias`,
        agentId: `agent-1`,
        projectId: `p1`,
      })
    })

    it(`should insert without alias`, async () => {
      const relation = {
        id: `rel-1`,
        agentId: `agent-1`,
        projectId: `p1`,
        alias: undefined,
      }
      mocks.returningFn.mockResolvedValue([relation])

      const result = await service.addProject(`agent-1`, `p1`)

      expect(result.data).toEqual(relation)
      expect(result.error).toBeNull()
      expect(mocks.valuesFn).toHaveBeenCalledWith({
        alias: undefined,
        agentId: `agent-1`,
        projectId: `p1`,
      })
    })
  })

  // ---------- removeProject() ----------
  describe(`removeProject`, () => {
    it(`should delete from agentProjects matching agent and project`, async () => {
      mocks.deleteWhereFn.mockResolvedValue(undefined)

      const result = await service.removeProject(`agent-1`, `p1`)

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
    })
  })

  // ---------- upsertProjectConfig() ----------
  describe(`upsertProjectConfig`, () => {
    it(`should update agentProjects row with config overrides`, async () => {
      const row = {
        agentId: `agent-1`,
        projectId: `p1`,
        model: `gpt-4`,
        maxTokens: 2048,
        updatedAt: new Date(),
      }
      mocks.whereReturningFn.mockResolvedValue([row])

      const result = await service.upsertProjectConfig(`agent-1`, `p1`, {
        model: `gpt-4`,
        maxTokens: 2048,
      })

      expect(result.data).toEqual(row)
      expect(result.error).toBeUndefined()
      expect(mocks.setFn).toHaveBeenCalledOnce()
      expect(mocks.whereFn).toHaveBeenCalledOnce()
    })

    it(`should return error when agent is not linked to project`, async () => {
      mocks.whereReturningFn.mockResolvedValue([])

      const result = await service.upsertProjectConfig(`agent-1`, `p-missing`, {
        model: `gpt-4`,
      })

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`Agent is not linked to this project`)
      expect(result.data).toBeUndefined()
    })

    it(`should handle db errors gracefully`, async () => {
      mocks.whereReturningFn.mockRejectedValue(new Error(`DB update failed`))

      const result = await service.upsertProjectConfig(`agent-1`, `p1`, {
        model: `gpt-4`,
      })

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB update failed`)
    })
  })

  // ---------- getProjectConfig() ----------
  describe(`getProjectConfig`, () => {
    it(`should return project config for linked agent+project`, async () => {
      const row = {
        agentId: `agent-1`,
        projectId: `p1`,
        alias: `MyAlias`,
        model: `gpt-4`,
        maxTokens: 4096,
        systemPrompt: `You are helpful.`,
        tools: [`tool-a`],
        functionIds: [`fn-1`],
        envVars: { KEY: `val` },
        environment: { sandbox: true },
        enabled: true,
      }
      mocks.apFindFirst.mockResolvedValue(row)

      const result = await service.getProjectConfig(`agent-1`, `p1`)

      expect(result.data).toEqual({
        agentId: `agent-1`,
        projectId: `p1`,
        alias: `MyAlias`,
        model: `gpt-4`,
        maxTokens: 4096,
        systemPrompt: `You are helpful.`,
        tools: [`tool-a`],
        functionIds: [`fn-1`],
        envVars: { KEY: `val` },
        environment: { sandbox: true },
        enabled: true,
      })
      expect(result.error).toBeUndefined()
      expect(mocks.apFindFirst).toHaveBeenCalledOnce()
    })

    it(`should return error when agent is not linked to project`, async () => {
      mocks.apFindFirst.mockResolvedValue(undefined)

      const result = await service.getProjectConfig(`agent-1`, `p-missing`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`Agent is not linked to this project`)
      expect(result.data).toBeUndefined()
    })

    it(`should default enabled to true when not set`, async () => {
      const row = {
        agentId: `agent-1`,
        projectId: `p1`,
        alias: null,
        model: null,
        maxTokens: null,
        systemPrompt: null,
        tools: null,
        functionIds: null,
        envVars: null,
        environment: null,
        enabled: undefined,
      }
      mocks.apFindFirst.mockResolvedValue(row)

      const result = await service.getProjectConfig(`agent-1`, `p1`)

      expect(result.data).toBeDefined()
      expect(result.data!.enabled).toBe(true)
    })

    it(`should handle db errors gracefully`, async () => {
      mocks.apFindFirst.mockRejectedValue(new Error(`DB query failed`))

      const result = await service.getProjectConfig(`agent-1`, `p1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB query failed`)
    })
  })

  // ---------- model() projectConfigs extraction ----------
  describe(`model projectConfigs extraction`, () => {
    it(`should extract projectConfigs from junction data`, () => {
      const projA = { id: `p1`, name: `ProjectA` }
      const projB = { id: `p2`, name: `ProjectB` }
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [
          { agentId: `agent-1`, projectId: `p1`, project: projA, alias: `AliasA` },
          { agentId: `agent-1`, projectId: `p2`, project: projB, alias: `AliasB` },
        ],
        secrets: [],
      } as any

      const result = service.model(data)

      expect(result.projectConfigs).toBeDefined()
      expect(result.projectConfigs).toHaveLength(2)
      expect(result.projectConfigs[0].projectId).toBe(`p1`)
      expect(result.projectConfigs[0].agentId).toBe(`agent-1`)
      expect(result.projectConfigs[0].alias).toBe(`AliasA`)
      expect(result.projectConfigs[1].projectId).toBe(`p2`)
      expect(result.projectConfigs[1].alias).toBe(`AliasB`)
    })

    it(`should handle projects with override fields`, () => {
      const proj = { id: `p1`, name: `Proj` }
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [
          {
            agentId: `agent-1`,
            projectId: `p1`,
            project: proj,
            alias: `Alias`,
            model: `gpt-4`,
            maxTokens: 2048,
            systemPrompt: `Be concise.`,
            tools: [`search`, `code`],
            functionIds: [`fn-1`, `fn-2`],
            envVars: { API_URL: `https://example.com` },
            environment: { debug: true },
            enabled: false,
          },
        ],
        secrets: [],
      } as any

      const result = service.model(data)

      expect(result.projectConfigs).toHaveLength(1)
      const config = result.projectConfigs[0]
      expect(config.model).toBe(`gpt-4`)
      expect(config.maxTokens).toBe(2048)
      expect(config.systemPrompt).toBe(`Be concise.`)
      expect(config.tools).toEqual([`search`, `code`])
      expect(config.functionIds).toEqual([`fn-1`, `fn-2`])
      expect(config.envVars).toEqual({ API_URL: `https://example.com` })
      expect(config.environment).toEqual({ debug: true })
      expect(config.enabled).toBe(false)
    })

    it(`should default override fields to null/true when not present`, () => {
      const proj = { id: `p1`, name: `Proj` }
      const data = {
        id: `agent-1`,
        name: `TestAgent`,
        projects: [{ agentId: `agent-1`, projectId: `p1`, project: proj }],
        secrets: [],
      } as any

      const result = service.model(data)

      expect(result.projectConfigs).toHaveLength(1)
      const config = result.projectConfigs[0]
      expect(config.alias).toBeNull()
      expect(config.model).toBeNull()
      expect(config.maxTokens).toBeNull()
      expect(config.systemPrompt).toBeNull()
      expect(config.tools).toBeNull()
      expect(config.functionIds).toBeNull()
      expect(config.envVars).toBeNull()
      expect(config.environment).toBeNull()
      expect(config.enabled).toBe(true)
    })
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should set sanitize to true by default`, () => {
      expect(service.sanitize).toBe(true)
    })
  })
})
