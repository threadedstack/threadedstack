import type { Base as BaseModel } from '@tdsk/domain'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type {
  IDBApi,
  TDBApiRes,
  TDBQueryOpts,
  TTableSchema,
  TDBEntitySelect,
  TDBEntityInsert,
} from '@TDB/types'

import { eq } from 'drizzle-orm'
import { logger } from '@TDB/utils/logger'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isStr } from '@keg-hub/jsutils/isStr'
import { exists } from '@keg-hub/jsutils/exists'
import { DBIdError, DBValueError } from '@TDB/utils/error/error'
import { buildQuery } from '@TDB/utils/database/buildQuery'

export type TBase = {
  db: NodePgDatabase
  table: TTableSchema
  config?: Record<string, any>
}

export class Base<
  TTable extends TTableSchema,
  S extends TDBEntitySelect = TDBEntitySelect,
  I extends TDBEntityInsert = TDBEntityInsert,
  M extends BaseModel = BaseModel,
> implements IDBApi<M, I>
{
  table: TTable
  db: NodePgDatabase
  config: Record<string, any>

  constructor(opts: TBase) {
    this.db = opts.db
    this.table = opts.table
    this.config = opts.config || {}
  }

  model = (data: S, ...args: any[]): M => {
    const owner = this.constructor.name
    logger.error(`Warning, the ${owner} class should override this function!`)
    return data as unknown as M
  }

  create = async (data: I, opts?: TDBQueryOpts): Promise<TDBApiRes<M>> => {
    try {
      const resp = await this.db.insert(this.table).values(data).returning()

      return { data: this.model(resp[0]) as M }
    } catch (error: any) {
      return { error }
    }
  }

  by = async (
    prop: string | Record<string, any>,
    value?: any | TDBQueryOpts,
    opts?: TDBQueryOpts
  ): Promise<TDBApiRes<M>> => {
    let property: string
    if (isStr(prop)) property = prop
    else {
      property = prop[Object.keys(prop)[0]]
      if (isObj(value) && !opts) opts = value as TDBQueryOpts
      value = prop[property]
    }

    if (!exists(value)) {
      const owner = this.constructor.name
      return { error: new DBValueError(`${owner}.by`) }
    }

    try {
      const resp = await this.db
        .select()
        .from(this.table as TTableSchema)
        .where(eq(this.table[property], value))
        .limit(1)
      return { data: this.model(resp[0]) as M }
    } catch (error: any) {
      return { error }
    }
  }

  get = async (id: string, opts?: TDBQueryOpts): Promise<TDBApiRes<M>> => {
    try {
      const resp = await this.db
        .select()
        .from(this.table as TTableSchema)
        .where(eq(this.table.id, id))

      return { data: this.model(resp[0]) as M }
    } catch (error: any) {
      return { error }
    }
  }

  list = async (opts?: TDBQueryOpts): Promise<TDBApiRes<M[]>> => {
    try {
      let query = this.db.select().from(this.table as TTableSchema)
      query = buildQuery(query, this.table, opts)

      const resp = await query
      return { data: resp.map((item) => this.model(item)) as M[] }
    } catch (error: any) {
      return { error }
    }
  }

  update = async (data: I, opts?: TDBQueryOpts): Promise<TDBApiRes<M>> => {
    try {
      const id = data.id
      !id && DBIdError.throw()

      const resp = await this.db
        .update(this.table)
        .set(data)
        .where(eq(this.table.id, id))
        .returning()

      return { data: this.model(resp[0]) as M }
    } catch (error: any) {
      return { error }
    }
  }

  upsert = async (data: I, opts?: TDBQueryOpts): Promise<TDBApiRes<M>> => {
    try {
      const id = data.id
      !id && DBIdError.throw()

      const resp = await this.db
        .insert(this.table)
        .values(data)
        .onConflictDoUpdate({
          set: data,
          target: this.table.id,
        })
        .returning()

      return { data: this.model(resp[0]) as M }
    } catch (error: any) {
      return { error }
    }
  }

  delete = async (id: string, opts?: TDBQueryOpts): Promise<TDBApiRes<M>> => {
    try {
      const resp = await this.db
        .delete(this.table)
        .where(eq(this.table.id, id))
        .returning()

      return { data: this.model(resp[0]) as M }
    } catch (error: any) {
      return { error }
    }
  }
}
