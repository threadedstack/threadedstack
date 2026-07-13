import { SandboxStartingClaim } from './sandboxStartingClaim'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SandboxStartingClaim as SandboxStartingClaimModel } from '@tdsk/domain'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

/**
 * Mock Drizzle DB covering the two chains sandboxStartingClaim.ts drives
 * directly: insert().values().onConflictDoNothing().returning() and
 * update().set().where().returning().
 */
const createMockDb = () => {
  const insertReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const insertOnConflictDoNothingFn = vi.fn((..._args: any[]) => ({
    returning: insertReturningFn,
  }))
  const insertValuesFn = vi.fn((..._args: any[]) => ({
    onConflictDoNothing: insertOnConflictDoNothingFn,
  }))
  const insertFn = vi.fn((..._args: any[]) => ({ values: insertValuesFn }))

  const updateReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const updateWhereFn = vi.fn((..._args: any[]) => ({ returning: updateReturningFn }))
  const updateSetFn = vi.fn((..._args: any[]) => ({ where: updateWhereFn }))
  const updateFn = vi.fn((..._args: any[]) => ({ set: updateSetFn }))

  return {
    db: { insert: insertFn, update: updateFn } as any,
    insertFn,
    insertValuesFn,
    insertOnConflictDoNothingFn,
    insertReturningFn,
    updateFn,
    updateSetFn,
    updateWhereFn,
    updateReturningFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `ssc_claim001`,
  sandboxId: `sb_test0001`,
  claimedAt: new Date(),
  releasedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`SandboxStartingClaim service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: SandboxStartingClaim

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new SandboxStartingClaim({ db: mocks.db, config: {} } as any)
  })

  describe(`claimStarting`, () => {
    it(`inserts and returns the modeled row when the claim succeeds`, async () => {
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow()])

      const { data, error, conflict } = await service.claimStarting(`sb_test0001`)

      expect(error).toBeUndefined()
      expect(conflict).toBeUndefined()
      expect(data).toBeInstanceOf(SandboxStartingClaimModel)
      expect(mocks.insertValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ sandboxId: `sb_test0001` })
      )
      expect(mocks.insertOnConflictDoNothingFn).toHaveBeenCalled()
    })

    it(`simulates two concurrent replicas racing the same sandbox-start — exactly one wins`, async () => {
      // Replica A's insert succeeds outright.
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow({ id: `ssc_claimA01` })])
      const winner = await service.claimStarting(`sb_test0001`)

      expect(winner.conflict).toBeUndefined()
      expect(winner.data).toBeInstanceOf(SandboxStartingClaimModel)
      expect(winner.data?.id).toBe(`ssc_claimA01`)

      // Replica B's insert hits the partial unique index on
      // sandbox_starting_claims(sandbox_id) WHERE released_at IS NULL —
      // ON CONFLICT DO NOTHING means zero rows come back, never a thrown error.
      mocks.insertReturningFn.mockResolvedValueOnce([])
      const loser = await service.claimStarting(`sb_test0001`)

      expect(loser.error).toBeUndefined()
      expect(loser.data).toBeNull()
      expect(loser.conflict).toBe(true)
    })

    it(`returns { error } instead of throwing when the insert query fails`, async () => {
      mocks.insertReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error, conflict } = await service.claimStarting(`sb_test0001`)

      expect(data).toBeUndefined()
      expect(conflict).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })

  describe(`releaseStarting`, () => {
    it(`marks the active claim released and returns the modeled row`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([fakeRow({ releasedAt: new Date() })])

      const { data, error } = await service.releaseStarting(`sb_test0001`)

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(SandboxStartingClaimModel)
      expect(mocks.updateSetFn).toHaveBeenCalledWith(
        expect.objectContaining({ releasedAt: expect.any(Date) })
      )
    })

    it(`returns { data: null } when no active claim exists for the sandbox`, async () => {
      mocks.updateReturningFn.mockResolvedValueOnce([])

      const { data, error } = await service.releaseStarting(`sb_test0001`)

      expect(error).toBeUndefined()
      expect(data).toBeNull()
    })

    it(`returns { error } instead of throwing when the update query fails`, async () => {
      mocks.updateReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.releaseStarting(`sb_test0001`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })
})
