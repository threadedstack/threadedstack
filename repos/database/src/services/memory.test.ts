import { Memory } from './memory'
import { PgDialect } from 'drizzle-orm/pg-core'
import { Memory as MemoryModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger to avoid config/db initialization side-effects
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

/**
 * Renders a drizzle SQL fragment to { sql, params } so the scoring branches
 * (vector / lexical / pure recency) can be asserted against real SQL output.
 */
const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Creates a mock Drizzle-compatible DB object.
 * Covers the chain patterns used by the Memory service:
 *   select -> from -> where -> orderBy -> limit   (searchScored / getRoadmap)
 *   update -> set -> where                        (lastAccessedAt bump)
 *   insert -> values -> returning                 (upsertRoadmap via Base.create)
 */
const createMockDb = () => {
  const selectLimitFn = vi.fn((...args: any[]) => Promise.resolve([]))
  const selectOrderByFn = vi.fn((...args: any[]) => ({ limit: selectLimitFn }))
  const selectWhereFn = vi.fn((...args: any[]) => ({ orderBy: selectOrderByFn }))
  const selectFromFn = vi.fn((...args: any[]) => ({ where: selectWhereFn }))
  const selectFn = vi.fn((...args: any[]) => ({ from: selectFromFn }))

  const updateWhereFn = vi.fn((...args: any[]) => Promise.resolve(undefined))
  const updateSetFn = vi.fn((...args: any[]) => ({ where: updateWhereFn }))
  const updateFn = vi.fn((...args: any[]) => ({ set: updateSetFn }))

  const returningFn = vi.fn((...args: any[]) => Promise.resolve([]))
  const valuesFn = vi.fn((...args: any[]) => ({ returning: returningFn }))
  const insertFn = vi.fn((...args: any[]) => ({ values: valuesFn }))

  return {
    db: {
      select: selectFn,
      update: updateFn,
      insert: insertFn,
      query: { memories: { findFirst: vi.fn(), findMany: vi.fn() } },
    } as any,
    selectFn,
    selectFromFn,
    selectWhereFn,
    selectOrderByFn,
    selectLimitFn,
    updateFn,
    updateSetFn,
    updateWhereFn,
    insertFn,
    valuesFn,
    returningFn,
  }
}

/**
 * Builds a fake memory row that looks like what the DB would return.
 */
const fakeMemoryRow = (overrides: Record<string, any> = {}) => ({
  id: `mm_abc1234`,
  orgId: `og_org0001`,
  agentId: `ag_agent01`,
  kind: `fact`,
  text: `The steward observer runs hourly`,
  importance: 7,
  lastAccessedAt: new Date(),
  embedding: null,
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const searchBase = { orgId: `og_org0001`, agentId: `ag_agent01` }

describe(`Memory service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Memory

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Memory({ db: mocks.db, config: {} } as any)
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should instantiate with the memories table`, () => {
      expect(service).toBeInstanceOf(Memory)
      expect(service.name).toBe(`memories`)
    })
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create a MemoryModel from data`, () => {
      const result = service.model(fakeMemoryRow() as any)

      expect(result).toBeInstanceOf(MemoryModel)
      expect(result.orgId).toBe(`og_org0001`)
      expect(result.kind).toBe(`fact`)
    })
  })

  // ---------- searchScored ----------
  describe(`searchScored`, () => {
    it(`should build a vector relevance score when queryEmbedding is provided`, async () => {
      const row = fakeMemoryRow({ embedding: [0.1, 0.2] })
      mocks.selectLimitFn.mockResolvedValue([{ memory: row, score: 12.5 }])

      const result = await service.searchScored({
        ...searchBase,
        queryEmbedding: [0.1, 0.2],
      })

      const { score } = mocks.selectFn.mock.calls[0][0]
      const rendered = render(score)
      // vector similarity with a null-embedding fallback of 0.1
      expect(rendered.sql).toContain(`<=>`)
      expect(rendered.sql).toContain(`case when`)
      expect(rendered.sql).toContain(`0.1`)
      expect(rendered.sql).toContain(`pow(`)
      expect(rendered.sql).toContain(`importance`)
      expect(rendered.params).toContain(0.995)

      // vector mode must NOT filter rows by the tsquery
      const where = render(mocks.selectWhereFn.mock.calls[0][0])
      expect(where.sql).not.toContain(`@@`)

      expect(result.data).toHaveLength(1)
      expect(result.data?.[0]).toBeInstanceOf(MemoryModel)
      expect(result.data?.[0].score).toBe(12.5)
    })

    it(`should fall back to lexical relevance for null-embedding rows in vector mode`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      await service.searchScored({
        ...searchBase,
        query: `observer cycle`,
        queryEmbedding: [0.1, 0.2],
      })

      const { score } = mocks.selectFn.mock.calls[0][0]
      const rendered = render(score)
      expect(rendered.sql).toContain(`<=>`)
      expect(rendered.sql).toContain(`websearch_to_tsquery`)

      // null-embedding rows must survive the where clause to use the fallback
      const where = render(mocks.selectWhereFn.mock.calls[0][0])
      expect(where.sql).not.toContain(`@@`)
    })

    it(`should build a normalized lexical score and tsquery filter in pure-lexical mode`, async () => {
      const row = fakeMemoryRow()
      mocks.selectLimitFn.mockResolvedValue([{ memory: row, score: 3.2 }])

      const result = await service.searchScored({
        ...searchBase,
        query: `observer cycle`,
      })

      const { score } = mocks.selectFn.mock.calls[0][0]
      const rendered = render(score)
      expect(rendered.sql).toContain(`ts_rank`)
      expect(rendered.sql).toContain(`websearch_to_tsquery`)
      expect(rendered.sql).not.toContain(`<=>`)
      expect(rendered.params).toContain(`observer cycle`)

      // rows failing the tsquery are excluded in pure-lexical mode
      const where = render(mocks.selectWhereFn.mock.calls[0][0])
      expect(where.sql).toContain(`@@ websearch_to_tsquery`)

      expect(result.data?.[0].score).toBe(3.2)
    })

    it(`should score by pure recency * importance when no query is provided`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      const result = await service.searchScored({ ...searchBase })

      const { score } = mocks.selectFn.mock.calls[0][0]
      const rendered = render(score)
      expect(rendered.sql).toContain(`pow(`)
      expect(rendered.sql).toContain(`* 1)`)
      expect(rendered.sql).not.toContain(`ts_rank`)
      expect(rendered.sql).not.toContain(`<=>`)

      expect(result.data).toEqual([])
    })

    it(`should filter by kinds when provided`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      await service.searchScored({ ...searchBase, kinds: [`insight`, `roadmap`] })

      const where = render(mocks.selectWhereFn.mock.calls[0][0])
      expect(where.sql).toContain(`"kind" in `)
      expect(where.params).toContain(`insight`)
      expect(where.params).toContain(`roadmap`)
    })

    it(`should default the limit to 8 and accept an override`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      await service.searchScored({ ...searchBase })
      expect(mocks.selectLimitFn).toHaveBeenCalledWith(8)

      await service.searchScored({ ...searchBase, limit: 3 })
      expect(mocks.selectLimitFn).toHaveBeenCalledWith(3)
    })

    it(`should bump lastAccessedAt for the returned rows`, async () => {
      const rows = [
        { memory: fakeMemoryRow({ id: `mm_aaa1111` }), score: 9.1 },
        { memory: fakeMemoryRow({ id: `mm_bbb2222` }), score: 4.2 },
      ]
      mocks.selectLimitFn.mockResolvedValue(rows)

      await service.searchScored({ ...searchBase })

      expect(mocks.updateFn).toHaveBeenCalledOnce()
      expect(mocks.updateSetFn).toHaveBeenCalledWith({
        lastAccessedAt: expect.any(Date),
      })
      const where = render(mocks.updateWhereFn.mock.calls[0][0])
      expect(where.sql).toContain(` in `)
      expect(where.params).toContain(`mm_aaa1111`)
      expect(where.params).toContain(`mm_bbb2222`)
    })

    it(`should not run the bump update when no rows are returned`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      await service.searchScored({ ...searchBase })

      expect(mocks.updateFn).not.toHaveBeenCalled()
    })

    it(`should return the error when the query throws`, async () => {
      mocks.selectLimitFn.mockRejectedValue(new Error(`query failed`))

      const result = await service.searchScored({ ...searchBase })

      expect(result.data).toBeUndefined()
      expect(result.error?.message).toBe(`query failed`)
    })
  })

  // ---------- listUnembedded ----------
  describe(`listUnembedded`, () => {
    it(`should select org+agent rows where embedding IS NULL`, async () => {
      const rows = [
        fakeMemoryRow({ id: `mm_aaa1111`, embedding: null }),
        fakeMemoryRow({ id: `mm_bbb2222`, embedding: null }),
      ]
      ;(mocks.selectOrderByFn as any).mockReturnValueOnce(Promise.resolve(rows))

      const result = await service.listUnembedded(`og_org0001`, `ag_agent01`)

      const where = render(mocks.selectWhereFn.mock.calls[0][0])
      expect(where.sql).toContain(`"embedding" is null`)
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(`ag_agent01`)

      expect(result.data).toHaveLength(2)
      expect(result.data?.[0]).toBeInstanceOf(MemoryModel)
    })

    it(`should return an empty array when everything is embedded`, async () => {
      ;(mocks.selectOrderByFn as any).mockReturnValueOnce(Promise.resolve([]))

      const result = await service.listUnembedded(`og_org0001`, `ag_agent01`)

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
    })

    it(`should return the error when the query throws`, async () => {
      ;(mocks.selectOrderByFn as any).mockImplementationOnce(() =>
        Promise.reject(new Error(`query failed`))
      )

      const result = await service.listUnembedded(`og_org0001`, `ag_agent01`)

      expect(result.data).toBeUndefined()
      expect(result.error?.message).toBe(`query failed`)
    })
  })

  // ---------- getRoadmap ----------
  describe(`getRoadmap`, () => {
    it(`should return the latest roadmap memory`, async () => {
      const row = fakeMemoryRow({ kind: `roadmap`, text: `Q3: ship memories` })
      mocks.selectLimitFn.mockResolvedValue([row])

      const result = await service.getRoadmap(`og_org0001`, `ag_agent01`)

      expect(result.data).toBeInstanceOf(MemoryModel)
      expect(result.data?.kind).toBe(`roadmap`)
      expect(result.data?.text).toBe(`Q3: ship memories`)

      const where = render(mocks.selectWhereFn.mock.calls[0][0])
      expect(where.params).toContain(`roadmap`)
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(`ag_agent01`)
      expect(mocks.selectLimitFn).toHaveBeenCalledWith(1)
    })

    it(`should return an empty response when no roadmap exists`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      const result = await service.getRoadmap(`og_org0001`, `ag_agent01`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it(`should return the error when the query throws`, async () => {
      mocks.selectLimitFn.mockRejectedValue(new Error(`query failed`))

      const result = await service.getRoadmap(`og_org0001`, `ag_agent01`)

      expect(result.error?.message).toBe(`query failed`)
    })
  })

  // ---------- upsertRoadmap ----------
  describe(`upsertRoadmap`, () => {
    it(`should create a NEW roadmap row (history preserved)`, async () => {
      const row = fakeMemoryRow({ kind: `roadmap`, text: `Q3: ship memories` })
      mocks.returningFn.mockResolvedValue([row])

      const result = await service.upsertRoadmap(
        `og_org0001`,
        `ag_agent01`,
        `Q3: ship memories`,
        { scheduleId: `sd_abc1234` }
      )

      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.valuesFn).toHaveBeenCalledWith({
        orgId: `og_org0001`,
        agentId: `ag_agent01`,
        text: `Q3: ship memories`,
        meta: { scheduleId: `sd_abc1234` },
        kind: `roadmap`,
      })
      expect(result.data).toBeInstanceOf(MemoryModel)
      expect(result.data?.kind).toBe(`roadmap`)
    })

    it(`should return the error when the insert throws`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`insert failed`))

      const result = await service.upsertRoadmap(`og_org0001`, `ag_agent01`, `text`)

      expect(result.error).toBeDefined()
    })
  })
})
