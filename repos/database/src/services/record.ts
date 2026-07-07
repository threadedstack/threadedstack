import type {
  TDatabase,
  TServiceOpts,
  TDBApiResType,
  TDBRecordSelect,
  TDBCollectionSelect,
} from '@TDB/types'
import type { TAnyObj, TRecordQuery, TCollectionSchema } from '@tdsk/domain'

import { eq, and, desc, count } from 'drizzle-orm'
import { records } from '@TDB/schemas/records'
import { collections } from '@TDB/schemas/collections'
import { EFieldType } from '@tdsk/domain'
import { DBError } from '@TDB/utils/error/error'
import { Record as RecordModel } from '@tdsk/domain'
import { compileRecordQuery } from '@TDB/utils/database/recordQuery'

/** A record write — an optional id (create-or-replace) plus the JSON document. */
type TRecordUpsertInput = {
  id?: string
  data: TAnyObj
}

/**
 * Record service — project + collection-scoped access to record documents.
 *
 * Every method resolves the target collection by (projectId, name) first, then
 * operates ONLY on records carrying that collectionId AND projectId, so a caller
 * can never read or write another project's records. Reads go through the
 * injection-safe `compileRecordQuery`. Standalone (not a Base subclass): its
 * scoped `upsert`/`get`/`delete` signatures intentionally differ from Base's
 * id-based CRUD.
 */
export class Record {
  db: TDatabase
  config: TAnyObj

  constructor(opts: TServiceOpts) {
    this.db = opts.db
    this.config = opts.config || {}
  }

  model = (data: TDBRecordSelect) => new RecordModel(data as Partial<RecordModel>)

  /** Resolve a project's collection row by name, or null. Project-scoped. */
  async #resolveCollection(
    projectId: string,
    collectionName: string
  ): Promise<TDBCollectionSelect | null> {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(
        and(eq(collections.projectId, projectId), eq(collections.name, collectionName))
      )
      .limit(1)

    return (row as TDBCollectionSelect) ?? null
  }

  /**
   * Validate a document against a collection schema. Returns an error message
   * when a required field is missing or a present field has the wrong type,
   * else null.
   */
  #validateData(data: TAnyObj, schema: TCollectionSchema): string | null {
    for (const field of schema) {
      const value = data?.[field.name]

      if (value === undefined || value === null) {
        if (field.required) return `Missing required field: ${field.name}`
        continue
      }

      const ok =
        field.type === EFieldType.string
          ? typeof value === `string`
          : field.type === EFieldType.number
            ? typeof value === `number`
            : field.type === EFieldType.boolean
              ? typeof value === `boolean`
              : field.type === EFieldType.array
                ? Array.isArray(value)
                : field.type === EFieldType.object
                  ? typeof value === `object` && !Array.isArray(value)
                  : true

      if (!ok) return `Field "${field.name}" must be of type ${field.type}`
    }

    return null
  }

  /**
   * Create-or-replace a record by id within a project's collection. Validates
   * the document against the collection schema when one is present.
   */
  async upsert(
    projectId: string,
    collectionName: string,
    input: TRecordUpsertInput
  ): Promise<TDBApiResType<RecordModel>> {
    try {
      const collection = await this.#resolveCollection(projectId, collectionName)
      if (!collection) return { error: new DBError(`Collection not found`), status: 404 }

      if (collection.schema && Array.isArray(collection.schema)) {
        const invalid = this.#validateData(input.data, collection.schema)
        if (invalid) return { error: new DBError(invalid), status: 400 }
      }

      const values = {
        ...(input.id ? { id: input.id } : {}),
        data: input.data,
        collectionId: collection.id,
        projectId,
      }

      const [row] = await this.db
        .insert(records)
        .values(values)
        .onConflictDoUpdate({
          target: records.id,
          set: { data: input.data, updatedAt: new Date() },
        })
        .returning()

      return { data: this.model(row as TDBRecordSelect) }
    } catch (error: any) {
      return { error }
    }
  }

  /** A single record by id within a project's collection, or {} when absent. */
  async get(
    projectId: string,
    collectionName: string,
    id: string
  ): Promise<TDBApiResType<RecordModel>> {
    try {
      const collection = await this.#resolveCollection(projectId, collectionName)
      if (!collection) return {}

      const [row] = await this.db
        .select()
        .from(records)
        .where(
          and(
            eq(records.id, id),
            eq(records.collectionId, collection.id),
            eq(records.projectId, projectId)
          )
        )
        .limit(1)

      return row ? { data: this.model(row as TDBRecordSelect) } : {}
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Query a project's collection with the small, injection-safe query API.
   * Always scoped to the resolved collectionId AND the requesting projectId, so
   * another project's records can never be returned.
   */
  async query(
    projectId: string,
    collectionName: string,
    query: TRecordQuery = {}
  ): Promise<TDBApiResType<RecordModel[]>> {
    try {
      const collection = await this.#resolveCollection(projectId, collectionName)
      if (!collection) return { data: [] }

      const compiled = compileRecordQuery(query, collection.schema ?? undefined)

      const conditions = [
        eq(records.collectionId, collection.id),
        eq(records.projectId, projectId),
        ...compiled.where,
      ]

      const rows = await this.db
        .select()
        .from(records)
        .where(and(...conditions))
        .orderBy(compiled.orderBy ?? desc(records.createdAt))
        .limit(compiled.limit)
        .offset(compiled.offset)

      return { data: rows.map((row) => this.model(row as TDBRecordSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /** Delete a record by id within a project's collection. {} when absent. */
  async delete(
    projectId: string,
    collectionName: string,
    id: string
  ): Promise<TDBApiResType<RecordModel>> {
    try {
      const collection = await this.#resolveCollection(projectId, collectionName)
      if (!collection) return {}

      const [row] = await this.db
        .delete(records)
        .where(
          and(
            eq(records.id, id),
            eq(records.collectionId, collection.id),
            eq(records.projectId, projectId)
          )
        )
        .returning()

      return row ? { data: this.model(row as TDBRecordSelect) } : {}
    } catch (error: any) {
      return { error }
    }
  }

  /** Count records in a project's collection. 0 when the collection is absent. */
  async count(projectId: string, collectionName: string): Promise<TDBApiResType<number>> {
    try {
      const collection = await this.#resolveCollection(projectId, collectionName)
      if (!collection) return { data: 0 }

      const [row] = await this.db
        .select({ value: count() })
        .from(records)
        .where(
          and(eq(records.collectionId, collection.id), eq(records.projectId, projectId))
        )

      return { data: Number(row?.value ?? 0) }
    } catch (error: any) {
      return { error }
    }
  }
}
