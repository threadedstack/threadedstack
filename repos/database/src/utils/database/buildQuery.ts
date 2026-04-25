import type { SQL } from 'drizzle-orm'
import type { TDBQueryOpts, TTableSchema } from '@TDB/types'

import { isArr } from '@keg-hub/jsutils/isArr'
import { eq, sql, inArray, asc, desc } from 'drizzle-orm'

export const addWhere = (table: TTableSchema, opts: TDBQueryOpts) => {
  const conditions: SQL[] = []

  if (!opts?.where) return conditions

  for (const [key, value] of Object.entries(opts.where)) {
    if (value === undefined || value === null) continue

    const column = table[key]
    if (!column) continue

    if (isArr(value)) {
      // Empty array means "match nothing" — push a false condition
      // to prevent silently dropping the filter and returning all rows
      value.length > 0
        ? conditions.push(inArray(column, value))
        : conditions.push(sql`false`)
    } else {
      conditions.push(eq(column, value))
    }
  }

  return conditions
}

export const addOrderBy = (table: TTableSchema, opts: TDBQueryOpts) => {
  const column = table[opts.orderBy.column]
  if (!column) return

  const orderFn = opts.orderBy.direction === `desc` ? desc : asc
  return orderFn(column)
}
