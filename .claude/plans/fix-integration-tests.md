# Plan: Fix 26 Failing Integration Tests

## Summary

26 tests failing across 8 files, grouped into **3 root causes**:

| Category | Files | Tests | Root Cause |
|----------|-------|-------|------------|
| REPL AuthManager API rename | 1 file | 14 | Test mock uses old method names |
| REPL import path + class renames | 4 files | ~12 | Subpath imports broken + classes renamed |
| FaaS isolated-vm missing | 3 files | 12 | Native module not compiled in K8s pod |

---

## Category 1: REPL AuthManager API Mismatch (14 tests)

**File**: `repos/integration/src/tier1/repl-api-client.test.ts`
**Error**: `TypeError: this[#auth].creds is not a function`

**Root cause**: The `AuthManager` class was refactored with renamed methods:
- `getCredentials()` → `creds()`
- `isLoggedIn()` → `loggedIn()`

The test mock `createTestAuth()` still provides the old method names.

### Fix

**File**: `repos/integration/src/utils/repl-auth.ts`

```typescript
// BEFORE (broken):
export const createTestAuth = (overrides?) => ({
  getCredentials: () => ({...}),  // OLD name
  isLoggedIn: () => true,         // OLD name
  ...
})

// AFTER (fixed):
export const createTestAuth = (overrides?) => ({
  creds: () => ({...}),           // NEW name matching AuthManager.creds()
  loggedIn: () => true,           // NEW name matching AuthManager.loggedIn()
  ...
})
```

---

## Category 2: REPL Import Paths + Class Renames (4 files)

**Files**:
- `repos/integration/src/tier1/repl-auth-manager.test.ts`
- `repos/integration/src/tier1/repl-http-adapter.test.ts`
- `repos/integration/src/tier3/repl-executor-llm.test.ts`
- `repos/integration/src/tier3/repl-executor-session.test.ts`

**Error**: `Failed to load url @tdsk/repl/api (resolved id: @tdsk/repl/api)`

### Problem A: Broken subpath imports

The tsconfig maps `@tdsk/repl/*` → `../repl/src/*`. Tests import:
- `@tdsk/repl/api` → resolves to `repos/repl/src/api` — **DOES NOT EXIST**
- `@tdsk/repl/auth` → resolves to `repos/repl/src/auth` — **DOES NOT EXIST**
- `@tdsk/repl/executor` → resolves to `repos/repl/src/executor` — **DOES NOT EXIST**

Actual files are at `repos/repl/src/services/{api,auth,executor}.ts`.

**Fix**: Update imports in all 4 files:
```typescript
// BEFORE (broken):
import { ApiClient } from '@tdsk/repl/api'
import { AuthManager } from '@tdsk/repl/auth'
import { LocalAgentExecutor } from '@tdsk/repl/executor'
import { HttpMessageAdapter } from '@tdsk/repl/executor'

// AFTER (fixed):
import { ApiClient } from '@tdsk/repl/services/api'
import { AuthManager } from '@tdsk/repl/services/auth'
import { Executor } from '@tdsk/repl/services/executor'
import { DBProxy } from '@tdsk/repl/services/dbProxy'
```

### Problem B: Renamed classes

The REPL refactored class names:
- `LocalAgentExecutor` → `Executor` (in `services/executor.ts`)
- `HttpMessageAdapter` → `DBProxy` (moved to `services/dbProxy.ts`)

**Fix per file**:

#### `repl-auth-manager.test.ts`
1. Fix import: `@tdsk/repl/auth` → `@tdsk/repl/services/auth`
2. Update API calls: `auth.isLoggedIn()` → `auth.loggedIn()`
3. Update API calls: `auth.getCredentials()` → `auth.creds()`

#### `repl-http-adapter.test.ts`
1. Fix imports:
   - `@tdsk/repl/api` → `@tdsk/repl/services/api`
   - `@tdsk/repl/executor` → `@tdsk/repl/services/dbProxy`
2. Rename class: `HttpMessageAdapter` → `DBProxy`
3. Update constructor: `new HttpMessageAdapter(client, orgId, agentId)` → `new DBProxy(client, orgId, agentId)`

#### `repl-executor-llm.test.ts`
1. Fix imports:
   - `@tdsk/repl/api` → `@tdsk/repl/services/api`
   - `@tdsk/repl/executor` → `@tdsk/repl/services/executor`
2. Rename class: `LocalAgentExecutor` → `Executor`
3. Update constructor: `new LocalAgentExecutor(client)` → `new Executor(client)`

#### `repl-executor-session.test.ts`
1. Fix imports:
   - `@tdsk/repl/api` → `@tdsk/repl/services/api`
   - `@tdsk/repl/executor` → `@tdsk/repl/services/executor`
2. Rename class: `LocalAgentExecutor` → `Executor`
3. Update constructor: `new LocalAgentExecutor(client)` → `new Executor(client)`

---

## Category 3: FaaS isolated-vm Not Compiled in K8s (12 tests)

**Files**:
- `repos/integration/src/tier3/faas-execution.test.ts` (7 failures)
- `repos/integration/src/tier3/faas-edge-cases.test.ts` (3 failures)
- `repos/integration/src/tier3/faas-lifecycle.test.ts` (2 failures)

**Error**: All FaaS endpoint calls return HTTP 500

### Root cause chain

1. `isolated-vm` package exists in K8s pod at `repos/sandbox/node_modules/isolated-vm/` but the `out/` directory (compiled native binary) is **missing**
2. `IsolateRunner.init()` fails because `import('isolated-vm')` can't load the native addon
3. `LocalSandboxProvider.create()` catches the error silently, sets `runner = null`
4. `LocalSandbox.evaluate()` throws: "Code execution not available — isolated-vm is required but not loaded"
5. `FunctionExecutor.execute()` catches, returns `{ success: false, error: ... }`
6. `FaaSEndpoint.execute()` throws `Exception(500, "Function execution failed: ...")`

**Verified**: `kubectl exec deployment/tdsk-backend -- node -e "require('isolated-vm')"` → `FAIL: Cannot find module 'isolated-vm'`

### Fix

This requires rebuilding the native module inside the K8s pod. Options:

**Option A (Recommended)**: Rebuild isolated-vm in the pod
```bash
kubectl exec deployment/tdsk-backend -- sh -c "cd repos/sandbox && npm rebuild isolated-vm"
```
If `npm rebuild` isn't available, try:
```bash
kubectl exec deployment/tdsk-backend -- sh -c "cd repos/sandbox/node_modules/isolated-vm && node-gyp rebuild"
```

**Option B**: Restart services with clean install
```bash
tdsk dev start --clean
# Then verify:
kubectl exec deployment/tdsk-backend -- node -e "require('/tdsk/repos/sandbox/node_modules/isolated-vm'); console.log('OK')"
```

**Option C**: If the above don't work, the Dockerfile or DevSpace config may need updating to ensure native modules are compiled during pod initialization. Check `deploy/` for Dockerfile or init scripts.

### Code improvement (optional, not required for test fix)

The silent error swallowing in `repos/sandbox/src/local.ts:147` should log the actual error:
```typescript
} catch (err) {
  runner = null
  console.warn(
    `isolated-vm not available — sandbox running without code execution isolation`,
    err instanceof Error ? err.message : String(err)
  )
}
```

---

## Execution Order

1. **Fix Category 1** — Update `createTestAuth()` mock (1 file edit)
2. **Fix Category 2** — Update imports + class names in 4 test files
3. **Run REPL integration tests** to verify Categories 1 & 2 pass
4. **Fix Category 3** — Rebuild isolated-vm in K8s pod
5. **Run full integration suite** to verify all 26 tests pass

## Files to modify

| File | Changes |
|------|---------|
| `repos/integration/src/utils/repl-auth.ts` | `getCredentials` → `creds`, `isLoggedIn` → `loggedIn` |
| `repos/integration/src/tier1/repl-auth-manager.test.ts` | Fix import path, update `isLoggedIn` → `loggedIn`, `getCredentials` → `creds` |
| `repos/integration/src/tier1/repl-http-adapter.test.ts` | Fix import paths, `HttpMessageAdapter` → `DBProxy` |
| `repos/integration/src/tier3/repl-executor-llm.test.ts` | Fix import paths, `LocalAgentExecutor` → `Executor` |
| `repos/integration/src/tier3/repl-executor-session.test.ts` | Fix import paths, `LocalAgentExecutor` → `Executor` |
| K8s pod | Rebuild `isolated-vm` native module for Linux |
