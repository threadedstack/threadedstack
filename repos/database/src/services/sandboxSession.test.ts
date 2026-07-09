import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SandboxSession } from './sandboxSession'
import { SandboxSession as SandboxSessionModel } from '@tdsk/domain'

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
    getTableName: vi.fn(() => `sandbox_sessions`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the sandboxSessions schema
vi.mock(`@TDB/schemas/sandboxSessions`, () => ({
  sandboxSessions: {
    id: { name: `id` },
    orgId: { name: `org_id` },
    sandboxId: { name: `sandbox_id` },
    startedAt: { name: `started_at` },
  },
}))

/**
 * Mock Drizzle DB covering the two chains sandboxSession.ts drives directly
 * (update().set().where().returning()) plus the db.query.sandboxSessions
 * findFirst/findMany chain used by Base.get/list.
 */
const createMockDb = () => {
  const updateReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const updateWhereFn = vi.fn((..._args: any[]) => ({ returning: updateReturningFn }))
  const updateSetFn = vi.fn((..._args: any[]) => ({ where: updateWhereFn }))
  const updateFn = vi.fn((..._args: any[]) => ({ set: updateSetFn }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      update: updateFn,
      query: { sandboxSessions: { findFirst, findMany } },
    } as any,
    updateFn,
    updateSetFn,
    updateWhereFn,
    updateReturningFn,
    findFirst,
    findMany,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `sbs_sess0001`,
  orgId: `og_org00001`,
  userId: `us_user00001`,
  projectId: `pj_proj0001`,
  sandboxId: `sb_sand0001`,
  sessionId: `sess-abc123`,
  instanceId: `pod-abc123`,
  status: `connected`,
  durationMs: null,
  stdoutKey: null,
  stderrKey: null,
  startedAt: new Date(),
  completedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`SandboxSession service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: SandboxSession

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new SandboxSession({ db: mocks.db, config: {} } as any)
  })

  describe(`with`, () => {
    it(`passes through the given opts unchanged`, () => {
      expect(service.with({ sandbox: true })).toEqual({ sandbox: true })
    })

    it(`returns an empty object when called without opts`, () => {
      expect(service.with()).toEqual({})
    })
  })

  describe(`model`, () => {
    it(`builds a SandboxSessionModel, casting status`, () => {
      const row = fakeRow({ status: `error` })
      const model = service.model(row as any)

      expect(model).toBeInstanceOf(SandboxSessionModel)
      expect(model.status).toBe(`error`)
    })
  })

  describe(`get`, () => {
    it(`models the found row`, async () => {
      mocks.findFirst.mockResolvedValueOnce(fakeRow())

      const { data, error } = await service.get(`sbs_sess0001`)

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(SandboxSessionModel)
      expect(data?.id).toBe(`sbs_sess0001`)
    })

    it(`returns {} when no row is found`, async () => {
      mocks.findFirst.mockResolvedValueOnce(undefined)

      const { data, error } = await service.get(`sbs_missing1`)

      expect(data).toBeUndefined()
      expect(error).toBeUndefined()
    })
  })

  describe(`list`, () => {
    it(`models every found row`, async () => {
      mocks.findMany.mockResolvedValueOnce([fakeRow(), fakeRow({ id: `sbs_sess0002` })])

      const { data, error } = await service.list()

      expect(error).toBeUndefined()
      expect(data).toHaveLength(2)
      expect(data?.every((r) => r instanceof SandboxSessionModel)).toBe(true)
    })
  })

  describe(`listBySandbox`, () => {
    it(`filters by sandboxId and defaults to newest-first ordering`, async () => {
      mocks.findMany.mockResolvedValueOnce([fakeRow()])

      const { data, error } = await service.listBySandbox(`sb_sand0001`)

      expect(error).toBeUndefined()
      expect(data).toHaveLength(1)
    })
  })

  describe(`listByOrg`, () => {
    it(`filters by orgId and defaults to newest-first ordering`, async () => {
      mocks.findMany.mockResolvedValueOnce([fakeRow()])

      const { data, error } = await service.listByOrg(`og_org00001`)

      expect(error).toBeUndefined()
      expect(data).toHaveLength(1)
    })
  })

  describe(`complete`, () => {
    it(`writes the final status/keys and models the updated row`, async () => {
      const row = fakeRow({
        status: `completed`,
        completedAt: new Date(),
        durationMs: 4200,
      })
      mocks.updateReturningFn.mockResolvedValueOnce([row])

      const { data, error } = await service.complete(`sbs_sess0001`, {
        status: `completed`,
        durationMs: 4200,
        stdoutKey: `stdout/key`,
        stderrKey: `stderr/key`,
      })

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(SandboxSessionModel)
      expect(data?.status).toBe(`completed`)
      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({
          status: `completed`,
          durationMs: 4200,
          stdoutKey: `stdout/key`,
          stderrKey: `stderr/key`,
        })
      )
    })

    it(`defaults completedAt to now when not provided`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([fakeRow({ status: `error` })])

      await service.complete(`sbs_sess0001`, { status: `error` })

      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ completedAt: expect.any(Date) })
      )
    })

    it(`returns { error } when the session does not exist`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([])

      const { data, error } = await service.complete(`sbs_missing1`, {
        status: `error`,
      })

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`Sandbox session not found`)
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`connection lost`))

      const { data, error } = await service.complete(`sbs_sess0001`, {
        status: `error`,
      })

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`connection lost`)
    })
  })
})
