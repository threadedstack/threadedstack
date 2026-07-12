import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Sandbox as SandboxService } from './sandbox'

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
    getTableName: vi.fn(() => `sandboxes`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the sandboxes schema
vi.mock(`@TDB/schemas/sandboxes`, () => ({
  sandboxes: {
    id: { name: `id` },
    orgId: { name: `org_id` },
    name: { name: `name` },
  },
}))

// Mock the sandboxProviders schema
vi.mock(`@TDB/schemas/sandboxProviders`, () => ({
  sandboxProviders: {
    sandboxId: { name: `sandbox_id` },
    providerId: { name: `provider_id` },
    priority: { name: `priority` },
    model: { name: `model` },
  },
}))

// Mock the sandboxProjects schema
vi.mock(`@TDB/schemas/sandboxProjects`, () => ({
  sandboxProjects: {
    sandboxId: { name: `sandbox_id` },
    projectId: { name: `project_id` },
    alias: { name: `alias` },
    enabled: { name: `enabled` },
    config: { name: `config` },
  },
}))

// Mock the Sandbox domain model
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Sandbox: vi.fn(function MockSandbox(data: any) {
      return { ...data, id: data?.id || `mock-id`, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Mirrors the chained API used by the Sandbox service including
 * sandboxProviders junction table operations and transactions.
 */
const createMockDb = () => {
  const returningFn = vi.fn()
  const onConflictDoNothingFn = vi.fn(() => ({ returning: returningFn }))
  const valuesFn = vi.fn(() => ({
    returning: returningFn,
    onConflictDoNothing: onConflictDoNothingFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  const whereReturningFn = vi.fn()
  const whereFn = vi.fn(() => ({ returning: whereReturningFn }))
  const setFn = vi.fn(() => ({ where: whereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  const deleteWhereFn = vi.fn().mockResolvedValue(undefined)
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  // Transaction mock: creates a txMock with its own insert/delete chains
  const txDeleteWhereFn = vi.fn()
  const txDeleteFn = vi.fn(() => ({ where: txDeleteWhereFn }))
  const txOnConflictFn = vi.fn()
  const txOnConflictDoNothingFn = vi.fn()
  const txInsertValuesFn = vi.fn(() => ({
    onConflictDoUpdate: txOnConflictFn,
    onConflictDoNothing: txOnConflictDoNothingFn,
  }))
  const txInsertFn = vi.fn(() => ({ values: txInsertValuesFn }))

  const txMock = {
    delete: txDeleteFn,
    insert: txInsertFn,
  }
  const transactionFn = vi.fn(async (cb: (tx: any) => Promise<void>) => {
    await cb(txMock)
  })

  const spFindFirst = vi.fn()
  const spFindMany = vi.fn().mockResolvedValue([])

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
      transaction: transactionFn,
      query: {
        sandboxes: { findFirst, findMany },
        sandboxProjects: {
          findMany: spFindMany,
          findFirst: spFindFirst,
        },
      },
    } as any,
    spFindFirst,
    spFindMany,
    returningFn,
    valuesFn,
    setFn,
    whereFn,
    whereReturningFn,
    deleteWhereFn,
    findFirst,
    findMany,
    insertFn,
    deleteFn,
    transactionFn,
    txMock,
    txDeleteFn,
    txDeleteWhereFn,
    txInsertFn,
    txInsertValuesFn,
    txOnConflictFn,
  }
}

describe(`Sandbox service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: SandboxService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { Sandbox } = await import(`./sandbox`)
    service = new Sandbox({
      db: mocks.db,
      config: {} as any,
    })
  })

  // ---------- with() ----------
  describe(`with`, () => {
    it(`should always include providers with nested provider relation`, () => {
      const result = service.with({})

      expect(result.providers).toEqual({ with: { provider: true } })
    })

    it(`should always include projects with nested project relation`, () => {
      const result = service.with({})

      expect(result.projects).toEqual({ with: { project: true } })
    })

    it(`should preserve existing opts`, () => {
      const result = service.with({ org: true } as any)

      expect(result.org).toBe(true)
      expect(result.providers).toEqual({ with: { provider: true } })
    })

    it(`should not crash when opts is undefined`, () => {
      const result = service.with(undefined as any)

      expect(result).toBeDefined()
      expect(result.providers).toEqual({ with: { provider: true } })
    })

    it(`should override providers key with nested relation`, () => {
      const result = service.with({ providers: { columns: { id: true } } } as any)

      expect(result.providers).toEqual({ with: { provider: true } })
    })
  })

  // ---------- model() ----------
  describe(`model`, () => {
    it(`should create a SandboxModel with _isModel flag`, () => {
      const data = { id: `sbx-1`, name: `TestSandbox` } as any
      const result = service.model(data)

      expect(result).toBeDefined()
      expect(result._isModel).toBe(true)
    })

    it(`should handle providers being undefined`, () => {
      const data = { id: `sbx-1`, name: `TestSandbox` } as any
      const result = service.model(data)

      expect(result).toBeDefined()
      expect(result.providerLinks).toEqual([])
    })

    it(`should handle empty providers array`, () => {
      const data = { id: `sbx-1`, name: `TestSandbox`, providers: [] } as any
      const result = service.model(data)

      expect(result.providerLinks).toEqual([])
    })

    it(`should map providers to providerLinks format`, () => {
      const provA = { id: `prov-1`, name: `ProviderA` }
      const provB = { id: `prov-2`, name: `ProviderB` }
      const data = {
        id: `sbx-1`,
        name: `TestSandbox`,
        providers: [
          {
            sandboxId: `sbx-1`,
            providerId: `prov-1`,
            priority: 1,
            model: `gpt-4`,
            provider: provA,
          },
          {
            sandboxId: `sbx-1`,
            providerId: `prov-2`,
            priority: 0,
            model: null,
            provider: provB,
          },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks).toHaveLength(2)
      expect(result.providerLinks[0]).toMatchObject({
        provider: { id: provB.id, name: provB.name },
        model: null,
        priority: 0,
      })
      expect(result.providerLinks[1]).toMatchObject({
        provider: { id: provA.id, name: provA.name },
        model: `gpt-4`,
        priority: 1,
      })
    })

    it(`should sort providers by priority ascending`, () => {
      const provA = { id: `prov-1`, name: `High` }
      const provB = { id: `prov-2`, name: `Low` }
      const provC = { id: `prov-3`, name: `Mid` }
      const data = {
        id: `sbx-1`,
        name: `TestSandbox`,
        providers: [
          {
            sandboxId: `sbx-1`,
            providerId: `prov-1`,
            priority: 10,
            model: null,
            provider: provA,
          },
          {
            sandboxId: `sbx-1`,
            providerId: `prov-2`,
            priority: 0,
            model: null,
            provider: provB,
          },
          {
            sandboxId: `sbx-1`,
            providerId: `prov-3`,
            priority: 5,
            model: null,
            provider: provC,
          },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks[0].priority).toBe(0)
      expect(result.providerLinks[1].priority).toBe(5)
      expect(result.providerLinks[2].priority).toBe(10)
    })

    it(`should default null model to null`, () => {
      const prov = { id: `prov-1`, name: `Provider` }
      const data = {
        id: `sbx-1`,
        name: `TestSandbox`,
        providers: [
          {
            sandboxId: `sbx-1`,
            providerId: `prov-1`,
            priority: 0,
            model: undefined,
            provider: prov,
          },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks[0].model).toBeNull()
    })

    it(`should default null priority to 0`, () => {
      const prov = { id: `prov-1`, name: `Provider` }
      const data = {
        id: `sbx-1`,
        name: `TestSandbox`,
        providers: [
          {
            sandboxId: `sbx-1`,
            providerId: `prov-1`,
            priority: null,
            model: `gpt-4`,
            provider: prov,
          },
        ],
      } as any

      const result = service.model(data)

      expect(result.providerLinks[0].priority).toBe(0)
    })

    it(`should strip providers key from rest data passed to SandboxModel`, () => {
      const prov = { id: `prov-1`, name: `Provider` }
      const data = {
        id: `sbx-1`,
        name: `TestSandbox`,
        orgId: `org-1`,
        providers: [
          {
            sandboxId: `sbx-1`,
            providerId: `prov-1`,
            priority: 0,
            model: null,
            provider: prov,
          },
        ],
      } as any

      const result = service.model(data)

      // providers should not be on the result - providerLinks replaces it
      expect(result.providers).toBeUndefined()
      expect(result.orgId).toBe(`org-1`)
    })
  })

  // ---------- get() ----------
  describe(`get`, () => {
    it(`should return model data on success`, async () => {
      const record = {
        id: `sbx-1`,
        name: `TestSandbox`,
        providers: [],
      }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.get(`sbx-1`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should return empty result when not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.get(`missing-id`)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeUndefined()
    })

    it(`should return error on db exception`, async () => {
      mocks.findFirst.mockRejectedValue(new Error(`DB failure`))

      const result = await service.get(`sbx-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })

    it(`should call findFirst with providers relation`, async () => {
      const record = { id: `sbx-1`, name: `TestSandbox`, providers: [] }
      mocks.findFirst.mockResolvedValue(record)

      await service.get(`sbx-1`)

      expect(mocks.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          with: expect.objectContaining({
            providers: { with: { provider: true } },
          }),
        })
      )
    })
  })

  // ---------- list() ----------
  describe(`list`, () => {
    it(`should return array of sandbox models`, async () => {
      const records = [
        { id: `sbx-1`, name: `A`, providers: [] },
        { id: `sbx-2`, name: `B`, providers: [] },
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

    it(`should return empty array when findMany returns null`, async () => {
      mocks.findMany.mockResolvedValue(null)

      const result = await service.list()

      expect(result.data).toEqual([])
    })

    it(`should return error on db exception`, async () => {
      mocks.findMany.mockRejectedValue(new Error(`DB failure`))

      const result = await service.list()

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })

    it(`should pass through where/limit/offset options`, async () => {
      mocks.findMany.mockResolvedValue([])

      await service.list({ where: { orgId: `org-1` }, limit: 10, offset: 5 })

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 10,
          offset: 5,
        })
      )
    })
  })

  // ---------- create() ----------
  describe(`create`, () => {
    it(`should create sandbox without providers`, async () => {
      const record = { id: `sbx-1`, name: `TestSandbox` }
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.create({
        name: `TestSandbox`,
        orgId: `org-1`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.insertFn).toHaveBeenCalledOnce()
    })

    it(`should create sandbox with providerInputs (calls #setProviders then re-fetches)`, async () => {
      const record = { id: `sbx-1`, name: `TestSandbox` }
      const fullRecord = {
        id: `sbx-1`,
        name: `TestSandbox`,
        providers: [
          {
            sandboxId: `sbx-1`,
            providerId: `prov-1`,
            priority: 0,
            model: null,
            provider: { id: `prov-1`, name: `P1` },
          },
        ],
      }

      // super.create returning
      mocks.returningFn.mockResolvedValueOnce([record])
      // #setProviders uses transaction (mocked in createMockDb)
      // this.get() -> findFirst for re-fetching
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.create({
        name: `TestSandbox`,
        orgId: `org-1`,
        providerInputs: [{ id: `prov-1`, model: null }],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should skip provider linking when providerInputs is empty`, async () => {
      const record = { id: `sbx-1`, name: `TestSandbox` }
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        name: `TestSandbox`,
        orgId: `org-1`,
        providerInputs: [],
      } as any)

      // Empty providerInputs => providerInputs?.length is falsy, so no transaction
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should skip provider linking when providerInputs is undefined`, async () => {
      const record = { id: `sbx-1`, name: `TestSandbox` }
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        name: `TestSandbox`,
        orgId: `org-1`,
      } as any)

      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should strip providerInputs and gitProviderInputs from sandbox data`, async () => {
      const record = { id: `sbx-1`, name: `TestSandbox` }
      mocks.returningFn.mockResolvedValue([record])

      await service.create({
        name: `TestSandbox`,
        orgId: `org-1`,
        providerInputs: [{ id: `p1`, model: null }],
        gitProviderInputs: [],
      } as any)

      // values() should be called with sandbox data, not providerInputs/gitProviderInputs
      const valuesArg = (mocks.valuesFn.mock.calls as unknown[][])[0][0] as Record<
        string,
        unknown
      >
      expect(valuesArg.providerInputs).toBeUndefined()
      expect(valuesArg.gitProviderInputs).toBeUndefined()
      expect(valuesArg.name).toBe(`TestSandbox`)
    })

    it(`should roll back (delete sandbox) if #setProviders fails`, async () => {
      const record = { id: `sbx-1`, name: `TestSandbox` }
      mocks.returningFn.mockResolvedValueOnce([record])

      // Make transaction throw
      mocks.transactionFn.mockRejectedValue(new Error(`Provider link failed`))
      // db.delete for rollback
      mocks.deleteWhereFn.mockResolvedValue(undefined)

      await expect(
        service.create({
          name: `TestSandbox`,
          orgId: `org-1`,
          providerInputs: [{ id: `prov-1`, model: null }],
        } as any)
      ).rejects.toThrow(`Provider link failed`)

      // Verify rollback: db.delete(sandboxes).where(eq(...)) was called
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
    })

    it(`should return error on db exception during base create`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.create({
        name: `TestSandbox`,
        orgId: `org-1`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- update() ----------
  describe(`update`, () => {
    it(`should return error when id is missing`, async () => {
      const result = await service.update({ name: `NoId` } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`Sandbox ID is required for update`)
      expect(result.data).toBeNull()
    })

    it(`should update sandbox data without providers`, async () => {
      const record = { id: `sbx-1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      const result = await service.update({ id: `sbx-1`, name: `Updated` } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should replace providers when providerInputs is defined`, async () => {
      const record = { id: `sbx-1`, name: `Updated` }
      const fullRecord = {
        id: `sbx-1`,
        name: `Updated`,
        providers: [
          {
            sandboxId: `sbx-1`,
            providerId: `prov-2`,
            priority: 0,
            model: `gpt-4`,
            provider: { id: `prov-2`, name: `P2` },
          },
        ],
      }

      // super.update returning
      mocks.whereReturningFn.mockResolvedValue([record])
      // this.get() -> findFirst for re-fetching
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `sbx-1`,
        name: `Updated`,
        providerInputs: [{ id: `prov-2`, model: `gpt-4` }],
      } as any)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should replace providers with empty array (clears all)`, async () => {
      const record = { id: `sbx-1`, name: `Updated` }
      const fullRecord = {
        id: `sbx-1`,
        name: `Updated`,
        providers: [],
      }

      mocks.whereReturningFn.mockResolvedValue([record])
      mocks.findFirst.mockResolvedValue(fullRecord)

      const result = await service.update({
        id: `sbx-1`,
        name: `Updated`,
        providerInputs: [],
      } as any)

      expect(result.data).toBeDefined()
      // Transaction still called because providerInputs !== undefined
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
      // tx.delete called to clear existing providers
      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      // tx.insert NOT called because empty inputs -> no rows to insert
      expect(mocks.txInsertFn).not.toHaveBeenCalled()
    })

    it(`should skip provider update when providerInputs is undefined`, async () => {
      const record = { id: `sbx-1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      await service.update({ id: `sbx-1`, name: `Updated` } as any)

      expect(mocks.transactionFn).not.toHaveBeenCalled()
    })

    it(`should strip providerInputs and gitProviderInputs from update data`, async () => {
      const record = { id: `sbx-1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      await service.update({
        id: `sbx-1`,
        name: `Updated`,
        gitProviderInputs: [],
      } as any)

      // set() should be called with clean sandbox data (no providerInputs/gitProviderInputs)
      const setArg = (mocks.setFn.mock.calls as unknown[][])[0][0] as Record<
        string,
        unknown
      >
      expect(setArg.providerInputs).toBeUndefined()
      expect(setArg.gitProviderInputs).toBeUndefined()
      expect(setArg.name).toBe(`Updated`)
    })

    it(`should run the sandboxProjects delete inside the same transaction as the relations reinsert (rec_4a1Kl7)`, async () => {
      const record = { id: `sbx-1`, name: `Updated` }
      const fullRecord = { id: `sbx-1`, name: `Updated`, providers: [] }

      mocks.whereReturningFn.mockResolvedValue([record])
      mocks.findFirst.mockResolvedValue(fullRecord)

      await service.update({
        id: `sbx-1`,
        name: `Updated`,
        projects: [{ id: `proj-1`, alias: `p1` }],
      } as any)

      // The projects delete must go through tx.delete (inside the same
      // transaction as #relations' reinsert), not the standalone db.delete
      // -- otherwise a failure in #relations would leave the delete
      // committed with nothing re-inserted.
      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteFn).not.toHaveBeenCalled()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
    })

    it(`should not commit the sandboxProjects delete when the relations reinsert fails (rec_4a1Kl7)`, async () => {
      const record = { id: `sbx-1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      // Simulate #relations throwing partway through the transaction
      // (e.g. an invalid alias, or exhausted alias suffixes) -- the whole
      // transaction callback rejects, so the delete never commits.
      mocks.transactionFn.mockRejectedValue(new Error(`relation write failed`))

      const result = await service.update({
        id: `sbx-1`,
        name: `Updated`,
        projects: [{ id: `proj-1`, alias: `p1` }],
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`relation write failed`)
      expect(result.data).toBeNull()
      // get() must never be called to re-fetch a result that no longer
      // reflects reality once the transaction rejected.
      expect(mocks.findFirst).not.toHaveBeenCalled()
    })
  })

  // ---------- listByOrg() ----------
  describe(`listByOrg`, () => {
    it(`should call list with orgId where clause`, async () => {
      mocks.findMany.mockResolvedValue([])

      await service.listByOrg(`org-1`)

      expect(mocks.findMany).toHaveBeenCalledOnce()
    })
  })

  // ---------- addProject() ----------
  describe(`addProject`, () => {
    it(`should auto-generate alias from sandbox name when not provided`, async () => {
      const sandboxRow = { id: `sbx-1`, name: `My Sandbox`, config: {}, orgId: `org-1` }
      mocks.findFirst.mockResolvedValue(sandboxRow)
      mocks.spFindMany.mockResolvedValue([])
      const junction = { sandboxId: `sbx-1`, projectId: `proj-1`, alias: `my-sandbox` }
      mocks.returningFn.mockResolvedValue([junction])

      const result = await service.addProject(`sbx-1`, `proj-1`)

      expect(result.data).toEqual(junction)
      expect(result.error).toBeNull()
      expect(mocks.valuesFn).toHaveBeenCalledWith({
        sandboxId: `sbx-1`,
        projectId: `proj-1`,
        alias: `my-sandbox`,
      })
    })

    it(`should insert with an alias when provided`, async () => {
      const junction = { sandboxId: `sbx-1`, projectId: `proj-1`, alias: `my-alias` }
      mocks.returningFn.mockResolvedValue([junction])

      const result = await service.addProject(`sbx-1`, `proj-1`, `my-alias`)

      expect(result.data).toEqual(junction)
      expect(mocks.valuesFn).toHaveBeenCalledWith({
        sandboxId: `sbx-1`,
        projectId: `proj-1`,
        alias: `my-alias`,
      })
    })
  })

  // ---------- removeProject() ----------
  describe(`removeProject`, () => {
    it(`should delete from sandboxProjects matching sandbox and project`, async () => {
      mocks.deleteWhereFn.mockResolvedValue(undefined)

      const result = await service.removeProject(`sbx-1`, `proj-1`)

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
    })
  })

  // ---------- upsertProjectConfig() ----------
  describe(`upsertProjectConfig`, () => {
    it(`should update sandboxProjects row and return result`, async () => {
      const junction = {
        sandboxId: `sbx-1`,
        projectId: `proj-1`,
        alias: `alias`,
        enabled: true,
        config: null,
      }
      mocks.whereReturningFn.mockResolvedValue([junction])

      const result = await service.upsertProjectConfig(`sbx-1`, `proj-1`, {
        alias: `alias`,
        enabled: true,
      })

      expect(result.data).toEqual(junction)
      expect(result.error).toBeUndefined()
      expect(mocks.setFn).toHaveBeenCalledOnce()
    })

    it(`should return error when junction row not found`, async () => {
      mocks.whereReturningFn.mockResolvedValue([])

      const result = await service.upsertProjectConfig(`sbx-1`, `proj-missing`, {})

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`not linked to this project`)
    })

    it(`should return error on db exception`, async () => {
      mocks.whereFn.mockImplementationOnce(() => {
        throw new Error(`DB failure`)
      })

      const result = await service.upsertProjectConfig(`sbx-1`, `proj-1`, {})

      expect(result.error).toBeDefined()
    })
  })

  // ---------- getProjectConfig() ----------
  describe(`getProjectConfig`, () => {
    it(`should return TSandboxProjectConfig on success`, async () => {
      const junction = {
        sandboxId: `sbx-1`,
        projectId: `proj-1`,
        alias: `my-alias`,
        enabled: true,
        config: null,
      }
      mocks.spFindFirst.mockResolvedValue(junction)

      const result = await service.getProjectConfig(`sbx-1`, `proj-1`)

      expect(result.data).toEqual({
        sandboxId: `sbx-1`,
        projectId: `proj-1`,
        alias: `my-alias`,
        enabled: true,
        config: null,
      })
      expect(result.error).toBeUndefined()
    })

    it(`should default alias to null and enabled to true when null/undefined`, async () => {
      mocks.spFindFirst.mockResolvedValue({
        sandboxId: `sbx-1`,
        projectId: `proj-1`,
        alias: null,
        enabled: null,
        config: undefined,
      })

      const result = await service.getProjectConfig(`sbx-1`, `proj-1`)

      expect(result.data?.alias).toBeNull()
      expect(result.data?.enabled).toBe(true)
      expect(result.data?.config).toBeNull()
    })

    it(`should return error when junction row not found`, async () => {
      mocks.spFindFirst.mockResolvedValue(undefined)

      const result = await service.getProjectConfig(`sbx-1`, `proj-missing`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`not linked to this project`)
    })

    it(`should return error on db exception`, async () => {
      mocks.spFindFirst.mockRejectedValue(new Error(`DB failure`))

      const result = await service.getProjectConfig(`sbx-1`, `proj-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
    })
  })

  // ---------- addProvider() ----------
  describe(`addProvider`, () => {
    it(`should insert into sandboxProviders and return data`, async () => {
      const relation = {
        sandboxId: `sbx-1`,
        providerId: `prov-1`,
        priority: 0,
        model: null,
      }
      mocks.returningFn.mockResolvedValue([relation])

      const result = await service.addProvider(`sbx-1`, `prov-1`)

      expect(result.data).toEqual(relation)
      expect(result.error).toBeNull()
      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.valuesFn).toHaveBeenCalledWith({
        sandboxId: `sbx-1`,
        providerId: `prov-1`,
        priority: 0,
        model: null,
      })
    })

    it(`should insert with custom priority and model`, async () => {
      const relation = {
        sandboxId: `sbx-1`,
        providerId: `prov-1`,
        priority: 5,
        model: `claude-4`,
      }
      mocks.returningFn.mockResolvedValue([relation])

      const result = await service.addProvider(`sbx-1`, `prov-1`, 5, `claude-4`)

      expect(result.data).toEqual(relation)
      expect(result.error).toBeNull()
      expect(mocks.valuesFn).toHaveBeenCalledWith({
        sandboxId: `sbx-1`,
        providerId: `prov-1`,
        priority: 5,
        model: `claude-4`,
      })
    })

    it(`should default model to null when undefined`, async () => {
      const relation = {
        sandboxId: `sbx-1`,
        providerId: `prov-1`,
        priority: 0,
        model: null,
      }
      mocks.returningFn.mockResolvedValue([relation])

      await service.addProvider(`sbx-1`, `prov-1`, 0, undefined)

      expect(mocks.valuesFn).toHaveBeenCalledWith({
        sandboxId: `sbx-1`,
        providerId: `prov-1`,
        priority: 0,
        model: null,
      })
    })
  })

  // ---------- removeProvider() ----------
  describe(`removeProvider`, () => {
    it(`should delete from sandboxProviders matching sandbox and provider`, async () => {
      mocks.deleteWhereFn.mockResolvedValue(undefined)

      const result = await service.removeProvider(`sbx-1`, `prov-1`)

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
      expect(mocks.deleteFn).toHaveBeenCalledOnce()
      expect(mocks.deleteWhereFn).toHaveBeenCalledOnce()
    })
  })

  // ---------- setProviders() ----------
  describe(`setProviders`, () => {
    it(`should call #setProviders and return success`, async () => {
      const result = await service.setProviders(`sbx-1`, [
        { id: `prov-1`, model: `gpt-4` },
      ])

      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
      expect(mocks.transactionFn).toHaveBeenCalledOnce()
    })

    it(`should delete existing providers and insert new ones in transaction`, async () => {
      await service.setProviders(`sbx-1`, [
        { id: `prov-1`, model: `gpt-4` },
        { id: `prov-2`, model: null },
      ])

      // tx.delete called to clear existing
      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      expect(mocks.txDeleteWhereFn).toHaveBeenCalledOnce()
      // tx.insert called with new rows
      expect(mocks.txInsertFn).toHaveBeenCalledOnce()
      expect(mocks.txInsertValuesFn).toHaveBeenCalledWith([
        {
          providerId: `prov-1`,
          priority: 0,
          sandboxId: `sbx-1`,
          model: `gpt-4`,
        },
        {
          providerId: `prov-2`,
          priority: 1,
          sandboxId: `sbx-1`,
          model: null,
        },
      ])
      expect(mocks.txOnConflictFn).toHaveBeenCalledOnce()
    })

    it(`should only delete when inputs array is empty`, async () => {
      await service.setProviders(`sbx-1`, [])

      // tx.delete called to clear existing
      expect(mocks.txDeleteFn).toHaveBeenCalledOnce()
      // tx.insert NOT called because no rows
      expect(mocks.txInsertFn).not.toHaveBeenCalled()
    })

    it(`should filter out inputs without id`, async () => {
      await service.setProviders(`sbx-1`, [
        { id: `prov-1`, model: `gpt-4` },
        { id: ``, model: null },
        { id: undefined as any, model: null },
      ])

      // Only prov-1 has a truthy id
      expect(mocks.txInsertValuesFn).toHaveBeenCalledWith([
        {
          providerId: `prov-1`,
          priority: 0,
          sandboxId: `sbx-1`,
          model: `gpt-4`,
        },
      ])
    })

    it(`should assign priority based on array index`, async () => {
      await service.setProviders(`sbx-1`, [
        { id: `prov-a`, model: null },
        { id: `prov-b`, model: null },
        { id: `prov-c`, model: null },
      ])

      expect(mocks.txInsertValuesFn).toHaveBeenCalledWith([
        {
          providerId: `prov-a`,
          priority: 0,
          sandboxId: `sbx-1`,
          model: null,
        },
        {
          providerId: `prov-b`,
          priority: 1,
          sandboxId: `sbx-1`,
          model: null,
        },
        {
          providerId: `prov-c`,
          priority: 2,
          sandboxId: `sbx-1`,
          model: null,
        },
      ])
    })
  })
})
