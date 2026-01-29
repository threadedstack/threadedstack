import type { PgSelectBase } from 'drizzle-orm/pg-core'
import type { TDBQueryOpts, TTableSchema } from '@TDB/types'

import { isArr } from '@keg-hub/jsutils/isArr'
import type { SQL } from 'drizzle-orm'
import { eq, and, inArray, asc, desc } from 'drizzle-orm'

type TQuery = PgSelectBase<any, any, any>

export const addWhere = (table: TTableSchema, opts: TDBQueryOpts) => {
  const conditions: SQL[] = []

  for (const [key, value] of Object.entries(opts.where)) {
    if (value === undefined || value === null) continue

    const column = table[key]
    if (!column) continue

    isArr(value)
      ? value.length > 0 && conditions.push(inArray(column, value))
      : conditions.push(eq(column, value))
  }

  return conditions
}

export const addOrderBy = (table: TTableSchema, opts: TDBQueryOpts) => {
  const column = table[opts.orderBy.column]
  if (!column) return

  const orderFn = opts.orderBy.direction === `desc` ? desc : asc
  return orderFn(column)
}

export const buildQuery = <Q extends TQuery = TQuery>(
  query: Q,
  table: TTableSchema,
  opts: TDBQueryOpts
) => {
  if (opts?.where) {
    const conditions = addWhere(table, opts)
    if (conditions.length > 0) query = query.where(and(...conditions)) as any
  }

  if (opts?.orderBy?.column) {
    const ordered = addOrderBy(table, opts)
    query = query.orderBy(ordered) as any
  }

  if (opts?.limit !== undefined) query = query.limit(opts.limit) as any
  if (opts?.offset !== undefined) query = query.offset(opts.offset) as any

  return query
}
