import { OpsAction } from './opsAction'
import { PgDialect } from 'drizzle-orm/pg-core'
import { OpsAction as OpsActionModel, EOpsActionStatus, EOpsAction } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Mock Drizzle DB for the select→from→where→orderBy(→limit) chain.
 * `orderBy` is awaitable (for listByStatus) and also exposes `.limit` (for listRecent).
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
  id: `op_abc1234`,
  orgId: `og_org0001`,
  agentId: `ag_agent01`,
  action: EOpsAction.restartDeployment,
  params: { deployment: `tdsk-backend`, reason: `memory leak` },
  dryRun: true,
  dryRunResult: null,
  result: null,
  status: EOpsActionStatus.proposed,
  scanResult: null,
  reviewVerdict: null,
  rollback: null,
  reason: `Backend pods consuming excess memory`,
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`OpsAction service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: OpsAction

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new OpsAction({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the ops_actions table`, () => {
    expect(service).toBeInstanceOf(OpsAction)
    expect(service.name).toBe(`opsActions`)
  })

  describe(`create`, () => {
    it(`inserts a row with dryRun=true and status=proposed by default`, async () => {
      const insertedRow = fakeRow()
      const createSpy = vi
        .spyOn(service, `create`)
        .mockResolvedValueOnce({ data: new OpsActionModel(insertedRow) })

      const result = await service.create({
        orgId: `og_org0001`,
        agentId: `ag_agent01`,
        action: EOpsAction.restartDeployment,
        params: { deployment: `tdsk-backend`, reason: `memory leak` },
        dryRun: true,
        status: EOpsActionStatus.proposed,
      } as any)

      expect(createSpy).toHaveBeenCalledOnce()
      const createCall = createSpy.mock.calls[0][0] as any
      expect(createCall.dryRun).toBe(true)
      expect(createCall.status).toBe(EOpsActionStatus.proposed)
      expect(result.data).toBeInstanceOf(OpsActionModel)
    })
  })

  describe(`listByStatus`, () => {
    it(`filters to dryRun status and orders newest first`, async () => {
      const older = fakeRow({
        id: `op_older001`,
        status: EOpsActionStatus.dryRun,
        createdAt: new Date(`2026-07-01`),
      })
      const newer = fakeRow({
        id: `op_newer01`,
        status: EOpsActionStatus.dryRun,
        createdAt: new Date(`2026-07-03`),
      })
      mocks.orderByFn.mockResolvedValueOnce([newer, older])

      const result = await service.listByStatus(`og_org0001`, EOpsActionStatus.dryRun)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(EOpsActionStatus.dryRun)

      // orderBy desc — newer row first
      expect(result.data?.[0].id).toBe(`op_newer01`)
      expect(result.data?.[1].id).toBe(`op_older001`)
    })

    it(`filters to proposed status and returns only proposed rows`, async () => {
      const row1 = fakeRow({ id: `op_prop001`, status: EOpsActionStatus.proposed })
      const row2 = fakeRow({ id: `op_prop002`, status: EOpsActionStatus.proposed })
      mocks.orderByFn.mockResolvedValueOnce([row1, row2])

      const result = await service.listByStatus(`og_org0001`, EOpsActionStatus.proposed)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(EOpsActionStatus.proposed)
      expect(result.data).toHaveLength(2)
      expect(result.data?.every((r) => r.status === EOpsActionStatus.proposed)).toBe(true)
    })

    it(`returns an empty array when no rows match`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([])
      const result = await service.listByStatus(`og_org0001`, EOpsActionStatus.executed)
      expect(result.data).toEqual([])
    })

    it(`maps each row to an OpsActionModel instance`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([
        fakeRow({ id: `op_abc0001` }),
        fakeRow({ id: `op_abc0002` }),
      ])
      const result = await service.listByStatus(`og_org0001`, EOpsActionStatus.proposed)
      expect(result.data?.every((r) => r instanceof OpsActionModel)).toBe(true)
    })
  })

  describe(`listRecent`, () => {
    it(`limits results to the given count`, async () => {
      const rows = [
        fakeRow({ id: `op_rec0001` }),
        fakeRow({ id: `op_rec0002` }),
        fakeRow({ id: `op_rec0003` }),
      ]
      mocks.limitFn.mockResolvedValueOnce(rows)

      const result = await service.listRecent(`og_org0001`, 3)

      expect(mocks.limitFn).toHaveBeenCalledWith(3)
      expect(result.data).toHaveLength(3)
      expect(result.data?.every((r) => r instanceof OpsActionModel)).toBe(true)
    })

    it(`is org-scoped`, async () => {
      mocks.limitFn.mockResolvedValueOnce([])
      await service.listRecent(`og_org0002`, 3)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0002`)
      expect(where.params).not.toContain(`og_org0001`)
    })
  })

  describe(`update`, () => {
    it(`persists a new status and result payload in a single round-trip`, async () => {
      const updatedRow = fakeRow({
        status: EOpsActionStatus.executed,
        result: {
          ok: true,
          data: { restarted: true },
          completedAt: `2026-07-04T12:00:00Z`,
        },
        dryRun: false,
      })

      const updateSpy = vi
        .spyOn(service, `update`)
        .mockResolvedValueOnce({ data: new OpsActionModel(updatedRow) })

      const result = await service.update({
        id: `op_abc1234`,
        status: EOpsActionStatus.executed,
        result: {
          ok: true,
          data: { restarted: true },
          completedAt: `2026-07-04T12:00:00Z`,
        },
      } as any)

      expect(updateSpy).toHaveBeenCalledOnce()
      const updateCall = updateSpy.mock.calls[0][0] as any
      expect(updateCall.id).toBe(`op_abc1234`)
      expect(updateCall.status).toBe(EOpsActionStatus.executed)
      expect(updateCall.result.ok).toBe(true)

      expect(result.data).toBeInstanceOf(OpsActionModel)
      expect(result.data?.status).toBe(EOpsActionStatus.executed)
    })
  })
})
