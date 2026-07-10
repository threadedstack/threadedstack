import type {
  TDatabase,
  TServiceOpts,
  TDBApiResType,
  TDBRecordSelect,
  TDBCollectionSelect,
} from '@TDB/types'
import type { TAnyObj, TRecordQuery, TCollectionSchema } from '@tdsk/domain'

import { eq, and, sql, desc, count } from 'drizzle-orm'
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

  /**
   * Atomic guarded replace: overwrite an existing record's `data` by id ONLY if
   * the row's current data does NOT already carry `markerKey` equal to the JSON
   * `true`. The predicate and the write are ONE statement (a single UPDATE with
   * a row lock), so a concurrent writer that sets the marker between a caller's
   * read and this call cannot be clobbered — the WHERE simply excludes the row
   * and `{ skipped: true }` is returned instead. Used by the resident-config
   * reconcile to never overwrite a config the agent claimed ownership of
   * (`evolvedByAgent: true`) in the read-then-write race window. `markerKey` is
   * bound as a parameter (never interpolated), so it is injection-safe.
   */
  async replaceIfMarkerUnset(
    projectId: string,
    collectionName: string,
    id: string,
    markerKey: string,
    data: TAnyObj
  ): Promise<TDBApiResType<RecordModel> & { skipped?: boolean }> {
    try {
      const collection = await this.#resolveCollection(projectId, collectionName)
      if (!collection) return { error: new DBError(`Collection not found`), status: 404 }

      if (collection.schema && Array.isArray(collection.schema)) {
        const invalid = this.#validateData(data, collection.schema)
        if (invalid) return { error: new DBError(invalid), status: 400 }
      }

      const [row] = await this.db
        .update(records)
        .set({ data, updatedAt: new Date() })
        .where(
          and(
            eq(records.id, id),
            eq(records.collectionId, collection.id),
            eq(records.projectId, projectId),
            // marker absent (NULL) or not 'true' → eligible; 'true' → excluded.
            sql`(${records.data} ->> ${markerKey}) IS DISTINCT FROM 'true'`
          )
        )
        .returning()

      // No row updated → the guard blocked it (marker was set concurrently).
      return row ? { data: this.model(row as TDBRecordSelect) } : { skipped: true }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Atomic compare-and-set on a record's data — the concurrency primitive
   * behind claim/lease coordination (exactly one concurrent caller can win a
   * given transition).
   *
   * Applies `patch` (a jsonb MERGE into data, not a replace) ONLY when every
   * `match` field currently equals its expected value; `null` matches an
   * absent/SQL-NULL field. All comparisons run inside a single UPDATE, so two
   * racing callers can never both succeed: the loser gets `{ conflict: true }`
   * (also returned when the id does not exist — either way the caller did not
   * win the record).
   *
   * `match` must be non-empty — an unconditional merge is an upsert, not a CAS,
   * and an accidentally-empty guard would silently drop the race protection.
   * Match values must be SCALARS or null (jsonb `->>` text-compares; an
   * object/array expected value can never compare meaningfully). Patch fields
   * present in the collection schema are type-checked; required fields absent
   * from the patch are fine (they already exist on the record).
   *
   * MERGE IS SHALLOW (`data || patch`): an object or array value in `patch`
   * REPLACES the stored value wholesale. To append (e.g. a history log), read
   * the record, build the full new array, and CAS it guarded on a field that
   * changes with the transition.
   */
  async casUpdate(
    projectId: string,
    collectionName: string,
    id: string,
    // Inline index signature (not the `Record` utility) — this class is itself
    // named `Record`, which shadows the TS built-in inside the class body.
    match: { [key: string]: string | number | boolean | null },
    patch: TAnyObj
  ): Promise<TDBApiResType<RecordModel> & { conflict?: boolean }> {
    try {
      // Shape-guard both inputs at the trust boundary: callers are isolate
      // (LLM-authored) Function bodies, so a wrong shape must surface as a
      // clear 400 — not an opaque Postgres error (non-object patch) and never
      // nonsense guards that masquerade as a permanent conflict (array/string
      // match → Object.keys index keys).
      const isPlainObject = (value: unknown): boolean =>
        typeof value === `object` && value !== null && !Array.isArray(value)

      if (!isPlainObject(match))
        return { error: new DBError(`casUpdate requires a match object`), status: 400 }
      if (!isPlainObject(patch))
        return { error: new DBError(`casUpdate requires a patch object`), status: 400 }

      const matchKeys = Object.keys(match)
      if (!matchKeys.length)
        return {
          error: new DBError(`casUpdate requires at least one match condition`),
          status: 400,
        }

      for (const key of matchKeys) {
        const expected = match[key]
        if (expected !== null && typeof expected === `object`)
          return {
            error: new DBError(
              `casUpdate match values must be scalars or null (field "${key}")`
            ),
            status: 400,
          }
      }

      const collection = await this.#resolveCollection(projectId, collectionName)
      if (!collection) return { error: new DBError(`Collection not found`), status: 404 }

      if (collection.schema && Array.isArray(collection.schema)) {
        const invalid = this.#validatePatch(patch, collection.schema)
        if (invalid) return { error: new DBError(invalid), status: 400 }
      }

      // jsonb `->>` yields text, so every expected value compares as its
      // String() form ('5', 'true') — keys and values are bound parameters.
      const guards = matchKeys.map((key) =>
        match[key] === null
          ? sql`(${records.data} ->> ${key}) IS NULL`
          : sql`(${records.data} ->> ${key}) = ${String(match[key])}`
      )

      const [row] = await this.db
        .update(records)
        .set({
          data: sql`${records.data} || ${JSON.stringify(patch)}::jsonb`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.id, id),
            eq(records.collectionId, collection.id),
            eq(records.projectId, projectId),
            ...guards
          )
        )
        .returning()

      return row ? { data: this.model(row as TDBRecordSelect) } : { conflict: true }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Validate only the fields PRESENT in a partial patch against the schema —
   * type checks apply, but required fields absent from the patch are not
   * errors (they already exist on the stored record the patch merges into).
   */
  #validatePatch(patch: TAnyObj, schema: TCollectionSchema): string | null {
    const present = schema.filter((field) => patch?.[field.name] !== undefined)
    for (const field of present) {
      const value = patch[field.name]
      if (value === null) continue

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

  /**
   * Record counts for every collection in a project, keyed by collectionId.
   * A single grouped aggregate (not N per-collection queries) — used by the
   * collections list endpoint. Collections with zero records are simply
   * absent from the returned map.
   */
  async countsByProject(
    projectId: string
  ): Promise<TDBApiResType<{ [collectionId: string]: number }>> {
    try {
      const rows = await this.db
        .select({ collectionId: records.collectionId, value: count() })
        .from(records)
        .where(eq(records.projectId, projectId))
        .groupBy(records.collectionId)

      const counts: { [collectionId: string]: number } = {}
      for (const row of rows) counts[row.collectionId] = Number(row.value)

      return { data: counts }
    } catch (error: any) {
      return { error }
    }
  }
}
