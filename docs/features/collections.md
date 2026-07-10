# Collections / Records

> **Last Updated**: July 2026

## Table of Contents

1. [What are Collections?](#1-what-are-collections)
2. [Architecture Overview](#2-architecture-overview)
3. [Key Concepts](#3-key-concepts)
4. [Managing Collections via the Admin API](#4-managing-collections-via-the-admin-api)
5. [Working with Records via the Admin API](#5-working-with-records-via-the-admin-api)
6. [The Query API](#6-the-query-api)
7. [Access Path: Agent Tools](#7-access-path-agent-tools)
8. [Access Path: Function `records` Capability](#8-access-path-function-records-capability)
9. [Access Path: `contextSources`](#9-access-path-contextsources)
10. [Schema Validation](#10-schema-validation)
11. [Limits and Constraints](#11-limits-and-constraints)
12. [Authentication and Permissions](#12-authentication-and-permissions)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. What are Collections?

Collections are a project-scoped, consumer-defined data store: a **Collection** is a named
set of **Records**, and a Record is a JSON document. They give agents, Functions, and
schedules a place to persist and query structured data without provisioning an external
database.

```mermaid
flowchart LR
  subgraph Proj["Project"]
    ColA["Collection: leads schema: name, email, status"]
    ColB["Collection: notes (schemaless)"]
    ColA --> RecA1["Record { name, email, status }"]
    ColA --> RecA2["Record { name, email, status }"]
    ColB --> RecB1["Record { any JSON }"]
  end
```

**When to use Collections:**
- Give an agent durable, queryable memory beyond a single conversation
- Let a Function persist results other Functions or agent runs read back
- Feed a schedule's cycle prompt with live data via `contextSources`, instead of hard-coding
  a context builder
- Build a lightweight CRUD app on top of ThreadedStack without an external database

**When not to use Collections:** the query API is intentionally small (filter/sort/limit) —
it is not a general SQL database. For complex joins or transactional workloads, use an
external database via a Proxy or FaaS endpoint instead.

---

## 2. Architecture Overview

All three access paths funnel through one host-side service, so scoping, validation, and
query semantics are identical no matter who reads or writes.

```mermaid
flowchart LR
  subgraph Platform
    COL["collections (project-scoped, optional schema)"]
    REC["records (jsonb documents)"]
    SVC["collectionService / recordService CRUD + safe query API"]
    COL --> REC
    SVC --> COL
    SVC --> REC
  end

  ADMIN["Admin API caller"] -->|"CRUD over HTTP"| SVC
  AGENT["Agent run"] -->|"collectionQuery / Get / Upsert / Delete tools"| SVC
  FUNC["Function (FaaS)"] -->|"injected context.records capability"| SVC
  SCHED["Schedule contextSources config"] -->|"executor runs + injects into prompt"| SVC
```

Every method is **project-scoped**: a caller can only read or write its own project's
collections. Records additionally carry a denormalized `projectId` and are always resolved
through `(projectId, collectionName)`, so a query in one project can never return another
project's records.

---

## 3. Key Concepts

### Collection

A named, project-scoped set of Records. Optionally carries a `schema` — an array of field
definitions. When a schema is present, record writes are validated against it. When absent,
the collection is schemaless (any JSON document is accepted).

### Record

A JSON document (`data`) with an `id` and timestamps, belonging to exactly one collection.
Records are created, replaced, fetched, queried, and deleted by `id`.

### Schema

An optional array of field definitions attached to a collection:

```typescript
type TCollectionSchemaField = {
  name: string
  type: `string` | `number` | `boolean` | `object` | `array`
  required?: boolean
  indexed?: boolean
}
```

When set, every record write is validated: a missing `required` field or a field with the
wrong type is rejected with a 400. `indexed` is a hint for future expression-index support;
it does not currently change query behavior.

### Query API

A small, injection-safe filter/sort/limit API (`TRecordQuery`) shared by all three access
paths — the admin API, agent tools, the Function capability, and `contextSources` all
compile through the same query compiler. See [§6](#6-the-query-api).

---

## 4. Managing Collections via the Admin API

Base path: `/_/orgs/<org-id>/projects/<project-id>/collections`

### Create a Collection

```bash
curl -X POST \
  "https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/collections" \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "leads",
    "description": "Inbound sales leads",
    "schema": [
      { "name": "email", "type": "string", "required": true },
      { "name": "status", "type": "string" }
    ]
  }'
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "col_a1b2c3d4e5",
    "name": "leads",
    "description": "Inbound sales leads",
    "schema": [
      { "name": "email", "type": "string", "required": true },
      { "name": "status", "type": "string" }
    ],
    "projectId": "proj-123",
    "createdAt": "2026-07-10T10:00:00.000Z",
    "updatedAt": "2026-07-10T10:00:00.000Z"
  }
}
```

### Collection Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | Yes | string | Unique within the project |
| `projectId` | Yes (from URL) | UUID | The owning project |
| `description` | No | string | Human-readable purpose |
| `schema` | No | array | Field definitions; omit for a schemaless collection |

### List / Get / Update / Delete

```bash
# List a project's collections
GET /_/orgs/<org-id>/projects/<project-id>/collections

# Get one collection by name
GET /_/orgs/<org-id>/projects/<project-id>/collections/leads

# Update (only provided fields change)
PUT /_/orgs/<org-id>/projects/<project-id>/collections/leads
{ "description": "Updated description" }

# Delete (cascades to its records)
DELETE /_/orgs/<org-id>/projects/<project-id>/collections/leads
```

Deleting a collection deletes all of its records via a foreign-key cascade — there is no
separate "empty the collection first" step.

---

## 5. Working with Records via the Admin API

Base path: `/_/orgs/<org-id>/projects/<project-id>/collections/<name>/records`

### Upsert a Record

`POST .../records` creates a record, or replaces it in place when `id` matches an existing
one (create-or-replace by id):

```bash
curl -X POST \
  "https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/collections/leads/records" \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "data": { "email": "alice@example.com", "status": "new" }
  }'
```

**Response (200 OK):**
```json
{
  "data": {
    "id": "rec_f6g7h8i9j0",
    "collectionId": "col_a1b2c3d4e5",
    "projectId": "proj-123",
    "data": { "email": "alice@example.com", "status": "new" },
    "createdAt": "2026-07-10T10:05:00.000Z",
    "updatedAt": "2026-07-10T10:05:00.000Z"
  }
}
```

To replace an existing record, pass its `id` in the body alongside the new `data`.

### Get / Delete a Record

```bash
GET    /_/orgs/<org-id>/projects/<project-id>/collections/leads/records/rec_f6g7h8i9j0
DELETE /_/orgs/<org-id>/projects/<project-id>/collections/leads/records/rec_f6g7h8i9j0
```

---

## 6. The Query API

`POST .../records/query` accepts a small, injection-safe query body (`TRecordQuery`):

```typescript
type TRecordQuery = {
  where?: Array<{
    field: string
    op: `eq` | `ne` | `gt` | `gte` | `lt` | `lte` | `in` | `contains`
    value: unknown
  }>
  orderBy?: { field: string; direction: `asc` | `desc` }
  limit?: number   // default 50, hard cap 100
  offset?: number  // default 0
}
```

### Example

```bash
curl -X POST \
  "https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/collections/leads/records/query" \
  -H "Authorization: Bearer tdsk_<api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "where": [{ "field": "status", "op": "eq", "value": "new" }],
    "orderBy": { "field": "email", "direction": "asc" },
    "limit": 25
  }'
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "rec_f6g7h8i9j0",
      "collectionId": "col_a1b2c3d4e5",
      "projectId": "proj-123",
      "data": { "email": "alice@example.com", "status": "new" },
      "createdAt": "2026-07-10T10:05:00.000Z",
      "updatedAt": "2026-07-10T10:05:00.000Z"
    }
  ]
}
```

### Why it's safe

Every filter `field` is validated against a strict identifier charset and, when the
collection declares a schema, against the schema's field names. Every value is bound as a
SQL parameter — nothing from the request body is ever string-interpolated into a query. The
`in` operator requires an array value; `contains` performs a `jsonb` containment check. A
malformed query (unknown field, bad operator, wrong value shape) is rejected with a 400
before any query runs.

---

## 7. Access Path: Agent Tools

Agents get four tools, gated by the `collections` feature flag and the standard
`agent.tools` allowlist (mirrors the memory tool provider):

| Tool | Purpose |
|------|---------|
| `collectionQuery` | `(collection, where?, orderBy?, limit?)` — filter/sort/limit a collection |
| `collectionGet` | `(collection, id)` — fetch a single record |
| `collectionUpsert` | `(collection, record)` — create or replace a record |
| `collectionDelete` | `(collection, id)` — delete a record |

The backend builds the tools' `IRecordsProvider` in `resolveAgentConfig`, scoped to the
agent's own project — an agent can only read/write collections in the project it runs in.
This gives an agent durable memory beyond a single conversation: it can persist structured
findings in one run and query them back in a later run or a scheduled cycle.

---

## 8. Access Path: Function `records` Capability

FaaS Functions receive a `records` object on `context`, alongside `args`/`envVars`/`secrets`:

```typescript
type TFunctionContext = {
  // ...existing fields
  records?: {
    query: (collection: string, query?: TRecordQuery) => Promise<Array<{ id: string; data: Record<string, unknown> }>>
    get: (collection: string, id: string) => Promise<{ id: string; data: Record<string, unknown> } | null>
    upsert: (collection: string, record: { id?: string; data: Record<string, unknown> }) => Promise<{ id: string }>
    delete: (collection: string, id: string) => Promise<{ deleted: boolean }>
    count: (collection: string) => Promise<number>
  }
}
```

This is a **platform-mediated bridge**: the FunctionExecutor injects an object whose methods
call the host-side record service. The isolated V8 sandbox never gets raw database access —
it only ever sees the results the bridge returns. `records` is scoped to the Function's own
project, exactly like the admin API and agent tools.

```typescript
export default async function handler(request, context) {
  const { data } = request.body
  const { id } = await context.records.upsert(`leads`, { data })
  return { statusCode: 201, body: { id } }
}
```

---

## 9. Access Path: `contextSources`

Schedules (and agent defaults) accept an optional `contextSources` array. When a cycle's
prompt context is assembled, the executor runs each source's query and injects the results
under a `## <as>` heading:

```typescript
type TContextSource = {
  collection: string   // the project-scoped collection to query
  query: TRecordQuery  // the same safe query shape as §6
  as: string            // heading the results render under
  max?: number          // per-source char cap (default: platform ContextSourceInjectMaxChars)
}
```

```json
{
  "contextSources": [
    {
      "collection": "leads",
      "query": { "where": [{ "field": "status", "op": "eq", "value": "new" }], "limit": 10 },
      "as": "New Leads",
      "max": 4000
    }
  ]
}
```

Rendered records include their `id` alongside the document fields, so a prompt can reference
a specific record by id in a follow-up write. A schedule **without** `contextSources` runs no
extra query — its assembled context is unchanged. A failing source is logged and skipped
rather than failing the whole cycle, so one bad source never blocks the others.

This is the generic, config-driven replacement for hard-coding a context builder per use
case: instead of shipping platform code for "inject the open task backlog," a consumer
points `contextSources` at their own `tasks` collection and query.

---

## 10. Schema Validation

When a collection has a `schema`, every `upsert` (via any access path) is validated before
the write:

- A field marked `required` must be present and non-null.
- A present field's JS type must match its declared `type` (`string`, `number`, `boolean`,
  `object`, `array`).
- Fields not listed in the schema are still accepted (the schema is additive validation, not
  a strict allowlist) — this keeps schemaless-style flexibility even on a schema'd collection.
- A validation failure returns **400** with a message naming the offending field
  (e.g. `Field "email" must be of type string`).

A collection without a `schema` accepts any JSON document in `data`.

---

## 11. Limits and Constraints

| Limit | Value | Notes |
|-------|-------|-------|
| Query default limit | 50 records | Applied when `limit` is omitted |
| Query max limit | 100 records | Hard cap; larger `limit` values are clamped |
| Collection name uniqueness | Per project | `(projectId, name)` unique index |
| Record identity | Create-or-replace by `id` | `upsert` without `id` always creates |
| Query fields | Safe identifier + schema membership | Prevents SQL injection via `field` |
| Delete semantics | Cascade | Deleting a collection deletes all its records |
| Scope | Project | A caller can never read/write another project's collections |

---

## 12. Authentication and Permissions

### Permission Matrix

| Operation | Minimum Role | Permission |
|-----------|--------------|------------|
| List/get collections | member | `collection:read` |
| Create collection | member | `collection:create` |
| Update collection | member | `collection:update` |
| Delete collection | admin | `collection:delete` |
| Upsert/query/get records | member | `collection:create` / `collection:read` |
| Delete a record | admin | `collection:delete` |

All Collections routes additionally require the `collections` feature flag to be enabled for
the org, and the standard project access + project member guards (mirrors the Schedules API).

### Authentication Methods

```bash
# JWT (browser/Neon Auth login)
curl -H "Authorization: Bearer eyJhbGciOi..." \
  https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/collections

# API Key
curl -H "Authorization: Bearer tdsk_your_api_key_here" \
  https://local.threadedstack.app/_/orgs/<org-id>/projects/<project-id>/collections
```

---

## 13. Troubleshooting

### "Collection not found" (404)

**Checks:**
1. Verify the collection name is exact — names are case-sensitive and unique per project.
2. Verify you are targeting the correct `projectId` in the URL — a collection in one project
   is invisible from another, even with the same name.

### 400 on upsert: `Field "..." must be of type ...` / `Missing required field: ...`

**Symptom:** A record write is rejected with a 400.

**Checks:**
1. The target collection has a `schema` — check `GET .../collections/<name>` to see it.
2. Compare your `data` payload's field types against the schema's declared types.
3. Ensure every `required: true` field is present and non-null.

### 400 on query: `Invalid field: ...`

**Symptom:** A query is rejected before running.

**Checks:**
1. `where[].field` and `orderBy.field` must be safe identifiers (letters/digits/underscore,
   starting with a letter or underscore).
2. When the collection has a schema, every queried field must be one of the schema's field
   names — querying an arbitrary field on a schema'd collection is rejected.
3. Schemaless collections accept any safe-identifier field name.

### Agent tools return "Collection query failed: ..."

**Checks:**
1. Confirm the `collections` feature flag is enabled for the org.
2. Confirm the agent's `agent.tools` allowlist includes the `collection*` tools (if the
   allowlist is restrictive, the tools may not be attached at all).
3. Confirm the collection exists in the agent's own project — agent tools cannot cross
   project boundaries.

### `contextSources` section is missing from the prompt

**Checks:**
1. Confirm the schedule's `contextSources` array is set and each entry has `collection`,
   `query`, and `as`.
2. A failing source degrades silently (logged, section omitted) rather than erroring the
   cycle — check backend logs for `buildContextSourcesSection failed for schedule ...`.
3. Confirm the referenced collection and any queried fields actually exist.
