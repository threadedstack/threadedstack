import { PgDialect } from 'drizzle-orm/pg-core'
import { EQueryOp, EFieldType } from '@tdsk/domain'
import { describe, it, expect } from 'vitest'
import {
  compileRecordQuery,
  RecordQueryMaxLimit,
  RecordQueryDefaultLimit,
} from './recordQuery'

/**
 * Renders a drizzle SQL fragment to { sql, params } so we can assert that
 * values AND the field identifier are BOUND PARAMETERS ($n) and never
 * string-interpolated into the SQL text.
 */
const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

describe(`compileRecordQuery`, () => {
  it(`(a) compiles a valid filter to parameterized SQL — value and field are bound params, not interpolated`, () => {
    const compiled = compileRecordQuery({
      where: [{ field: `status`, op: EQueryOp.eq, value: `open` }],
    })

    expect(compiled.where).toHaveLength(1)
    const q = render(compiled.where[0])

    // value is a bound param
    expect(q.params).toContain(`open`)
    // the FIELD is also a bound param (placed as a value, never concatenated)
    expect(q.params).toContain(`status`)
    // the jsonb extraction operator is present
    expect(q.sql).toContain(`data ->>`)
    // nothing is interpolated as a literal into the SQL text
    expect(q.sql).not.toContain(`open`)
    expect(q.sql).not.toContain(`status`)
    expect(q.sql).not.toContain(`'open'`)
  })

  it(`(b) rejects a malicious field name (SQL injection attempt) — throws Invalid field`, () => {
    expect(() =>
      compileRecordQuery({
        where: [{ field: `x'); drop table records;--`, op: EQueryOp.eq, value: `y` }],
      })
    ).toThrow(/Invalid field/)
  })

  it(`(b) rejects a field that is not one of the collection schema's field names`, () => {
    const schema = [
      { name: `status`, type: EFieldType.string },
      { name: `count`, type: EFieldType.number },
    ]

    // in-schema field is allowed
    expect(() =>
      compileRecordQuery(
        { where: [{ field: `status`, op: EQueryOp.eq, value: `open` }] },
        schema
      )
    ).not.toThrow()

    // a syntactically-valid identifier that is NOT in the schema is rejected
    expect(() =>
      compileRecordQuery(
        { where: [{ field: `password`, op: EQueryOp.eq, value: `x` }] },
        schema
      )
    ).toThrow(/Invalid field/)
  })

  it(`(c) maps each scalar operator to the correct SQL token with a bound value`, () => {
    const cases: Array<[EQueryOp, string]> = [
      [EQueryOp.eq, `=`],
      [EQueryOp.ne, `<>`],
      [EQueryOp.gt, `>`],
      [EQueryOp.gte, `>=`],
      [EQueryOp.lt, `<`],
      [EQueryOp.lte, `<=`],
    ]

    for (const [op, token] of cases) {
      const compiled = compileRecordQuery({
        where: [{ field: `amount`, op, value: 5 }],
      })
      const q = render(compiled.where[0])
      expect(q.sql).toContain(token)
      // value bound (rendered as text since data ->> yields text)
      expect(q.params).toContain(`5`)
      // field bound
      expect(q.params).toContain(`amount`)
    }
  })

  it(`(c) maps 'in' to an IN predicate with each element bound`, () => {
    const compiled = compileRecordQuery({
      where: [{ field: `status`, op: EQueryOp.in, value: [`open`, `closed`] }],
    })
    const q = render(compiled.where[0])
    expect(q.sql.toLowerCase()).toContain(` in (`)
    expect(q.params).toContain(`open`)
    expect(q.params).toContain(`closed`)
  })

  it(`(c) maps 'contains' to a jsonb containment (@>) predicate with a bound param`, () => {
    const compiled = compileRecordQuery({
      where: [{ field: `tags`, op: EQueryOp.contains, value: `urgent` }],
    })
    const q = render(compiled.where[0])
    expect(q.sql).toContain(`@>`)
    expect(q.params).toContain(JSON.stringify({ tags: `urgent` }))
  })

  it(`(d) throws when 'in' is given a non-array value`, () => {
    expect(() =>
      compileRecordQuery({
        where: [{ field: `status`, op: EQueryOp.in, value: `open` }],
      })
    ).toThrow(/requires an array/)
  })

  it(`(e) clamps limit to RecordQueryMaxLimit`, () => {
    expect(compileRecordQuery({ limit: 9999 }).limit).toBe(RecordQueryMaxLimit)
  })

  it(`(e) applies the default limit when none is given, and floors/guards offset`, () => {
    const compiled = compileRecordQuery({})
    expect(compiled.limit).toBe(RecordQueryDefaultLimit)
    expect(compiled.offset).toBe(0)

    const negative = compileRecordQuery({ limit: -5, offset: -3 })
    expect(negative.limit).toBe(0)
    expect(negative.offset).toBe(0)
  })

  it(`compiles a validated orderBy with a bound field and rejects a malicious orderBy field`, () => {
    const compiled = compileRecordQuery({
      orderBy: { field: `createdAtField`, direction: `desc` },
    })
    const q = render(compiled.orderBy)
    expect(q.sql).toContain(`data ->>`)
    expect(q.sql.toLowerCase()).toContain(`desc`)
    expect(q.params).toContain(`createdAtField`)

    expect(() =>
      compileRecordQuery({ orderBy: { field: `x; drop table`, direction: `asc` } })
    ).toThrow(/Invalid field/)
  })
})
