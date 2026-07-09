import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Project as ProjectService } from './project'

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
    notInArray: vi.fn((col, vals) => ({ col, vals, _tag: `notInArray` })),
    getTableName: vi.fn(() => `projects`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the projects schema
vi.mock(`@TDB/schemas/projects`, () => ({
  projects: {
    id: { name: `id` },
    orgId: { name: `org_id` },
    name: { name: `name` },
  },
}))

vi.mock(`@TDB/schemas/endpoints`, () => ({
  endpoints: { projectId: { name: `project_id` } },
}))

vi.mock(`@TDB/schemas/functions`, () => ({
  functions: { projectId: { name: `project_id` } },
}))

vi.mock(`@TDB/schemas/agentProjects`, () => ({
  agentProjects: { projectId: { name: `project_id` } },
}))

vi.mock(`@TDB/schemas/projectProviders`, () => ({
  projectProviders: {
    projectId: { name: `project_id` },
    providerId: { name: `provider_id` },
    priority: { name: `priority` },
  },
}))

// Mock the Project/Provider domain models
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Project: vi.fn(function MockProject(data: any) {
      return { ...data, id: data?.id || `mock-id`, _isModel: true }
    }),
    Provider: vi.fn(function MockProvider(data: any) {
      return { ...data, _isProviderModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object mirroring the chained API
 * used by the Project service, including projectProviders junction table
 * operations (transaction), and the select-based getCounts() aggregation.
 */
const createMockDb = () => {
  const returningFn = vi.fn()
  const valuesFn = vi.fn(() => ({ returning: returningFn }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  const whereReturningFn = vi.fn()
  const whereFn = vi.fn(() => ({ returning: whereReturningFn }))
  const setFn = vi.fn(() => ({ where: whereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  // Transaction mock: its own insert/delete chains for #upsertProviders
  const txDeleteWhereFn = vi.fn().mockResolvedValue(undefined)
  const txDeleteFn = vi.fn(() => ({ where: txDeleteWhereFn }))
  const txOnConflictFn = vi.fn().mockResolvedValue(undefined)
  const txInsertValuesFn = vi.fn(() => ({ onConflictDoUpdate: txOnConflictFn }))
  const txInsertFn = vi.fn(() => ({ values: txInsertValuesFn }))

  const txMock = { delete: txDeleteFn, insert: txInsertFn }
  const transactionFn = vi.fn(async (cb: (tx: any) => Promise<void>) => cb(txMock))

  // select().from().where() chain, used 3x in parallel by getCounts()
  const selectWhereFn = vi.fn().mockResolvedValue([{ count: 0 }])
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
      select: selectFn,
      transaction: transactionFn,
      query: {
        projects: { findFirst, findMany },
      },
    } as any,
    returningFn,
    valuesFn,
    insertFn,
    setFn,
    whereFn,
    whereReturningFn,
    updateFn,
    deleteFn,
    deleteWhereFn,
    findFirst,
    findMany,
    transactionFn,
    txMock,
    txDeleteFn,
    txDeleteWhereFn,
    txInsertFn,
    txInsertValuesFn,
    txOnConflictFn,
    selectFn,
    selectFromFn,
    selectWhereFn,
  }
}

describe(`Project service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: ProjectService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { Project } = await import(`./project`)
    service = new Project({ db: mocks.db, config: {} as any })
  })

  // ---------- with() ----------
  describe(`with`, () => {
    it(`should always include providerLinks with nested provider relation`, () => {
      const result = service.with({})

      expect(result.providerLinks).toEqual({ with: { provider: true } })
    })

    it(`should preserve existing opts`, () => {
      const result = service.with({ org: true } as any)

      expect(result.org).toBe(true)
      expect(result.providerLinks).toEqual({ with: { provider: true } })
    })

    it(`should not crash when opts is undefined`, () => {
      const result = service.with(undefined as any)

      expect(result).toBeDefined()
      expect(result.providerLinks).toEqual({ with: { provider: true } })
    })
  })

  // ---------- model() ----------
  describe(`model`, () => {
    it(`should create a ProjectModel with _isModel flag`, () => {
      const data = { id: `proj-1`, name: `Test Project` } as any
      const result = service.model(data)

      expect(result._isModel).toBe(true)
    })

    it(`should handle providerLinks being undefined`, () => {
      const data = { id: `proj-1`, name: `Test Project` } as any
      const result = service.model(data)

      expect(result.providerLinks).toEqual([])
    })

    it(`should map providerLinks and sort by priority ascending`, () => {
      const provA = { id: `prov-1`, name: `High` }
      const provB = { id: `prov-2`, name: `Low` }
      const data = {
        id: `proj-1`,
        name: `Test Project`,
        providerLinks: [
          { projectId: `proj-1`, providerId: `prov-1`, priority: 5, provider: provA },
          { projectId: `proj-1`, providerId: `prov-2`, priority: 0, provider: provB },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks).toHaveLength(2)
      expect(result.providerLinks[0].priority).toBe(0)
      expect((result.providerLinks[0].provider as any)._isProviderModel).toBe(true)
      expect(result.providerLinks[0].provider.id).toBe(provB.id)
      expect(result.providerLinks[1].priority).toBe(5)
    })

    it(`should default a null/undefined priority to 0`, () => {
      const prov = { id: `prov-1`, name: `Provider` }
      const data = {
        id: `proj-1`,
        name: `Test Project`,
        providerLinks: [
          { projectId: `proj-1`, providerId: `prov-1`, priority: null, provider: prov },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks[0].priority).toBe(0)
    })

    it(`should strip providerLinks key off rest data passed to ProjectModel`, () => {
      const prov = { id: `prov-1`, name: `Provider` }
      const data = {
        id: `proj-1`,
        name: `Test Project`,
        orgId: `org-1`,
        providerLinks: [
          { projectId: `proj-1`, providerId: `prov-1`, priority: 0, provider: prov },
        ],
      } as any

      const result = service.model(data)

      expect(result.orgId).toBe(`org-1`)
    })
  })

  // ---------- get() ----------
  describe(`get`, () => {
    it(`should return model data on success`, async () => {
      mocks.findFirst.mockResolvedValue({ id: `proj-1`, name: `Test`, providerLinks: [] })

      const result = await service.get(`proj-1`)

      expect(result.data).toBeDefined()
      expect(result.data!._isModel).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it(`should return empty result when not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.get(`missing-id`)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeUndefined()
    })

    it(`should return error on db exception`, async () => {
      mocks.findFirst.mockRejectedValue(new Error(`DB failure`))

      const result = await service.get(`proj-1`)

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`DB failure`)
    })
  })

  // ---------- list() ----------
  describe(`list`, () => {
    it(`should return array of project models`, async () => {
      mocks.findMany.mockResolvedValue([
        { id: `proj-1`, name: `A`, providerLinks: [] },
        { id: `proj-2`, name: `B`, providerLinks: [] },
      ])

      const result = await service.list()

      expect(result.data).toHaveLength(2)
      expect(result.data![0]._isModel).toBe(true)
    })

    it(`should return empty array when nothing found`, async () => {
      mocks.findMany.mockResolvedValue([])

      const result = await service.list()

      expect(result.data).toEqual([])
    })

    it(`should return error on db exception`, async () => {
      mocks.findMany.mockRejectedValue(new Error(`DB failure`))

      const result = await service.list()

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`DB failure`)
    })
  })

  // ---------- create() ----------
  describe(`create`, () => {
    it(`should create a project without providerInputs`, async () => {
      mocks.returningFn.mockResolvedValue([{ id: `proj-1`, name: `Test` }])

      const result = await service.create({ name: `Test`, orgId: `org-1` } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should return the base error and skip provider linking when create fails`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.create({
        name: `Test`,
        orgId: `org-1`,
        providerInputs: [{ id: `prov-1` } as any],
      } as any)

      expect(result.error).toBeDefined()
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should skip provider linking when providerInputs is empty`, async () => {
      mocks.returningFn.mockResolvedValue([{ id: `proj-1`, name: `Test` }])

      await service.create({
        name: `Test`,
        orgId: `org-1`,
        providerInputs: [],
      } as any)

      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should link providers then re-fetch when providerInputs is supplied`, async () => {
      mocks.returningFn.mockResolvedValueOnce([{ id: `proj-1`, name: `Test` }])
      mocks.findFirst.mockResolvedValue({
        id: `proj-1`,
        name: `Test`,
        providerLinks: [
          {
            projectId: `proj-1`,
            providerId: `prov-1`,
            priority: 0,
            provider: { id: `prov-1` },
          },
        ],
      })

      const result = await service.create({
        name: `Test`,
        orgId: `org-1`,
        providerInputs: [{ id: `prov-1` } as any],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data!._isModel).toBe(true)
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should roll back (delete the project) and return { error } when linking providers fails`, async () => {
      mocks.returningFn.mockResolvedValueOnce([{ id: `proj-1`, name: `Test` }])
      mocks.transactionFn.mockRejectedValue(new Error(`Provider link failed`))

      const result = await service.create({
        name: `Test`,
        orgId: `org-1`,
        providerInputs: [{ id: `prov-1` } as any],
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Provider link failed`)
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
    })

    it(`should log but not throw when the rollback delete itself fails`, async () => {
      mocks.returningFn.mockResolvedValueOnce([{ id: `proj-1`, name: `Test` }])
      mocks.transactionFn.mockRejectedValue(new Error(`Provider link failed`))
      mocks.deleteWhereFn.mockRejectedValue(new Error(`cleanup failed`))

      const result = await service.create({
        name: `Test`,
        orgId: `org-1`,
        providerInputs: [{ id: `prov-1` } as any],
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Provider link failed`)
    })
  })

  // ---------- update() ----------
  describe(`update`, () => {
    it(`should update project data and re-fetch when providerInputs is undefined`, async () => {
      mocks.whereReturningFn.mockResolvedValue([{ id: `proj-1`, name: `Updated` }])
      mocks.findFirst.mockResolvedValue({
        id: `proj-1`,
        name: `Updated`,
        providerLinks: [],
      })

      const result = await service.update({ id: `proj-1`, name: `Updated` } as any)

      expect(result.data).toBeDefined()
      expect(result.data!._isModel).toBe(true)
      expect(mocks.transactionFn).not.toHaveBeenCalled()
      expect(mocks.updateFn).toHaveBeenCalledOnce()
    })

    it(`should skip the base update call when only id + providerInputs are given`, async () => {
      mocks.findFirst.mockResolvedValue({ id: `proj-1`, name: `Test`, providerLinks: [] })

      await service.update({ id: `proj-1`, providerInputs: [] } as any)

      expect(mocks.updateFn).not.toHaveBeenCalled()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
    })

    it(`should replace providers when providerInputs is defined (transaction called)`, async () => {
      mocks.whereReturningFn.mockResolvedValue([{ id: `proj-1`, name: `Updated` }])
      mocks.findFirst.mockResolvedValue({
        id: `proj-1`,
        name: `Updated`,
        providerLinks: [
          {
            projectId: `proj-1`,
            providerId: `prov-2`,
            priority: 0,
            provider: { id: `prov-2` },
          },
        ],
      })

      const result = await service.update({
        id: `proj-1`,
        name: `Updated`,
        providerInputs: [{ id: `prov-2` } as any],
      } as any)

      expect(result.data).toBeDefined()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
    })

    it(`should return { error } instead of throwing when linking providers fails`, async () => {
      mocks.transactionFn.mockRejectedValue(new Error(`Provider link failed`))

      const result = await service.update({
        id: `proj-1`,
        providerInputs: [{ id: `prov-1` } as any],
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Provider link failed`)
      // update() never rolls back (only create() does)
      expect(mocks.deleteFn).not.toHaveBeenCalled()
    })

    it(`should return { error } instead of a stale get() when the base update fails`, async () => {
      mocks.whereReturningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.update({ id: `proj-1`, name: `Updated` } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
      expect(mocks.findFirst).not.toHaveBeenCalled()
    })
  })

  // ---------- #upsertProviders (exercised via create/update) ----------
  describe(`provider linking (#upsertProviders)`, () => {
    it(`should filter out inputs without an id, assign priority by index, and upsert`, async () => {
      mocks.findFirst.mockResolvedValue({ id: `proj-1`, name: `Test`, providerLinks: [] })

      await service.update({
        id: `proj-1`,
        providerInputs: [
          { id: `prov-a` } as any,
          { id: `` } as any,
          { id: undefined } as any,
          { id: `prov-b` } as any,
        ],
      } as any)

      expect(mocks.txInsertValuesFn).toHaveBeenCalledWith([
        { providerId: `prov-a`, priority: 0, projectId: `proj-1` },
        { providerId: `prov-b`, priority: 1, projectId: `proj-1` },
      ])
      expect(mocks.txOnConflictFn).toHaveBeenCalledOnce()
    })

    it(`should delete only the stale links (notInArray) when rows remain`, async () => {
      mocks.findFirst.mockResolvedValue({ id: `proj-1`, name: `Test`, providerLinks: [] })

      await service.update({
        id: `proj-1`,
        providerInputs: [{ id: `prov-a` } as any],
      } as any)

      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      expect(mocks.txDeleteWhereFn).toHaveBeenCalledOnce()
      expect(mocks.txInsertFn).toHaveBeenCalledOnce()
    })

    it(`should delete all existing links and skip insert when providerInputs is empty`, async () => {
      mocks.findFirst.mockResolvedValue({ id: `proj-1`, name: `Test`, providerLinks: [] })

      await service.update({ id: `proj-1`, providerInputs: [] } as any)

      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      expect(mocks.txInsertFn).not.toHaveBeenCalled()
    })
  })

  // ---------- getCounts() ----------
  describe(`getCounts`, () => {
    it(`should aggregate endpoint, function, and agent counts`, async () => {
      mocks.selectWhereFn
        .mockResolvedValueOnce([{ count: 3 }]) // endpoints
        .mockResolvedValueOnce([{ count: 2 }]) // functions
        .mockResolvedValueOnce([{ count: 1 }]) // agentProjects

      const result = await service.getCounts(`proj-1`)

      expect(result.data).toEqual({ agent: 1, endpoint: 3, function: 2 })
      expect(mocks.selectFn).toHaveBeenCalledTimes(3)
    })

    it(`should default counts to 0 when a query returns no rows`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.getCounts(`proj-1`)

      expect(result.data).toEqual({ agent: 0, endpoint: 0, function: 0 })
    })
  })
})
