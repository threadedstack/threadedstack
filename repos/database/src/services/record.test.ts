import { Record as RecordService } from './record'
import { PgDialect } from 'drizzle-orm/pg-core'
import { EQueryOp, EFieldType, Record as RecordModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * A single chainable, thenable mock node. Every builder method returns the same
 * node; awaiting the node shifts the next queued result. Each record method
 * resolves its collection first (one await) and then runs its records op (a
 * second await), so results are enqueued collection-first.
 */
const createMockDb = () => {
  const queue: any[] = []
  const enqueue = (...results: any[]) => {
    for (const result of results) queue.push(result)
  }

  const chain: any = {}
  const methods = [
    `from`,
    `where`,
    `orderBy`,
    `limit`,
    `offset`,
    `values`,
    `onConflictDoUpdate`,
    `returning`,
    `set`,
    `groupBy`,
  ]
  for (const method of methods) chain[method] = vi.fn(() => chain)
  chain.then = (resolve: any, reject: any) => {
    const next = queue.length ? queue.shift() : []
    return next instanceof Error ? reject(next) : resolve(next)
  }

  const selectFn = vi.fn(() => chain)
  const insertFn = vi.fn(() => chain)
  const updateFn = vi.fn(() => chain)
  const deleteFn = vi.fn(() => chain)

  const db = {
    select: selectFn,
    insert: insertFn,
    update: updateFn,
    delete: deleteFn,
    query: {
      collections: { findFirst: vi.fn(), findMany: vi.fn() },
      records: { findFirst: vi.fn(), findMany: vi.fn() },
    },
  } as any

  return { db, enqueue, chain, selectFn, insertFn, updateFn, deleteFn }
}

const fakeCollectionRow = (overrides: Record<string, any> = {}) => ({
  id: `col_items01`,
  projectId: `pj_projA0`,
  name: `items`,
  description: null,
  schema: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const fakeRecordRow = (overrides: Record<string, any> = {}) => ({
  id: `rec_r000001`,
  collectionId: `col_items01`,
  projectId: `pj_projA0`,
  data: { status: `open` },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Record service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: RecordService

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new RecordService({ db: mocks.db, config: {} } as any)
  })

  describe(`upsert`, () => {
    it(`creates a new record (no id) — insert values omit id, scoped to the collection + project`, async () => {
      mocks.enqueue([fakeCollectionRow()], [fakeRecordRow()])
      const res = await service.upsert(`pj_projA0`, `items`, {
        data: { status: `open` },
      })

      const values = mocks.chain.values.mock.calls[0][0]
      expect(values.id).toBeUndefined()
      expect(values.collectionId).toBe(`col_items01`)
      expect(values.projectId).toBe(`pj_projA0`)
      expect(res.data).toBeInstanceOf(RecordModel)
    })

    it(`replaces by id (id present) — insert values carry the id for onConflictDoUpdate`, async () => {
      mocks.enqueue([fakeCollectionRow()], [fakeRecordRow({ id: `rec_fixed01` })])
      const res = await service.upsert(`pj_projA0`, `items`, {
        id: `rec_fixed01`,
        data: { status: `closed` },
      })

      const values = mocks.chain.values.mock.calls[0][0]
      expect(values.id).toBe(`rec_fixed01`)
      expect(mocks.chain.onConflictDoUpdate).toHaveBeenCalledTimes(1)
      expect(res.data?.id).toBe(`rec_fixed01`)
    })

    it(`returns 404 when the collection does not exist (no insert runs)`, async () => {
      mocks.enqueue([])
      const res = await service.upsert(`pj_projA0`, `missing`, { data: {} })
      expect(res.status).toBe(404)
      expect(mocks.insertFn).not.toHaveBeenCalled()
    })

    it(`rejects a wrong-typed field against the collection schema (no insert runs)`, async () => {
      const schema = [{ name: `count`, type: EFieldType.number, required: true }]
      mocks.enqueue([fakeCollectionRow({ schema })])
      const res = await service.upsert(`pj_projA0`, `items`, {
        data: { count: `not-a-number` },
      })
      expect(res.status).toBe(400)
      expect(res.error?.message).toMatch(/must be of type number/)
      expect(mocks.insertFn).not.toHaveBeenCalled()
    })

    it(`accepts a well-typed document against the schema`, async () => {
      const schema = [{ name: `count`, type: EFieldType.number, required: true }]
      mocks.enqueue(
        [fakeCollectionRow({ schema })],
        [fakeRecordRow({ data: { count: 3 } })]
      )
      const res = await service.upsert(`pj_projA0`, `items`, { data: { count: 3 } })
      expect(res.data).toBeInstanceOf(RecordModel)
      expect(mocks.insertFn).toHaveBeenCalledTimes(1)
    })
  })

  describe(`query`, () => {
    it(`returns matching records as models`, async () => {
      mocks.enqueue(
        [fakeCollectionRow()],
        [fakeRecordRow(), fakeRecordRow({ id: `rec_r000002` })]
      )
      const res = await service.query(`pj_projA0`, `items`, {
        where: [{ field: `status`, op: EQueryOp.eq, value: `open` }],
      })
      expect(res.data).toHaveLength(2)
      res.data?.forEach((row) => expect(row).toBeInstanceOf(RecordModel))
    })

    it(`PROJECT-SCOPING isolation: a query as project B never targets project A's records`, async () => {
      // Project B resolves ITS OWN collection and queries only its own records.
      mocks.enqueue([fakeCollectionRow({ id: `col_itemsB`, projectId: `pj_projB0` })], [])
      const res = await service.query(`pj_projB0`, `items`, {})

      // collection resolution scoped to project B, never project A
      const resolveWhere = render(mocks.chain.where.mock.calls[0][0])
      expect(resolveWhere.params).toContain(`pj_projB0`)
      expect(resolveWhere.params).not.toContain(`pj_projA0`)

      // records query scoped to project B AND B's collection id, never project A
      const recordsWhere = render(mocks.chain.where.mock.calls[1][0])
      expect(recordsWhere.params).toContain(`pj_projB0`)
      expect(recordsWhere.params).toContain(`col_itemsB`)
      expect(recordsWhere.params).not.toContain(`pj_projA0`)

      expect(res.data).toEqual([])
    })

    it(`rejects a malicious query field — the compiler throws and no records query executes`, async () => {
      mocks.enqueue([fakeCollectionRow()])
      const res = await service.query(`pj_projA0`, `items`, {
        where: [{ field: `x'); drop table records;--`, op: EQueryOp.eq, value: `y` }],
      })
      expect(res.error).toBeDefined()
      expect(res.error?.message).toMatch(/Invalid field/)
      // only the collection resolution select ran; the records query never executed
      expect(mocks.selectFn).toHaveBeenCalledTimes(1)
    })

    it(`returns [] when the collection does not exist (no records query runs)`, async () => {
      mocks.enqueue([])
      const res = await service.query(`pj_projA0`, `missing`, {})
      expect(res.data).toEqual([])
      expect(mocks.selectFn).toHaveBeenCalledTimes(1)
    })
  })

  describe(`get / delete / count`, () => {
    it(`get scopes to id + collection + project`, async () => {
      mocks.enqueue([fakeCollectionRow()], [fakeRecordRow()])
      const res = await service.get(`pj_projA0`, `items`, `rec_r000001`)

      const where = render(mocks.chain.where.mock.calls[1][0])
      expect(where.params).toContain(`rec_r000001`)
      expect(where.params).toContain(`col_items01`)
      expect(where.params).toContain(`pj_projA0`)
      expect(res.data).toBeInstanceOf(RecordModel)
    })

    it(`delete removes a scoped record and returns it`, async () => {
      mocks.enqueue([fakeCollectionRow()], [fakeRecordRow()])
      const res = await service.delete(`pj_projA0`, `items`, `rec_r000001`)

      const where = render(mocks.chain.where.mock.calls[1][0])
      expect(where.params).toContain(`rec_r000001`)
      expect(where.params).toContain(`pj_projA0`)
      expect(mocks.deleteFn).toHaveBeenCalledTimes(1)
      expect(res.data).toBeInstanceOf(RecordModel)
    })

    it(`count returns the number of records scoped to the collection + project`, async () => {
      mocks.enqueue([fakeCollectionRow()], [{ value: 4 }])
      const res = await service.count(`pj_projA0`, `items`)
      expect(res.data).toBe(4)
    })
  })

  describe(`countsByProject`, () => {
    it(`returns a single grouped map of collectionId -> record count`, async () => {
      mocks.enqueue([
        { collectionId: `col_items01`, value: 4 },
        { collectionId: `col_notes01`, value: 1 },
      ])
      const res = await service.countsByProject(`pj_projA0`)

      expect(mocks.selectFn).toHaveBeenCalledTimes(1)
      expect(mocks.chain.groupBy).toHaveBeenCalledTimes(1)
      const where = render(mocks.chain.where.mock.calls[0][0])
      expect(where.params).toContain(`pj_projA0`)
      expect(res.data).toEqual({ col_items01: 4, col_notes01: 1 })
    })

    it(`omits collections with zero records — an empty groupBy result yields an empty map`, async () => {
      mocks.enqueue([])
      const res = await service.countsByProject(`pj_projA0`)
      expect(res.data).toEqual({})
    })

    it(`returns an error when the query throws`, async () => {
      mocks.enqueue(new Error(`db down`))
      const res = await service.countsByProject(`pj_projA0`)
      expect(res.error).toBeInstanceOf(Error)
    })
  })

  describe(`replaceIfMarkerUnset`, () => {
    it(`updates a scoped record under an atomic marker guard, binding the marker as a param`, async () => {
      mocks.enqueue([fakeCollectionRow()], [fakeRecordRow({ data: { status: `open` } })])
      const res = await service.replaceIfMarkerUnset(
        `pj_projA0`,
        `items`,
        `rec_r000001`,
        `evolvedByAgent`,
        { status: `open` }
      )

      expect(mocks.updateFn).toHaveBeenCalledTimes(1)
      // The write is scoped to id + collection + project AND guarded on the
      // marker, which is bound as a PARAM (never interpolated → injection-safe).
      const where = render(mocks.chain.where.mock.calls[1][0])
      expect(where.params).toContain(`rec_r000001`)
      expect(where.params).toContain(`col_items01`)
      expect(where.params).toContain(`pj_projA0`)
      expect(where.params).toContain(`evolvedByAgent`)
      expect(where.sql).toMatch(/IS DISTINCT FROM/i)
      expect(res.data).toBeInstanceOf(RecordModel)
      expect(res.skipped).toBeUndefined()
    })

    it(`reports skipped (no clobber) when the guard excludes the row`, async () => {
      // Update returns no row → the marker was already set concurrently.
      mocks.enqueue([fakeCollectionRow()], [])
      const res = await service.replaceIfMarkerUnset(
        `pj_projA0`,
        `items`,
        `rec_r000001`,
        `evolvedByAgent`,
        { status: `x` }
      )
      expect(res.skipped).toBe(true)
      expect(res.data).toBeUndefined()
    })

    it(`returns 404 when the collection does not exist (no update runs)`, async () => {
      mocks.enqueue([])
      const res = await service.replaceIfMarkerUnset(
        `pj_projA0`,
        `missing`,
        `rec_x`,
        `evolvedByAgent`,
        {}
      )
      expect(res.status).toBe(404)
      expect(mocks.updateFn).not.toHaveBeenCalled()
    })
  })
})
