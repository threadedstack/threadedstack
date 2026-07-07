# Collections/Records Primitive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a generic, project-scoped Collections/Records store (structured jsonb documents, optional schema, a safe query API) that agents and Functions read/write — the foundation for generalizing TDSK's autonomous-agent orchestration.

**Architecture:** Two additive tables (`collections`, `records`) + one `collectionService` (CRUD + an injection-proof query compiler), exposed three ways: agent tools (a `RecordsProvider` mirroring the memory provider), a Function `records` capability injected into `TFunctionContext` (platform-mediated, no raw DB), and a `contextSources` schedule config the executor runs + injects. Purely additive/inert — no existing `persist*`/table/executor behavior changes; the live dev loop is untouched.

**Tech Stack:** Drizzle/PostgreSQL (jsonb + GIN), TypeScript domain models/types, Express admin API, the agent tool-provider registry (`repos/agent`), the FaaS `functionExecutor`, the scheduler `executor.ts`. Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-collections-records-primitive-design.md`

**Global rule (every phase):** DONE only when the phase's DEFINITION-OF-DONE commands are green and I've pasted the evidence in a SELF-REVIEW step. No human gate. One PR per phase (or per coherent group), merged during a quiet loop window.

---

## File Structure (locked decomposition)

**Create (database):**
- `repos/database/src/schemas/collections.ts` — `collections` table
- `repos/database/src/schemas/records.ts` — `records` table
- `repos/database/src/services/collection.ts` (+ `.test.ts`) — collection CRUD
- `repos/database/src/services/record.ts` (+ `.test.ts`) — record CRUD + `query()` compiler
- `repos/database/src/utils/database/recordQuery.ts` (+ `.test.ts`) — the parameterized, field-whitelisted query compiler (isolated so its injection-safety is unit-tested alone)

**Create (domain):**
- `repos/domain/src/types/collection.types.ts` — `TCollectionSchema`, `TRecordQuery`, `EQueryOp`, `EFieldType`
- `repos/domain/src/models/collection.ts`, `repos/domain/src/models/record.ts` (+ barrels, id prefixes `col`/`rec`)

**Create (backend API):**
- `repos/backend/src/endpoints/collections/*.ts` — CRUD + query endpoints + mount

**Create (agent):**
- `repos/agent/src/tools/definitions/records/*` — the 4 record tools + `createRecordTools`

**Modify:**
- `repos/database/src/schemas/schemas.ts` + `services/index.ts` + `models/index.ts` + `types/prefixs.types.ts` (barrel exports)
- `repos/backend/src/services/functions/functionExecutor.ts` — inject `records` into `TFunctionContext`
- `repos/backend/src/types/*` (TFunctionContext type) — add `records`
- `repos/backend/src/utils/agent/resolveAgentConfig.ts` — build `recordsProvider` (gated by `collections` feature)
- `repos/agent/src/runner/runner.ts` — wire record tools into `#buildTools`
- `repos/database/src/schemas/schedules.ts` + domain schedule type — add `contextSources` jsonb field
- `repos/backend/src/services/scheduler/executor.ts` — a `buildContextSources()` injector added to the context assembly
- feature flags — add a `collections` flag

---

## Phase 1 — Schemas + service + query compiler (database/domain)

### Task 1.1: domain types + id prefixes
**Files:** Create `repos/domain/src/types/collection.types.ts`; modify `types/index.ts`, `types/prefixs.types.ts`.
- [ ] Step 1: Define + export `EFieldType` (`string|number|boolean|object|array`), `EQueryOp` (`eq|ne|gt|gte|lt|lte|in|contains`), `TCollectionSchemaField {name,type,required?,indexed?}`, `TCollectionSchema = TCollectionSchemaField[]`, `TRecordQueryFilter {field,op:EQueryOp,value:unknown}`, `TRecordQuery {where?:TRecordQueryFilter[],orderBy?:{field:string,direction:'asc'|'desc'},limit?:number,offset?:number}`. Add `col`/`rec` to the id-prefix map.
- [ ] Step 2: `pnpm --filter @tdsk/domain types` clean. Commit.

### Task 1.2: `collections` + `records` schemas
**Files:** Create `schemas/collections.ts`, `schemas/records.ts`; modify `schemas/schemas.ts`. Mirror `repos/database/src/schemas/memories.ts` (entityId + jsonb + indexes).
- [ ] Step 1: `collections`: `id`(col), `projectId`(FK projects, notNull, index), `name`(text notNull), `description`(text), `schema`(jsonb `$type<TCollectionSchema>`, nullable), timestamps; **unique index `(projectId,name)`**.
- [ ] Step 2: `records`: `id`(rec), `collectionId`(FK collections, notNull, index), `projectId`(FK projects, notNull, index), `data`(jsonb notNull), timestamps; **GIN index on `data`** (`index().using('gin', table.data)`) + btree on `collectionId`.
- [ ] Step 3: Export both from `schemas.ts`. `pnpm --filter @tdsk/database types` clean. Commit.

### Task 1.3: the query compiler (security-critical, isolated + tested alone)
**Files:** Create `repos/database/src/utils/database/recordQuery.ts` + `.test.ts`.
- [ ] Step 1: Write `recordQuery.test.ts` FIRST (TDD). Assert: (a) `compileRecordQuery({where:[{field:'status',op:'eq',value:'open'}]})` returns a drizzle `SQL` whose params carry `'open'` and whose text references `data->>'status'` via a bound identifier, NOT string interpolation; (b) an unknown/malicious `field` like `"x'); drop table records;--"` is **rejected** (throws `Invalid field`) — field must match `^[A-Za-z_][A-Za-z0-9_]*$` and, when a schema is passed, be one of its field names; (c) each `op` maps to the right operator; (d) `in` requires an array; (e) `limit` is clamped to `RecordQueryMaxLimit`.
- [ ] Step 2: Run it — fails (module missing).
- [ ] Step 3: Implement `compileRecordQuery(query, schema?)` using drizzle `sql` template with `sql.raw` ONLY for the whitelisted operator token, and bound params for every value; build `data->>${field}` via a validated field passed as a parameter (`sql\`(data ->> ${field})\``). Field validation: regex + schema membership. Clamp limit.
- [ ] Step 4: Run — passes. Commit.

### Task 1.4: `collection` + `record` services
**Files:** Create `services/collection.ts`, `services/record.ts` (+ `.test.ts` each); modify `services/index.ts`. Mirror `services/taskProposal.ts` (BaseService + `{ok,data,error}` returns).
- [ ] Step 1: `collectionService`: `create`, `getByName(projectId,name)`, `listByProject(projectId)`, `update`, `delete`. `recordService`: `upsert(projectId,collectionName,record)` (resolve collection, validate `data` against `collection.schema` when present, create-or-replace by `id`), `get(projectId,collectionName,id)`, `query(projectId,collectionName,query)` (resolve collection → `compileRecordQuery(query, collection.schema)` → run scoped to `collectionId`+`projectId`), `delete`, `count`. Every method projectId-scoped.
- [ ] Step 2: Tests: collection CRUD + `(projectId,name)` uniqueness; record upsert (create then replace) + schema validation rejects a wrong-typed field; `query` returns matching records; **project-scoping isolation** (records in project A never returned for project B); `query` uses the compiler (a malicious field throws, not executes).
- [ ] Step 3: `pnpm --filter @tdsk/database types` + `test` green (baseline 603). Commit.

**DEFINITION OF DONE (Phase 1):** `@tdsk/domain` types clean + test green; `@tdsk/database` types clean + test green (603 + new); the recordQuery injection-safety test passes (malicious field rejected); drizzle generate is additive (2 CREATE TABLE, 0 drops — or note the interactive-push constraint per CLAUDE.md, additive proven by diff = 0 deletions to existing schema).
**SELF-REVIEW (Phase 1):** paste the domain + database green summaries + the recordQuery injection-safety test name + the schema diff proving additive-only. Confirm no existing table/service changed.

---

## Phase 2 — Admin API (CRUD + query endpoints)

**Files:** Create `repos/backend/src/endpoints/collections/{createCollection,getCollection,listCollections,updateCollection,deleteCollection,upsertRecord,queryRecords,getRecord,deleteRecord,index}.ts`. Add a `collections` feature flag. Mirror an existing project-scoped endpoint group (e.g. `endpoints/functions/` or `endpoints/skills/`) for `authorize()` + `featureGate` + mount path.
- [ ] Tasks: one endpoint per file; path base `/:orgId/projects/:projectId/collections` and `/collections/:name/records`; gate with `authorize(create|read|update|delete, EPermResource.<collection>)` (add the resource) + `featureGate('collections')`. Query endpoint accepts the `TRecordQuery` body and calls `recordService.query`. Tests mirror an existing endpoint test file (supertest-style or the repo's endpoint test pattern).

**DEFINITION OF DONE (Phase 2):** `@tdsk/backend` types clean + test green (baseline after Phase-1 merge); endpoint tests cover create-collection → upsert-record → query-record round trip + the feature-gate 404 when disabled + authorize 403 cross-project.
**SELF-REVIEW (Phase 2):** paste backend green summary + the round-trip test names + the cross-project-authorize test.

---

## Phase 3 — Agent RecordsProvider (tools)

**Files:** Create `repos/agent/src/tools/definitions/records/*` + `createRecordTools`; modify `repos/agent/src/tools/index.ts`, `repos/agent/src/runner/runner.ts` (`#buildTools`), `repos/backend/src/utils/agent/resolveAgentConfig.ts` (build `recordsProvider` gated by `collections` feature, mirroring `memoryProvider` at ~line 384). Mirror `createMemoryTools`.
- [ ] Tasks: define `IRecordsProvider {query,get,upsert,delete}`; `createRecordTools(provider, toolNames?)` → 4 `AgentTool`s (`collectionQuery`/`collectionGet`/`collectionUpsert`/`collectionDelete`) with params from the tool schema; wire into `#buildTools` (like memoryTools); backend builds the provider (calls `recordService` scoped to the agent's project) and passes it to `AgentRunner`. Tests: each tool calls the provider with the right args; provider absent → tools absent; feature-off → not wired.

**DEFINITION OF DONE (Phase 3):** `@tdsk/agent` + `@tdsk/backend` types clean + test green; a test proves a runtime cycle with `collections` on exposes the 4 tools and a cycle without it does not.
**SELF-REVIEW (Phase 3):** paste agent + backend green summaries + the tool-wiring tests.

---

## Phase 4 — Function `records` capability

**Files:** Modify `repos/backend/src/services/functions/functionExecutor.ts` (inject `records` into the context at ~line 99-114) + the `TFunctionContext` type. Mirror how `args/envVars/secrets` are injected.
- [ ] Tasks: extend `TFunctionContext` with `records: IRecordsProvider`; in `FunctionExecutor.execute`, build a `records` object whose methods call `recordService` on the HOST side, scoped to the Function's `projectId`, and inject it into the isolate context (a host-function bridge — the isolate calls out; it never gets a DB handle). Test: a Function whose code does `await context.records.upsert('c',{id:'r1',...})` then `context.records.query('c',...)` persists + reads back; the isolate has no direct `db`/network.

**DEFINITION OF DONE (Phase 4):** `@tdsk/backend` types clean + test green; a functionExecutor test proves a Function persists + queries a record via `context.records`, and that the isolate cannot reach the DB directly.
**SELF-REVIEW (Phase 4):** paste backend green summary + the records-capability test + confirm no raw-DB handle crosses into the isolate.

---

## Phase 5 — `contextSources` config + executor injector

**Files:** Modify `repos/database/src/schemas/schedules.ts` (add `contextSources` jsonb, nullable) + the domain schedule type; create `repos/backend/src/utils/agent/contextSources.ts` (+ test); modify `executor.ts` context assembly (add `buildContextSourcesSection` next to the other builders, ~line 1708-1761). Mirror `buildRunOutcomeContext` (never throws → '' on error, char-capped).
- [ ] Tasks: `contextSources?: Array<{collection,query:TRecordQuery,as:string,max?:number}>` on the schedule; `buildContextSourcesSection(app, schedule)` runs each source via `recordService.query(schedule project, ...)`, renders `## <as>\n<results>` capped at `max`/a default, concatenates, returns '' when none/empty, never throws. Wire into the assembled context. Tests: renders sections from records; a schedule with no `contextSources` gets nothing + no query runs; a failing source degrades to empty; respects `max`.

**DEFINITION OF DONE (Phase 5):** `@tdsk/database` + `@tdsk/backend` types clean + test green; a test proves a schedule with a `contextSources` entry receives the `## <as>` section built from its collection query, and a schedule without it is byte-unchanged (no query). The reconcileSchedules declarative-field set includes `contextSources` (so it round-trips) — add + test.
**SELF-REVIEW (Phase 5):** paste db + backend green summaries + the injection test + confirm steward/adversary cycles (no contextSources) are unaffected.

---

## Rollout
Land Phases 1–5 as additive PRs (schemas first, then API/tools/capability/injector), each green + deployed, keeping prod green. The 2 new tables apply to prod via the safe additive CREATE-IF-NOT-EXISTS path (drizzle-kit push is interactive per CLAUDE.md; use the reviewed-DDL direct apply proven in the exec-layer activation). Everything is inert until a consumer creates a collection or a schedule sets `contextSources` — the live dev loop is never affected.

---

## Plan Self-Review (against the spec)
- **Spec §4 data model** → Task 1.2. ✓  **§5 query API** → Task 1.3 (compiler) + 1.4 (service). ✓
- **§6.1 agent tools** → Phase 3. ✓  **§6.2 Function records capability** → Phase 4. ✓  **§6.3 contextSources** → Phase 5. ✓
- **§7 admin API** → Phase 2. ✓  **§9 testing** → per-phase DoD (incl. the injection-safety + project-isolation tests). ✓  **§10 additive/inert rollout** → Rollout + every phase's "no existing behavior changed". ✓
- No placeholders: each task cites exact files + the pattern to mirror + exact DoD commands. Type consistency: `TRecordQuery`/`EQueryOp`/`IRecordsProvider` defined in Phase 1 are consumed unchanged by the compiler (1.3), service (1.4), tools (3), capability (4), and injector (5).
