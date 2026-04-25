# PR Review: Suggested Improvements & Test Gaps Plan

> From PR review of `lt/threads-gui-rethink` (2026-04-23).
> Critical (#1-7) and Important (#8-19) issues have been fixed.
> This plan covers Suggestions (#20-27) and Test Gaps (#1-5).

---

## Suggestions

### S-20: Rate Limiter Shared Store for `tunnelFailures` Map

**Problem**: `tunnelFailures` in `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` is an in-memory `Map`. In a multi-replica deployment, each pod has its own map, so a client can bypass rate limiting by hitting different replicas.

**Files**:
- `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts` — `tunnelFailures` Map (lines 20-55)

**Implementation**:
1. Create `repos/backend/src/services/rateLimiter.ts` with a `TRateLimiterBackend` interface:
   - `record(key: string): Promise<void>`
   - `isRateLimited(key: string, window: number, limit: number): Promise<boolean>`
   - `clear(key?: string): Promise<void>`
2. Implement `InMemoryRateLimiter` (current behavior, for local dev)
3. Implement `RedisRateLimiter` using sorted sets (ZADD/ZRANGEBYSCORE) — or reuse the Neon DB with a lightweight table
4. Wire into `onTunnelConnect.ts` via `req.app.locals.rateLimiter`
5. Configuration: `config.rateLimiter.backend` = `memory` | `redis` | `db`

**Effort**: Medium (2-3 hours). Low urgency until multi-replica prod deployment.

---

### S-21: Deduplicate `TSandboxStatus` Type

**Problem**: `TSandboxStatus` is defined in `repos/threads/src/types/sessions.types.ts` as `'stopped' | 'starting' | 'running' | 'error'`. If `@tdsk/domain` already has an `EContainerState` or similar enum, they should be unified.

**Files**:
- `repos/threads/src/types/sessions.types.ts:15` — `TSandboxStatus` definition
- `repos/domain/src/types/sandbox.types.ts` — `EContainerState` enum

**Implementation**:
1. Check if `EContainerState` covers all `TSandboxStatus` values
2. If yes: replace `TSandboxStatus` with `EContainerState` from `@tdsk/domain` in threads
3. If no: extend `EContainerState` to cover all states, then replace
4. Update all imports in threads (6+ consumer files)

**Effort**: Small (30 min). Quick win for type consistency.

---

### S-22: Consolidate `TPermissionContext` Into Domain

**Problem**: `TPermissionContext` is defined in `repos/backend/src/types/permission.types.ts` but both the backend middleware and frontend hooks need permission context concepts. Having it in domain would allow shared type safety.

**Files**:
- `repos/backend/src/types/permission.types.ts` — current definition
- `repos/backend/src/middleware/authorize.ts` — consumer
- `repos/backend/src/utils/auth/checkPermission.ts` — consumer

**Implementation**:
1. Move `TPermissionContext` to `repos/domain/src/types/permission.types.ts`
2. Export from domain barrel
3. Update backend imports (3 files)
4. Frontend hooks can optionally use the same type for consistency

**Effort**: Small (20 min). Standard type-to-domain migration.

---

### S-23: Consolidate `usePermissions` Hook

**Problem**: Both `repos/admin/src/hooks/permissions/usePermissions.tsx` and `repos/threads/src/hooks/permissions/usePermissions.ts` implement permission checking hooks independently. Shared logic could live in `@tdsk/components`.

**Files**:
- `repos/admin/src/hooks/permissions/usePermissions.tsx` (21 consumers)
- `repos/threads/src/hooks/permissions/usePermissions.ts` (6 consumers)

**Implementation**:
1. Compare both implementations to identify shared vs. app-specific logic
2. Extract shared permission logic into `repos/components/src/hooks/usePermissions.ts`
3. Keep app-specific wrappers thin (just provide the org role source)
4. Update imports in both admin (21 files) and threads (6 files)

**Effort**: Medium (1-2 hours). Both hooks may diverge as threads evolves, so assess whether the consolidation is worth the coupling.

---

### S-24: Runtime Validation for `TShellControlMsg`

**Problem**: `onShellConnect.ts` parses incoming WebSocket text frames as `TShellControlMsg` via `JSON.parse() as TShellControlMsg` without runtime validation. Malformed messages could cause runtime errors.

**Files**:
- `repos/backend/src/endpoints/sandboxes/onShellConnect.ts:660-662` — `JSON.parse` cast
- `repos/backend/src/types/shellSession.types.ts:33-37` — `TShellControlMsg` union

**Implementation**:
1. Create a `parseShellControlMsg(raw: string): TShellControlMsg | null` function in `repos/backend/src/utils/shell/parseControlMsg.ts`
2. Validate:
   - Must be valid JSON object with `type` field
   - `resize`: `cols` and `rows` must be positive integers, capped at reasonable max (e.g., 500)
   - `signal`: `signal` must be `SIGINT` or `SIGTSTP`
   - `visibility`: must be valid `ESandboxSessionVisibility` value
   - `permission-response`: must be `y` or `n`
3. Return `null` for invalid messages (log + ignore)
4. Replace the `JSON.parse(...) as TShellControlMsg` cast in `onShellConnect.ts`

**Effort**: Small (45 min). Important for hardening the WebSocket protocol.

---

### S-25: `wasmBridge` Retry with Backoff on WASM Load Failure

**Problem**: `getCompiledModule()` in `repos/threads/src/engine/wasmBridge.ts` nulls out `compilePromise` on failure, so subsequent calls retry — but there's no backoff. If the WASM URL is temporarily unreachable, rapid retries could flood the network.

**Files**:
- `repos/threads/src/engine/wasmBridge.ts:69-84` — `getCompiledModule()`

**Implementation**:
1. Add a `retryCount` counter and `lastAttemptTime` timestamp
2. On failure: increment `retryCount`, set `lastAttemptTime`
3. On next call: if `Date.now() - lastAttemptTime < backoff(retryCount)`, return a rejected promise
4. Backoff: exponential with cap (1s, 2s, 4s, 8s, max 30s)
5. On success: reset `retryCount`

**Effort**: Small (30 min). Edge case but prevents network storms.

---

### S-26: Cap `tunnelFailures` Map Size

**Problem**: The `tunnelFailures` Map in `onTunnelConnect.ts` can grow unbounded if many sandbox IDs accumulate failures without cleanup.

**Files**:
- `repos/backend/src/endpoints/sandboxes/onTunnelConnect.ts:20` — `tunnelFailures` Map

**Implementation**:
1. Add a `MAX_TRACKED_SANDBOXES` constant (e.g., 10_000)
2. In `recordTunnelFailure()`, before adding, check `tunnelFailures.size`
3. If at cap, evict the oldest entry (first key in Map iteration order)
4. Consider periodic cleanup (setInterval every 5 min to prune stale entries)

**Effort**: Small (20 min). Quick guard against memory leaks.

---

### S-27: Tokenizer Constant Drift Test

**Problem**: The tokenizer uses hardcoded constants for WASM cell sizes (`GhosttyVTCellSize`, `GhosttyVTConfigSize`). If the WASM binary changes these sizes, the tokenizer silently reads garbage data.

**Files**:
- `repos/threads/src/tokenizer/types.ts` — constant definitions
- `repos/threads/src/engine/wasmBridge.ts` — uses constants

**Implementation**:
1. Add a test in `repos/threads/src/tokenizer/tokenizer.test.ts` that:
   - Creates a terminal via `createBrowserTerminal()`
   - Writes a known ANSI sequence (e.g., `\x1b[31mHello\x1b[0m`)
   - Tokenizes the viewport
   - Asserts the first span has `fg.r === 170` (or whatever the default xterm red is)
2. This test exercises the full pipeline: WASM → viewport → tokenizer. If cell size constants drift, the colors/text will be wrong.
3. Mark as integration test (requires WASM runtime — Node 20+ or jsdom with WASM support)

**Effort**: Medium (1 hour). Requires WASM test infrastructure setup.

---

## Test Gaps

### TG-1: SessionEngine Unit Tests

**Problem**: `SessionEngine` has no unit tests. The `process()` method orchestrates tokenize → parse → diff → callbacks, and the new consecutive error tracking needs coverage.

**Files**:
- `repos/threads/src/engine/sessionEngine.ts`

**Test file**: `repos/threads/src/engine/sessionEngine.test.ts`

**Test cases**:
1. `create()` returns a valid SessionEngine instance
2. `write()` triggers `onAST` callback via requestAnimationFrame
3. `write()` triggers `onFeedEvents` when content changes
4. `resize()` triggers immediate `process()`
5. Consecutive error tracking: mock `tokenize` to throw 3 times, assert `onFeedEvents` receives error output event
6. Consecutive error counter resets on successful process
7. `destroy()` prevents further processing
8. Idle check timer fires after 2s of no data

**Dependencies**: Needs to mock `createBrowserTerminal` (WASM), `tokenize`, `parse`, `diffToFeedEvents`. Use `vi.useFakeTimers()` for RAF and setInterval.

**Effort**: Medium (1-2 hours).

---

### TG-2: `flatParser` Table Pattern Recognition

**Problem**: The flat parser detects tables from aligned columns, but there are no tests for edge cases like: single-column tables, tables with empty cells, tables mixed with non-table lines.

**Files**:
- `repos/threads/src/parser/flatParser.ts` — table detection logic

**Test file**: `repos/threads/src/parser/flatParser.test.ts` (extend existing)

**Test cases**:
1. Standard 3-column table with headers
2. Table with varying column widths
3. Table with empty cells (consecutive spaces in a column)
4. Single-column "table" (should NOT be detected as table)
5. Table followed by non-table text (boundary detection)
6. Table with separator row (dashes/equals)
7. Mixed bold/color cells within table

**Effort**: Small-Medium (45 min-1 hour).

---

### TG-3: `feedVisitor` Content-Change Detection

**Problem**: `diffToFeedEvents()` has complex logic for detecting meaningful content changes vs. noise (TUI redraws). The threshold of 3+ changed lines and fingerprinting need targeted tests.

**Files**:
- `repos/threads/src/visitors/feedVisitor.ts` — `diffToFeedEvents()`

**Test file**: `repos/threads/src/visitors/feedVisitor.test.ts`

**Test cases**:
1. No change between snapshots → empty events
2. Mode transition: `streaming` → `idle` → generates idle event
3. New TextLines appended → generates output event with `status: 'streaming'`
4. 4+ lines changed in-place → generates output event (above threshold)
5. 2 lines changed in-place → NO output event (below threshold)
6. Empty/whitespace-only changed lines filtered out
7. TextInput appeared → generates prompt event
8. TextInput disappeared → generates answered event
9. SelectList appeared → generates prompt with options
10. DiffBlock appeared → generates action event
11. TUI mode entered/exited → generates tui events

**Effort**: Medium (1-1.5 hours).

---

### TG-4: `accessibilityVisitor` Tests

**Problem**: The accessibility visitor generates ARIA props for AST nodes. No tests verify correct ARIA attribute generation.

**Files**:
- `repos/threads/src/visitors/accessibilityVisitor.ts`

**Test file**: `repos/threads/src/visitors/accessibilityVisitor.test.ts`

**Test cases**:
1. Panel → generates `role: 'region'`, `aria-label` from title
2. SelectList → generates `role: 'listbox'`
3. SelectItem → generates `role: 'option'`, `aria-selected`
4. Confirm → generates `role: 'dialog'` or `alertdialog`
5. TextInput → generates `role: 'textbox'`, `aria-readonly`
6. StatusBar → generates `role: 'status'`, `aria-live: 'polite'`
7. Table → generates `role: 'table'` with row/cell roles
8. Link → generates `role: 'link'`, `aria-label` from text

**Effort**: Small-Medium (45 min).

---

### TG-5: `flatParser` Confirm with Highlights

**Problem**: Confirm dialogs (Yes/No) often render the focused option with highlight/inverse colors. The parser should correctly identify which option is focused.

**Files**:
- `repos/threads/src/parser/flatParser.ts` — confirm detection

**Test file**: `repos/threads/src/parser/flatParser.test.ts` (extend existing)

**Test cases**:
1. `[Y/n]` with Y highlighted (inverse) → `focusedIndex: 0`
2. `[y/N]` with N highlighted → `focusedIndex: 1`
3. `Yes  No` as separate buttons, first bold → `focusedIndex: 0`
4. `Accept  Decline  Cancel` three options, middle highlighted → `focusedIndex: 1`
5. Confirm with no highlight → `focusedIndex: -1` or `0` (default)

**Effort**: Small (30 min).

---

## Priority Order

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 1 | S-24: TShellControlMsg validation | 45 min | Security hardening |
| 2 | S-26: tunnelFailures Map cap | 20 min | Memory leak prevention |
| 3 | S-21: TSandboxStatus dedup | 30 min | Type consistency |
| 4 | S-22: TPermissionContext to domain | 20 min | Type consistency |
| 5 | TG-1: SessionEngine tests | 1-2 hr | Core engine coverage |
| 6 | TG-3: feedVisitor tests | 1-1.5 hr | Event correctness |
| 7 | S-25: wasmBridge retry backoff | 30 min | Resilience |
| 8 | TG-5: flatParser confirm tests | 30 min | Parser correctness |
| 9 | TG-4: accessibilityVisitor tests | 45 min | A11y coverage |
| 10 | TG-2: flatParser table tests | 45 min-1 hr | Parser coverage |
| 11 | S-23: usePermissions consolidation | 1-2 hr | DRY (assess coupling) |
| 12 | S-20: Rate limiter shared store | 2-3 hr | Multi-replica support |
| 13 | S-27: Tokenizer constant drift test | 1 hr | WASM safety net |
