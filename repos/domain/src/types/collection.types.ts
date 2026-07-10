/**
 * Collections / Records primitive type definitions.
 * A Collection is a project-scoped, optionally-schema'd set of Records; a Record
 * is a JSON document (`data`) with an id + timestamps. Agents and Functions
 * read/write these through one service with a small, injection-safe query API.
 * See docs/superpowers/specs/2026-07-07-collections-records-primitive-design.md
 */

/** The data types a collection schema field may declare. */
export enum EFieldType {
  string = `string`,
  number = `number`,
  boolean = `boolean`,
  object = `object`,
  array = `array`,
}

export type TFieldType = `${EFieldType}`

/** Comparison operators supported by the record query API. */
export enum EQueryOp {
  eq = `eq`,
  ne = `ne`,
  gt = `gt`,
  gte = `gte`,
  lt = `lt`,
  lte = `lte`,
  in = `in`,
  contains = `contains`,
}

export type TQueryOp = `${EQueryOp}`

/** A single field definition within a collection schema. */
export type TCollectionSchemaField = {
  name: string
  type: TFieldType
  required?: boolean
  indexed?: boolean
}

/**
 * A collection schema — an array of field definitions. When present on a
 * collection, record writes are validated against it and `indexed` fields may
 * get expression indexes; when absent, the collection is schemaless (any JSON).
 */
export type TCollectionSchema = TCollectionSchemaField[]

/** A single filter predicate in a record query. */
export type TRecordQueryFilter = {
  field: string
  op: EQueryOp
  value: unknown
}

/**
 * The small, safe query shape accepted by the record query API. Every field is
 * validated (safe-identifier charset + schema membership) and every value is a
 * bound parameter — nothing is string-interpolated into SQL.
 */
export type TRecordQuery = {
  where?: TRecordQueryFilter[]
  orderBy?: {
    field: string
    direction: `asc` | `desc`
  }
  limit?: number
  offset?: number
}

/**
 * A collection row as returned by the list endpoint — the Collection fields
 * plus its record count. `recordCount` is computed via an aggregate query
 * (not a stored column), and is list-only — `getCollection` does not include it.
 */
export type TCollectionWithCount = {
  id: string
  name: string
  description: string | null
  schema: TCollectionSchema | null
  projectId: string
  createdAt?: string | Date
  updatedAt?: string | Date
  recordCount: number
}
