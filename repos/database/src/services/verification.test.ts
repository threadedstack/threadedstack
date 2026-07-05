import { Verification } from './verification'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  Verification as VerificationModel,
  EVerificationStatus,
  EVerifyProbeKind,
  DefaultVerifyProbe,
} from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Mock Drizzle DB for the select→from→where→orderBy(→limit) chain used by the
 * service. `orderBy` is awaitable (for the un-limited list helpers) and also
 * exposes `.limit` (for getByPr).
 */
const createMockDb = () => {
  const limitFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const orderByFn = vi.fn((..._args: any[]) => {
    const res: any = Promise.resolve([])
    res.limit = limitFn
    return res
  })
  const whereFn = vi.fn((..._args: any[]) => ({ orderBy: orderByFn }))
  const fromFn = vi.fn((..._args: any[]) => ({ where: whereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: fromFn }))
  return {
    db: { select: selectFn } as any,
    selectFn,
    fromFn,
    whereFn,
    orderByFn,
    limitFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `vf_abc1234`,
  orgId: `og_org0001`,
  agentId: `ag_agent01`,
  prNumber: 42,
  prUrl: `https://github.com/owner/repo/pull/42`,
  mergeSha: `abc123def456abc123def456abc123def456abc12`,
  probe: { kind: EVerifyProbeKind.ciGreen },
  status: EVerificationStatus.pending,
  detail: null,
  revertPrUrl: null,
  escalationId: null,
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Verification service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Verification

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Verification({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the verifications table`, () => {
    expect(service).toBeInstanceOf(Verification)
    expect(service.name).toBe(`verifications`)
  })

  describe(`getByPr`, () => {
    it(`returns the matching row for an (orgId, prNumber) pair`, async () => {
      mocks.limitFn.mockResolvedValueOnce([fakeRow()])

      const result = await service.getByPr(`og_org0001`, 42)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(42)

      expect(mocks.limitFn).toHaveBeenCalledWith(1)
      expect(result.data).toBeInstanceOf(VerificationModel)
      expect(result.data?.prNumber).toBe(42)
    })

    it(`returns null when no row exists for that (orgId, prNumber)`, async () => {
      mocks.limitFn.mockResolvedValueOnce([])

      const result = await service.getByPr(`og_org0001`, 999)

      expect(result.data).toBeNull()
    })

    it(`is org-scoped: same prNumber under different orgId does NOT match`, async () => {
      // DB returns empty because the where clause includes the caller's orgId
      mocks.limitFn.mockResolvedValueOnce([])

      const result = await service.getByPr(`og_org0002`, 42)

      const where = render(mocks.whereFn.mock.calls[0][0])
      // Must filter on org_org0002, not og_org0001
      expect(where.params).toContain(`og_org0002`)
      expect(where.params).not.toContain(`og_org0001`)

      expect(result.data).toBeNull()
    })
  })

  describe(`upsertByPr`, () => {
    it(`calls create when no existing row for (orgId, prNumber)`, async () => {
      // getByPr finds nothing
      mocks.limitFn.mockResolvedValueOnce([])

      const createdRow = fakeRow({ prUrl: `https://github.com/owner/repo/pull/7` })

      // Spy on create and update
      const createSpy = vi
        .spyOn(service, `create`)
        .mockResolvedValueOnce({ data: new VerificationModel(createdRow) })
      const updateSpy = vi.spyOn(service, `update`)

      const result = await service.upsertByPr(`og_org0001`, `ag_agent01`, 7, {
        prUrl: `https://github.com/owner/repo/pull/7`,
      })

      expect(createSpy).toHaveBeenCalledOnce()
      expect(updateSpy).not.toHaveBeenCalled()

      const createCall = createSpy.mock.calls[0][0] as any
      expect(createCall.orgId).toBe(`og_org0001`)
      expect(createCall.agentId).toBe(`ag_agent01`)
      expect(createCall.prNumber).toBe(7)
      expect(createCall.probe).toEqual(DefaultVerifyProbe)
      expect(createCall.prUrl).toBe(`https://github.com/owner/repo/pull/7`)

      expect(result.data).toBeInstanceOf(VerificationModel)
    })

    it(`calls update (NOT create) when existing row for (orgId, prNumber)`, async () => {
      const existingRow = fakeRow({ status: EVerificationStatus.verifying })
      // getByPr finds the existing row
      mocks.limitFn.mockResolvedValueOnce([existingRow])

      const updatedRow = fakeRow({
        status: EVerificationStatus.verified,
        detail: `CI green`,
      })

      const updateSpy = vi
        .spyOn(service, `update`)
        .mockResolvedValueOnce({ data: new VerificationModel(updatedRow) })
      const createSpy = vi.spyOn(service, `create`)

      const result = await service.upsertByPr(`og_org0001`, `ag_agent01`, 42, {
        status: EVerificationStatus.verified,
        detail: `CI green`,
      })

      expect(updateSpy).toHaveBeenCalledOnce()
      expect(createSpy).not.toHaveBeenCalled()

      const updateCall = updateSpy.mock.calls[0][0] as any
      expect(updateCall.id).toBe(`vf_abc1234`)
      expect(updateCall.status).toBe(EVerificationStatus.verified)
      expect(updateCall.detail).toBe(`CI green`)

      expect(result.data).toBeInstanceOf(VerificationModel)
    })
  })

  describe(`listByStatus`, () => {
    it(`filters to the given status and orders newest first`, async () => {
      const older = fakeRow({
        id: `vf_older001`,
        status: EVerificationStatus.pending,
        createdAt: new Date(`2026-07-01`),
      })
      const newer = fakeRow({
        id: `vf_newer01`,
        status: EVerificationStatus.pending,
        createdAt: new Date(`2026-07-03`),
      })
      // Mock orderBy resolving (no .limit call here)
      mocks.orderByFn.mockResolvedValueOnce([newer, older])

      const result = await service.listByStatus(`og_org0001`, EVerificationStatus.pending)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(EVerificationStatus.pending)

      // orderBy desc — newer row first
      expect(result.data?.[0].id).toBe(`vf_newer01`)
      expect(result.data?.[1].id).toBe(`vf_older001`)
    })

    it(`returns an empty array when no rows match`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([])
      const result = await service.listByStatus(
        `og_org0001`,
        EVerificationStatus.verified
      )
      expect(result.data).toEqual([])
    })

    it(`maps each row to a VerificationModel instance`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([
        fakeRow({ id: `vf_abc0001`, status: EVerificationStatus.pending }),
        fakeRow({ id: `vf_abc0002`, status: EVerificationStatus.pending }),
      ])
      const result = await service.listByStatus(`og_org0001`, EVerificationStatus.pending)
      expect(result.data?.every((r) => r instanceof VerificationModel)).toBe(true)
    })
  })
})
