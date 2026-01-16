import type { PgSelectBase } from 'drizzle-orm/pg-core'
import type { TDBQueryOpts, TTableSchema } from '@TDB/types'

import { isArr } from '@keg-hub/jsutils/isArr'
import type { SQL } from 'drizzle-orm'
import { eq, and, inArray, asc, desc } from 'drizzle-orm'

type TQuery = PgSelectBase<any, any, any>

const addWhere = <Q extends TQuery = TQuery>(
  query: Q,
  table: TTableSchema,
  opts: TDBQueryOpts
) => {
  const conditions: SQL[] = []

  for (const [key, value] of Object.entries(opts.where)) {
    if (value === undefined || value === null) continue

    const column = table[key]
    if (!column) continue

    isArr(value)
      ? value.length > 0 && conditions.push(inArray(column, value))
      : conditions.push(eq(column, value))
  }

  if (conditions.length > 0) query = query.where(and(...conditions)) as any

  return query
}

const addOrderBy = <Q extends TQuery = TQuery>(
  query: Q,
  table: TTableSchema,
  opts: TDBQueryOpts
) => {
  const column = table[opts.orderBy.column]
  if (column) {
    const orderFn = opts.orderBy.direction === 'desc' ? desc : asc
    query = query.orderBy(orderFn(column)) as any
  }

  return query
}

export const buildQuery = <Q extends TQuery = TQuery>(
  query: Q,
  table: TTableSchema,
  opts: TDBQueryOpts
) => {
  if (opts?.where) query = addWhere(query, table, opts)
  if (opts?.orderBy?.column) query = addOrderBy(query, table, opts)

  if (opts?.limit !== undefined) query = query.limit(opts.limit) as any
  if (opts?.offset !== undefined) query = query.offset(opts.offset) as any

  return query
}
