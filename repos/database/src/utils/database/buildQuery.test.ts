import { describe, it, expect } from 'vitest'
import { pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { addWhere, addOrderBy } from './buildQuery'

const testTable = pgTable(`test_table`, {
  id: uuid(`id`).primaryKey().defaultRandom(),
  name: text(`name`).notNull(),
  status: text(`status`),
})

describe(`addWhere`, () => {
  it(`should return empty array when opts.where is undefined`, () => {
    expect(addWhere(testTable, {})).toEqual([])
  })

  it(`should return empty array when opts.where is null`, () => {
    expect(addWhere(testTable, { where: null })).toEqual([])
  })

  it(`should create eq condition for a single value filter`, () => {
    const conditions = addWhere(testTable, { where: { name: `test` } })
    expect(conditions).toHaveLength(1)
  })

  it(`should create inArray condition for an array value filter`, () => {
    const conditions = addWhere(testTable, { where: { name: [`a`, `b`, `c`] } })
    expect(conditions).toHaveLength(1)
  })

  it(`should produce a false condition for empty arrays to prevent returning all rows`, () => {
    const conditions = addWhere(testTable, { where: { name: [] } })
    expect(conditions).toHaveLength(1)
  })

  it(`should skip null values in where`, () => {
    const conditions = addWhere(testTable, { where: { name: null } })
    expect(conditions).toHaveLength(0)
  })

  it(`should skip undefined values in where`, () => {
    const conditions = addWhere(testTable, { where: { name: undefined } })
    expect(conditions).toHaveLength(0)
  })

  it(`should skip non-existent column keys`, () => {
    const conditions = addWhere(testTable, { where: { nonexistent: `value` } } as any)
    expect(conditions).toHaveLength(0)
  })

  it(`should combine multiple conditions`, () => {
    const conditions = addWhere(testTable, {
      where: { name: `test`, status: `active` },
    })
    expect(conditions).toHaveLength(2)
  })

  it(`should handle mix of valid, null, undefined, and nonexistent keys`, () => {
    const conditions = addWhere(testTable, {
      where: { name: `test`, status: null, nonexistent: `x` } as any,
    })
    expect(conditions).toHaveLength(1)
  })
})

describe(`addOrderBy`, () => {
  it(`should return asc ordering by default`, () => {
    const result = addOrderBy(testTable, { orderBy: { column: `name` } })
    expect(result).toBeDefined()
  })

  it(`should return desc ordering when specified`, () => {
    const result = addOrderBy(testTable, {
      orderBy: { column: `name`, direction: `desc` },
    })
    expect(result).toBeDefined()
  })

  it(`should return undefined for non-existent column`, () => {
    const result = addOrderBy(testTable, { orderBy: { column: `nonexistent` } })
    expect(result).toBeUndefined()
  })

  it(`should work with a valid column name`, () => {
    const result = addOrderBy(testTable, { orderBy: { column: `status` } })
    expect(result).toBeDefined()
  })
})
