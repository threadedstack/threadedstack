import { SkillProposal } from './skillProposal'
import { PgDialect } from 'drizzle-orm/pg-core'
import { SkillProposal as SkillProposalModel, ESkillProposalStatus } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/** Mock Drizzle DB for the select→from→where→orderBy chain used by the service. */
const createMockDb = () => {
  const orderByFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const whereFn = vi.fn((..._args: any[]) => ({ orderBy: orderByFn }))
  const fromFn = vi.fn((..._args: any[]) => ({ where: whereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: fromFn }))
  return {
    db: { select: selectFn } as any,
    selectFn,
    fromFn,
    whereFn,
    orderByFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `pr_abc1234`,
  orgId: `og_org0001`,
  agentId: `ag_agent01`,
  name: `Deploy check`,
  description: `A skill`,
  instructions: `Do the thing`,
  tools: [],
  triggerKeywords: [],
  alwaysActive: false,
  status: ESkillProposalStatus.scanned,
  scanResult: null,
  auditVerdict: null,
  promotedSkillId: null,
  reason: null,
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`SkillProposal service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: SkillProposal

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new SkillProposal({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the skillProposals table`, () => {
    expect(service).toBeInstanceOf(SkillProposal)
    expect(service.name).toBe(`skillProposals`)
  })

  describe(`listByStatus`, () => {
    it(`filters by org + status and models the rows`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([fakeRow(), fakeRow({ id: `pr_def5678` })])

      const result = await service.listByStatus(
        `og_org0001`,
        ESkillProposalStatus.scanned
      )

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(`scanned`)
      expect(result.data).toHaveLength(2)
      expect(result.data?.[0]).toBeInstanceOf(SkillProposalModel)
    })

    it(`returns the error when the query throws`, async () => {
      mocks.orderByFn.mockRejectedValueOnce(new Error(`query failed`))
      const result = await service.listByStatus(
        `og_org0001`,
        ESkillProposalStatus.pending
      )
      expect(result.data).toBeUndefined()
      expect(result.error?.message).toBe(`query failed`)
    })
  })

  describe(`listForAgent`, () => {
    it(`filters by agentId`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([fakeRow()])
      const result = await service.listForAgent(`ag_agent01`)
      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`ag_agent01`)
      expect(result.data).toHaveLength(1)
    })
  })
})
