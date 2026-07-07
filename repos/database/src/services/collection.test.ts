import { Collection } from './collection'
import { PgDialect } from 'drizzle-orm/pg-core'
import { Collection as CollectionModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * A single chainable, thenable mock node. Every builder method returns the same
 * node; awaiting the node shifts the next queued result (or rejects it when the
 * queued value is an Error). Covers all chain shapes the service uses:
 *   select -> from -> where -> (orderBy) -> (limit)
 *   insert -> values -> returning
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
  id: `col_abc1234`,
  projectId: `pj_proj001`,
  name: `proposals`,
  description: null,
  schema: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Collection service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Collection

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Collection({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the collections table`, () => {
    expect(service).toBeInstanceOf(Collection)
    expect(service.name).toBe(`collections`)
  })

  it(`create returns a CollectionModel`, async () => {
    mocks.enqueue([fakeCollectionRow()])
    const res = await service.create({
      projectId: `pj_proj001`,
      name: `proposals`,
    } as any)
    expect(res.data).toBeInstanceOf(CollectionModel)
    expect(res.data?.name).toBe(`proposals`)
  })

  it(`enforces (projectId, name) uniqueness — a duplicate insert surfaces a 409`, async () => {
    mocks.enqueue(Object.assign(new Error(`dup`), { cause: { code: `23505` } }))
    const res = await service.create({
      projectId: `pj_proj001`,
      name: `proposals`,
    } as any)
    expect(res.status).toBe(409)
    expect(res.error?.message).toMatch(/already exists/)
  })

  it(`getByName scopes to (projectId, name) and models the row`, async () => {
    mocks.enqueue([fakeCollectionRow()])
    const res = await service.getByName(`pj_proj001`, `proposals`)

    const where = render(mocks.chain.where.mock.calls[0][0])
    expect(where.params).toContain(`pj_proj001`)
    expect(where.params).toContain(`proposals`)
    expect(res.data).toBeInstanceOf(CollectionModel)
  })

  it(`getByName returns {} when no collection matches`, async () => {
    mocks.enqueue([])
    const res = await service.getByName(`pj_proj001`, `missing`)
    expect(res.data).toBeUndefined()
  })

  it(`listByProject scopes to the project and returns models`, async () => {
    mocks.enqueue([
      fakeCollectionRow(),
      fakeCollectionRow({ id: `col_two0001`, name: `strategies` }),
    ])
    const res = await service.listByProject(`pj_proj001`)

    const where = render(mocks.chain.where.mock.calls[0][0])
    expect(where.params).toContain(`pj_proj001`)
    expect(res.data).toHaveLength(2)
    res.data?.forEach((row) => expect(row).toBeInstanceOf(CollectionModel))
  })
})
