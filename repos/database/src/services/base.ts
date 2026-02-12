import type { Base as BaseModel } from '@tdsk/domain'
import type {
  IDBApi,
  TDatabase,
  TDBApiRes,
  TDBQueryOpts,
  TTableSchema,
  TDBWithRecord,
  TDBEntitySelect,
  TDBEntityInsert,
} from '@TDB/types'

import { logger } from '@TDB/utils/logger'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isStr } from '@keg-hub/jsutils/isStr'
import { exists } from '@keg-hub/jsutils/exists'
import { eq, and, getTableName } from 'drizzle-orm'
import { singular } from '@keg-hub/jsutils/singular'
import { camelCase } from '@keg-hub/jsutils/camelCase'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { addWhere, addOrderBy } from '@TDB/utils/database/buildQuery'
import { DBError, DBIdError, DBValueError } from '@TDB/utils/error/error'

export type TBase = {
  db: TDatabase
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
  name: string
  title: string
  table: TTable
  db: TDatabase
  config: Record<string, any>

  constructor(opts: TBase) {
    this.db = opts.db
    this.table = opts.table
    this.config = opts.config || {}
    const tableName = getTableName(this.table)
    this.name = camelCase(tableName)
    this.title = capitalize(singular(tableName))
  }

  with = <T extends TDBWithRecord = TDBWithRecord>(opts: T): TDBWithRecord => opts

  model = (data: S, ...args: any[]): M => {
    logger.warn(
      `Warning, the ${this.constructor.name} class should override this function!`
    )
    return data as unknown as M
  }

  async create(data: I): Promise<TDBApiRes<M>> {
    try {
      const resp = await this.db.insert(this.table).values(data).returning()

      return { data: this.model(resp[0] as S) as M }
    } catch (error: any) {
      return { error }
    }
  }

  async by(
    prop: string | Record<string, any>,
    value?: any | Pick<TDBQueryOpts, `with`>,
    opts?: Pick<TDBQueryOpts, `with`>
  ): Promise<TDBApiRes<M>> {
    let property: string
    if (isStr(prop)) property = prop
    else {
      property = Object.keys(prop)[0]
      if (isObj(value) && !opts) opts = value as TDBQueryOpts
      value = prop[property]
    }

    if (!exists(value)) return { error: new DBValueError(`${this.title}.by`) }

    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table[property], value),
      })

      return row
        ? { data: this.model(row) }
        : { error: new DBError(`${this.title} not found`) }
    } catch (error: any) {
      return { error }
    }
  }

  async get(id: string, opts?: Pick<TDBQueryOpts, `with`>): Promise<TDBApiRes<M>> {
    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table.id, id),
      })

      return row
        ? { data: this.model(row) }
        : { error: new DBError(`${this.title} not found`) }
    } catch (error: any) {
      return { error }
    }
  }

  async list(opts: TDBQueryOpts = {}): Promise<TDBApiRes<M[]>> {
    const { where, limit, offset, orderBy } = opts

    try {
      const found = await this.db.query[this.name].findMany({
        limit,
        offset,
        with: this.with(opts?.with),
        orderBy: orderBy ? addOrderBy(this.table, opts) : undefined,
        where: where ? and(...addWhere(this.table, opts)) : undefined,
      })

      return found?.length
        ? { data: found.map((row) => this.model(row)) as M[] }
        : { data: [] }
    } catch (error: any) {
      return { error }
    }
  }

  async update(data: I): Promise<TDBApiRes<M>> {
    try {
      const id = data.id
      !id && DBIdError.throw()

      const resp = await this.db
        .update(this.table)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(this.table.id, id))
        .returning()

      if (!resp[0]) return { error: new DBError(`${this.title} not found`) }

      return { data: this.model(resp[0]) as M }
    } catch (error: any) {
      return { error }
    }
  }

  async upsert(data: I): Promise<TDBApiRes<M>> {
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

      if (!resp[0]) return { error: new DBError(`${this.title} not found`) }

      return { data: this.model(resp[0] as S) as M }
    } catch (error: any) {
      return { error }
    }
  }

  async delete(id: string): Promise<TDBApiRes<M>> {
    try {
      const resp = await this.db
        .delete(this.table)
        .where(eq(this.table.id, id))
        .returning()

      if (!resp[0]) return { error: new DBError(`${this.title} not found`) }

      return { data: this.model(resp[0] as S) as M }
    } catch (error: any) {
      return { error }
    }
  }
}
