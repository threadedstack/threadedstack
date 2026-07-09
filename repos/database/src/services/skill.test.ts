import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Skill as SkillService } from './skill'

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
    and: vi.fn((...conds) => ({ conds, _tag: `and` })),
    getTableName: vi.fn(() => `skills`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the skills schema
vi.mock(`@TDB/schemas/skills`, () => ({
  skills: {
    id: { name: `id` },
    name: { name: `name` },
    description: { name: `description` },
  },
}))

// Mock the agentSkills schema
vi.mock(`@TDB/schemas/agentSkills`, () => ({
  agentSkills: {
    id: { name: `id` },
    agentId: { name: `agent_id` },
    skillId: { name: `skill_id` },
  },
}))

// Mock the domain model - SkillModel is a data class, not JS constructor collision
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Skill: vi.fn(function MockSkillModel(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Mirrors the chained API used by addAgent/listForAgent/removeAgent.
 */
const createMockDb = () => {
  const insertReturningFn = vi.fn()
  const onConflictDoNothingFn = vi.fn(() => ({ returning: insertReturningFn }))
  const insertValuesFn = vi.fn(() => ({ onConflictDoNothing: onConflictDoNothingFn }))
  const insertFn = vi.fn(() => ({ values: insertValuesFn }))

  const deleteWhereFn = vi.fn()
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  const findMany = vi.fn()

  return {
    db: {
      insert: insertFn,
      delete: deleteFn,
      query: {
        agentSkills: { findMany },
      },
    } as any,
    insertFn,
    insertValuesFn,
    onConflictDoNothingFn,
    insertReturningFn,
    deleteFn,
    deleteWhereFn,
    findMany,
  }
}

describe(`Skill service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: SkillService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const mod = await import(`./skill`)
    service = new mod.Skill({
      db: mocks.db,
      config: {} as any,
    })
  })

  describe(`with`, () => {
    it(`should spread the passed opts`, () => {
      expect(service.with({ foo: `bar` } as any)).toEqual({ foo: `bar` })
    })

    it(`should return an empty object when no opts are passed`, () => {
      expect(service.with()).toEqual({})
    })
  })

  describe(`model`, () => {
    it(`should wrap the row in a SkillModel instance`, () => {
      const row = { id: `sk_1`, name: `mySkill` } as any
      const result = service.model(row)

      expect(result._isModel).toBe(true)
      expect(result.id).toBe(`sk_1`)
    })
  })

  describe(`addAgent`, () => {
    it(`should insert the agent-skill link and return the created row`, async () => {
      const row = { id: `as_1`, agentId: `ag_1`, skillId: `sk_1` }
      mocks.insertReturningFn.mockResolvedValue([row])

      const result = await service.addAgent(`sk_1`, `ag_1`)

      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.insertValuesFn).toHaveBeenCalledWith({
        agentId: `ag_1`,
        skillId: `sk_1`,
      })
      expect(result).toEqual({ data: row, error: null })
    })

    it(`should fall back to the ids when onConflictDoNothing skips the insert`, async () => {
      mocks.insertReturningFn.mockResolvedValue([])

      const result = await service.addAgent(`sk_1`, `ag_1`)

      expect(result).toEqual({
        data: { agentId: `ag_1`, skillId: `sk_1` },
        error: null,
      })
    })

    it(`should return the error without throwing on DB exception`, async () => {
      const dbError = new Error(`insert failed`)
      mocks.insertReturningFn.mockRejectedValue(dbError)

      const result = await service.addAgent(`sk_1`, `ag_1`)

      expect(result).toEqual({ data: null, error: dbError })
    })
  })

  describe(`listForAgent`, () => {
    it(`should return skills mapped from the agent-skills join`, async () => {
      const rows = [
        { skill: { id: `sk_1`, name: `first` } },
        { skill: { id: `sk_2`, name: `second` } },
      ]
      mocks.findMany.mockResolvedValue(rows)

      const result = await service.listForAgent(`ag_1`)

      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { col: { name: `agent_id` }, val: `ag_1`, _tag: `eq` },
        with: { skill: true },
      })
      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[0].id).toBe(`sk_1`)
      expect(result.data[1].id).toBe(`sk_2`)
    })

    it(`should return an empty array and the error on DB exception`, async () => {
      const dbError = new Error(`query failed`)
      mocks.findMany.mockRejectedValue(dbError)

      const result = await service.listForAgent(`ag_1`)

      expect(result).toEqual({ data: [], error: dbError })
    })
  })

  describe(`removeAgent`, () => {
    it(`should delete the agent-skill link`, async () => {
      mocks.deleteWhereFn.mockResolvedValue(undefined)

      const result = await service.removeAgent(`sk_1`, `ag_1`)

      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledWith({
        conds: [
          { col: { name: `agent_id` }, val: `ag_1`, _tag: `eq` },
          { col: { name: `skill_id` }, val: `sk_1`, _tag: `eq` },
        ],
        _tag: `and`,
      })
      expect(result).toEqual({ data: null, error: null })
    })

    it(`should return the error without throwing on DB exception`, async () => {
      const dbError = new Error(`delete failed`)
      mocks.deleteWhereFn.mockRejectedValue(dbError)

      const result = await service.removeAgent(`sk_1`, `ag_1`)

      expect(result).toEqual({ data: null, error: dbError })
    })
  })
})
