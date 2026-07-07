import type { SQL } from 'drizzle-orm'
import type { TRecordQuery, TCollectionSchema, TRecordQueryFilter } from '@tdsk/domain'

import { sql } from 'drizzle-orm'
import { EQueryOp } from '@tdsk/domain'

/**
 * Injection-safe compiler for the small record query API.
 *
 * SECURITY: field names are the only identifier that comes from the caller.
 * They are (1) validated against a strict identifier charset, (2) validated
 * against the collection schema when one exists, and (3) placed into SQL as a
 * BOUND PARAMETER via `sql`(data ->> ${field})`` — never string-concatenated.
 * Every filter value is likewise a bound parameter. The ONLY raw SQL token is a
 * whitelisted comparison operator (never derived from untrusted input).
 * `sql.raw` is used exclusively for those whitelisted tokens.
 */

/** Hard cap on the number of records a single query may return. */
export const RecordQueryMaxLimit = 100

/** Default number of records returned when a query omits `limit`. */
export const RecordQueryDefaultLimit = 50

/** A safe SQL identifier: a letter/underscore start, then word chars only. */
const FieldPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Whitelisted SQL comparison token per scalar operator. This map is the ONLY
 * place a raw token is emitted, and it is keyed by the fixed EQueryOp set.
 */
const ScalarOpTokens: Partial<Record<EQueryOp, string>> = {
  [EQueryOp.eq]: `=`,
  [EQueryOp.ne]: `<>`,
  [EQueryOp.gt]: `>`,
  [EQueryOp.gte]: `>=`,
  [EQueryOp.lt]: `<`,
  [EQueryOp.lte]: `<=`,
}

/** The compiled, safe pieces of a record query, ready for the record service
 * to combine with its own project/collection scoping conditions. */
export type TCompiledRecordQuery = {
  where: SQL[]
  orderBy?: SQL
  limit: number
  offset: number
}

/**
 * Validate a query field name. Must be a safe identifier and, when the
 * collection declares a schema, one of the schema's field names. Throws on any
 * violation so a malicious field can never reach the SQL string.
 */
const validateField = (field: unknown, schema?: TCollectionSchema): string => {
  if (typeof field !== `string` || !FieldPattern.test(field))
    throw new Error(`Invalid field: ${String(field)}`)

  if (schema && schema.length) {
    const allowed = schema.some((entry) => entry.name === field)
    if (!allowed)
      throw new Error(`Invalid field: ${field} is not in the collection schema`)
  }

  return field
}

/** Compile a single filter predicate to a bound-parameter SQL condition. */
const compileFilter = (filter: TRecordQueryFilter, schema?: TCollectionSchema): SQL => {
  const field = validateField(filter.field, schema)
  const { op, value } = filter

  if (op === EQueryOp.in) {
    if (!Array.isArray(value)) throw new Error(`Operator "in" requires an array value`)
    if (value.length === 0) return sql`false`

    const items = sql.join(
      value.map((item) => sql`${String(item)}`),
      sql`, `
    )
    return sql`(data ->> ${field}) in (${items})`
  }

  if (op === EQueryOp.contains) {
    // jsonb containment: does `data` contain the { field: value } pair? The
    // field lives inside a JSON object that is bound as a single param, so it
    // is data — never SQL.
    const containment = JSON.stringify({ [field]: value })
    return sql`data @> ${containment}::jsonb`
  }

  const token = ScalarOpTokens[op]
  if (!token) throw new Error(`Unsupported operator: ${String(op)}`)

  // data ->> field yields text; compare against the bound value as text.
  return sql`(data ->> ${field}) ${sql.raw(token)} ${String(value)}`
}

/**
 * Compile a TRecordQuery into safe SQL pieces. `schema` (when the collection
 * declares one) further restricts valid field names. Throws on any invalid or
 * malicious field, before any query executes.
 */
export const compileRecordQuery = (
  query: TRecordQuery = {},
  schema?: TCollectionSchema
): TCompiledRecordQuery => {
  const where: SQL[] = (query.where ?? []).map((filter) => compileFilter(filter, schema))

  let orderBy: SQL | undefined
  if (query.orderBy) {
    const field = validateField(query.orderBy.field, schema)
    const direction = query.orderBy.direction === `desc` ? `desc` : `asc`
    orderBy = sql`(data ->> ${field}) ${sql.raw(direction)}`
  }

  const rawLimit = typeof query.limit === `number` ? query.limit : RecordQueryDefaultLimit
  const limit = Math.max(0, Math.min(Math.floor(rawLimit), RecordQueryMaxLimit))

  const rawOffset = typeof query.offset === `number` ? query.offset : 0
  const offset = Math.max(0, Math.floor(rawOffset))

  return { where, orderBy, limit, offset }
}
