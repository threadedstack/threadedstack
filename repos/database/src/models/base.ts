import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import type {
  IDBApi,
  TDBApiRes,
  TDBSelectOpts,
  TDBEntitySelect,
  TDBEntityInsert,
} from '@TDB/types'

import { eq } from 'drizzle-orm'
import { DBIdError } from '@TDB/utils/error/error'

type TTableWithId = {
  id: any
}

type TTableSchema = PgTableWithColumns<any> & TTableWithId

export type TBase = {
  db: NodePgDatabase
  schema: TTableSchema
  config?: Record<string, any>
}

export class Base<
  TSchema extends TTableSchema,
  S extends TDBEntitySelect = TDBEntitySelect,
  I extends TDBEntityInsert = TDBEntityInsert,
> implements IDBApi<S, I>
{
  schema: TSchema
  db: NodePgDatabase
  config: Record<string, any>

  constructor(opts: TBase) {
    this.db = opts.db
    this.schema = opts.schema
    this.config = opts.config || {}
  }

  create = async (data: I, opts?: TDBSelectOpts): Promise<TDBApiRes<S>> => {
    try {
      const resp = await this.db.insert(this.schema).values(data).returning()

      return { data: resp[0] as S }
    } catch (error: any) {
      return { error }
    }
  }

  get = async (id: string, opts?: TDBSelectOpts): Promise<TDBApiRes<S>> => {
    try {
      const resp = await this.db
        .select()
        .from(this.schema as TTableSchema)
        .where(eq(this.schema.id, id))

      return { data: resp[0] as S }
    } catch (error: any) {
      return { error }
    }
  }

  list = async (opts?: TDBSelectOpts): Promise<TDBApiRes<S[]>> => {
    try {
      // TODO: Expand this to handle `opts` for limit/offset
      const resp = await this.db.select().from(this.schema as TTableSchema)
      return { data: resp as S[] }
    } catch (error: any) {
      return { error }
    }
  }

  update = async (data: I, opts?: TDBSelectOpts): Promise<TDBApiRes<S>> => {
    try {
      const id = data.id
      !id && DBIdError.throw()

      const resp = await this.db
        .update(this.schema)
        .set(data)
        .where(eq(this.schema.id, id))
        .returning()

      return { data: resp[0] as S }
    } catch (error: any) {
      return { error }
    }
  }

  upsert = async (data: I, opts?: TDBSelectOpts): Promise<TDBApiRes<S>> => {
    try {
      const id = data.id
      !id && DBIdError.throw()

      const resp = await this.db
        .insert(this.schema)
        .values(data)
        .onConflictDoUpdate({
          set: data,
          target: this.schema.id,
        })
        .returning()

      return { data: resp[0] as S }
    } catch (error: any) {
      return { error }
    }
  }

  delete = async (id: string, opts?: TDBSelectOpts): Promise<TDBApiRes<S>> => {
    try {
      const resp = await this.db
        .delete(this.schema)
        .where(eq(this.schema.id, id))
        .returning()

      return { data: resp[0] as S }
    } catch (error: any) {
      return { error }
    }
  }
}
