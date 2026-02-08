# Logger Repo Audit

## Summary

| Metric | Value |
|--------|-------|
| **Total Issues** | 36 |
| **Critical** | 4 |
| **High** | 8 |
| **Medium** | 13 |
| **Low** | 11 |
| **Source Files** | 16 (9 core + 5 utils + 2 types) |
| **Test Files** | 1 |
| **Test Coverage** | ~0% (1 test, 1 assertion -- `instanceof` check only) |
| **Dependencies** | 4 runtime, 5 dev |
| **Overall** | Functional core with significant silent-failure bugs in the API Logger layer. `buildApiLogger()` maps `debug`, `verbose`, and `silly` to Winston `info` -- silently losing log-level semantics across 23+ call sites in backend and proxy. The secret redaction subsystem (`safeReplacer`) has multiple bypass vectors, returns corrupted output on key matches, and silently swallows entire log lines on any error. The `express-winston` middleware (`setupLoggerReq`/`setupLoggerErr`) is a dead export -- never consumed by any repo. The redaction code is security-critical yet has zero test coverage. |

---

## Critical Issues

### C-01: `buildApiLogger` maps `debug`/`verbose`/`silly` to Winston `info` level -- log filtering broken
**File**: `src/apiLogger.ts:68-73`
```typescript
data: loggerWrap(`data`, logger, label),     // "data" is not a Winston level
log: loggerWrap(`info`, logger, label),
info: loggerWrap(`info`, logger, label),
debug: loggerWrap(`info`, logger, label),    // should be `debug`
verbose: loggerWrap(`info`, logger, label),  // should be `verbose`
silly: loggerWrap(`info`, logger, label),    // should be `silly`
```
**Impact**: All `logger.debug()` calls in backend (18 occurrences: OAuth tokens, proxy details, template caching, signal handling) and proxy (5 occurrences: auth, proxy response, signal handling) are silently logged at `info` level. This means:
- Setting `level: 'warn'` in production suppresses both `info` AND `debug` output together -- no granular control
- Debug-level noise (OAuth token details, proxy response codes, template cache events) cannot be filtered independently from operational `info` messages
- The `buildLogger` in `buildLogger.ts` defaults to `level: 'silly'` (line 40), so all levels pass through. But consumers pass configured levels (e.g., `config?.logger?.level`), and the level hierarchy is broken at the `buildApiLogger` wrapper layer

### C-02: `autoInit` is effectively a no-op; `setupLogger()` after import has no effect
**File**: `src/apiLogger.ts:16-19`
```typescript
let __logLabel: string = `TDSK Logger`  // line 8 -- always truthy

const autoInit = (logger: TWLogger = __logger, label: string = __logLabel) => {
  if (logger && label) return    // label is always truthy; once logger exists, always returns
  setupLogger({ label, tag: label })
}
```
**Impact**: The `setupLogger` function is exported as a public API, suggesting consumers can customize the logger after import. However:
1. `__logLabel` is initialized to `"TDSK Logger"` on line 8, so `label` is always truthy
2. Once `__logger` is created by any `loggerWrap` call, `autoInit` always returns immediately
3. Even if `setupLogger` were called, existing `loggerWrap` closures captured their `logger` parameter at creation time and would not pick up the new `__logger`

In practice, all 4 consumer repos (backend, proxy, database, agent) call `buildApiLogger(label, level)` which creates its own Winston logger on line 60 (`logger = logger || buildLogger({ label, level }, false)`), bypassing the module-level `__logger` entirely. The `setupLogger` export and the `ApiLogger` singleton are dead API surface.

### C-03: `safeReplacer` returns mangled key string instead of `"****"` on secret key match
**File**: `src/utils/safeReplacer.ts:104-107`
```typescript
if (typeof key === `string`) {
  const match = isSecret.key(key)
  if (match) return replaceSecretMatch(key, match.source, key !== value)
}
```
**Impact**: When a JSON key matches a secret pattern (e.g., `password`, `api_key`, `token`), the function calls `replaceSecretMatch(key, match.source, key !== value)`. This performs a regex replacement on the **key** string, not the **value**. The result is a corrupted version of the key name returned as the "redacted value."

Trace for `key="password"`, `value="hunter2"`:
1. `match` = `/passw(or)?d/i` (from `KEYS` array)
2. `match.source` = `"passw(or)?d"` -- contains parentheses, so `hasOr=true` in `replaceSecretMatch`
3. `replaceSecretMatch("password", "passw(or)?d", true)` runs regex `/(passw(or)?d)((:*|\s*)*)(.*)$/gim` on `"password"`
4. Returns `"password ****"` (the key name with `****` appended) -- the actual secret value `"hunter2"` is lost, but the output contains structural information instead of just `"****"`

### C-04: `replaceUnsafe` returns empty string on any error, silently swallowing all output
**File**: `src/utils/safeReplacer.ts:131-145`
```typescript
export const replaceUnsafe = (str: string) => {
  try {
    return safeReplacer(str, str)  // passes str as both key AND value
  } catch (err) {
    setTimeout(
      () => console.error(`[ERROR: replaceUnsafe] ...`),
      100
    )
    return ``  // entire log line vanishes
  }
}
```
**Impact**: Since `replaceUnsafe` is called from `stdio.ts` for every `process.stdout.write` and `process.stderr.write` call, any exception in the redaction logic causes the entire log line to be silently dropped. The error notification via `setTimeout(() => console.error(...), 100)` itself goes through the intercepted `stderr`, potentially causing additional errors.

Additionally, `replaceUnsafe` calls `safeReplacer(str, str)` passing the same string as both `key` and `value`. This means the secret-key matching logic on lines 104-106 also triggers for raw log strings. For example:
- `"Checking auth token status"` matches `/token/i` in `KEYS` (line 11)
- `"Password reset email sent"` matches `/passw(or)?d/i`
- Backend log `"Applied Bearer auth to Authorization"` matches `/bearer/i` and `/auth/i` in `unsafeValues`

Combined with C-03, these log messages get corrupted or replaced entirely instead of passing through unchanged.

---

## High Issues

### H-01: `express-winston` middleware exported but never consumed by any repo
**File**: `src/middleware.ts` (all 56 lines)

`setupLoggerReq` and `setupLoggerErr` are exported from the package, but no repo in the workspace imports them. Both backend and proxy implement their own `setupLogger`/`requestLogger` middleware:
- `repos/backend/src/middleware/setupLogger.ts` -- uses `buildApiLogger()` directly, adds request timing, request IDs, ignore rules
- `repos/proxy/src/middleware/setupLogger.ts` -- identical pattern, uses `buildApiLogger()` directly

This makes `express-winston` (4.2.0) a dead runtime dependency.

### H-02: `data()` method in `buildApiLogger` calls Winston `data()` which does not exist
**File**: `src/apiLogger.ts:68`
```typescript
data: loggerWrap(`data`, logger, label),
```
Winston's npm log levels are: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. There is no `data` level. The `loggerWrap` function calls `logger?.['data']?.(toLog)` (line 49). The optional chaining `?.` prevents a crash, but the call is a silent no-op. Any consumer calling `logger.data(...)` gets silently discarded output.

No consumer repo currently calls `logger.data()` (confirmed by search), but the method exists on the returned object and could mislead developers.

### H-03: `injectKeyValues` injects ALL object keys into the redaction list, causing false positives
**File**: `src/utils/injectKeyValues.ts:10-17`
```typescript
const keys = Object.keys(resp).filter(Boolean)
if (!keys?.length) return resp
injectUnsafe(keys)          // injects ALL keys (e.g., "id", "name", "type", "status")

const values = Object.values(resp).filter(Boolean)
values.length && injectUnsafe(values)  // injects ALL values
```
**Impact**: Every key from the injected object is added to the global `Injected` array for string-level redaction via `replaceAll`. Common keys like `"id"`, `"name"`, `"type"`, `"status"`, `"email"` would be redacted from all subsequent log output. If a secrets response like `{ id: "abc", name: "my-secret", value: "s3cr3t" }` is passed, every future log containing the substring `"id"` or `"name"` would have those substrings replaced with `"****"`.

No consumer repo currently calls `injectKeyValues` (confirmed by search), but it is exported as the public API for secret injection.

### H-04: `Injected` array grows unboundedly -- memory leak in long-running processes
**File**: `src/utils/safeReplacer.ts:54-56`
```typescript
let injectedRegEx: RegExp[] = []
let Injected: string[] = []
```
Every call to `injectUnsafe` appends to the module-level `Injected` array and `injectedRegEx` array. There is no eviction, size limit, or TTL -- only a simple `includes` check for deduplication. The `replaceInjected` function (lines 82-87) iterates the entire `Injected` array and calls `replaceAll` for each entry on every `stdout`/`stderr` write. `resetInjectedLogs()` exists (line 58) but is never called anywhere in the codebase.

### H-05: `stdio.ts` side-effect import monkey-patches `process.stdout.write` and `process.stderr.write` globally
**File**: `src/stdio.ts`

Importing `@tdsk/logger` (specifically anything from `apiLogger.ts`, which imports `./stdio` on line 3) immediately and irreversibly patches `process.stdout.write` and `process.stderr.write`. This affects ALL output in the process -- including third-party libraries, test frameworks, and debugging tools. There is no opt-in mechanism, no `restore()` function, and the `STL_FORCE_DISABLE_SAFE` env var bypasses only the redaction step, not the monkey-patch itself.

Lines 13 and 21 (`process.stdout.write.bind(process.stdout)` and `process.stderr.write.bind(process.stderr)`) are no-ops -- they create bound functions that are immediately discarded without assignment.

### H-06: `replaceUnsafe` passes same string as both key and value to `safeReplacer`
**File**: `src/utils/safeReplacer.ts:133`
```typescript
return safeReplacer(str, str)
```
`safeReplacer(key, value)` was designed for use as a `JSON.stringify` replacer where `key` and `value` are semantically distinct. When the same string is passed as both, the secret-key matching logic on lines 104-106 triggers on raw log strings, not just JSON keys. Any log message containing words like `"token"`, `"auth"`, `"password"`, `"secret"`, `"pass"`, or `"bearer"` gets treated as a secret key match.

This is distinct from C-04 because it describes a design flaw in normal (non-error) operation -- the function misidentifies ordinary log text as secret keys even when no exception occurs.

### H-07: `loggerWrap` data accumulation corrupts structure on multiple collection arguments
**File**: `src/apiLogger.ts:34-46`
```typescript
isColl(arg)
  ? !obj.data
    ? (obj.data = arg)
    : (obj.data = [...obj.data, arg])  // spreads object as array
  : (obj.message = `${obj.message} ${arg}`)
```
When multiple collection arguments are passed to a log method (e.g., `logger.info("msg", {a:1}, {b:2})`):
1. First collection: `obj.data = {a:1}` -- an object
2. Second collection: `obj.data = [...{a:1}, {b:2}]` -- spreading a non-iterable object

If the first `obj.data` is a plain object (not an array), `[...obj.data, arg]` will either throw a `TypeError` (object is not iterable) or produce unexpected results depending on the object's iterator protocol. This silently corrupts the logged data structure.

### H-08: `header`/`subHeader` line construction produces correct-length string by accident
**File**: `src/logger.ts:211, 238`
```typescript
const line = middle.split('').reduce((line, item, index) => (line += ' '))
```
The `reduce` has no initial value, so the accumulator starts as the first character of `middle`. Each iteration appends a space. For an N-character string split into N elements, there are N-1 iterations, producing `first_char + (N-1) spaces` = N characters. Since `middle` starts with spaces, the result happens to be a string of N spaces -- the correct length. The code is functionally correct but only by coincidence. If `middle` ever started with a non-space character, the underline decoration would contain a visible character.

---

## Medium Issues

### M-01: `buildLogger` singleton pattern ignores configuration after first call
**File**: `src/utils/buildLogger.ts:36`
```typescript
if (defaultLogger && __LOGGER) return __LOGGER
```
When `defaultLogger=true` (the default), the first call creates `__LOGGER` and all subsequent calls return it regardless of different `options`. If two modules call `buildLogger` with different labels or levels, only the first one's configuration applies.

In practice, `buildApiLogger` passes `false` for `defaultLogger` (line 60 of `apiLogger.ts`), so each consumer gets its own logger. But direct `buildLogger` callers (like `middleware.ts` lines 20, 44) share the singleton.

### M-02: `Log` class constructor overrides `this.log` twice
**File**: `src/logger.ts:100, 104`
```typescript
Object.keys(this.colorMap).map((key) => (this[key] = logData(this, key)))
// ...
this.log = this.print  // overwrites the logData-generated `log`
```
Line 100 sets `this.log = logData(this, 'log')` (white-colored console.log). Line 104 immediately overrides it with `this.print` (uncolored console.log with tag support). This means `Logger.log()` does NOT apply colors, unlike every other method (error, warn, info, etc.). This may be intentional but is surprising and undocumented.

### M-03: `Log.pair` and `Log.label` reference singleton `Logger` instead of `this`
**File**: `src/logger.ts:259-260`
```typescript
pair = (title?: string, message?: string) => {
  const toLog = []
  title && toLog.push(Logger.colors.brightCyan(title))     // should be this.colors
  message && toLog.push(Logger.colors.brightWhite(message)) // should be this.colors
  toLog.length && this.print(...toLog)
}
```
If a second `Log` instance were created with different color settings, `pair` would still use the singleton's colors, violating instance encapsulation.

### M-04: `Log.highlight` calls `this.log` which is aliased to `this.print`
**File**: `src/logger.ts:326-328`
```typescript
highlight = (start = '', highlight = '', end = '') => {
  this.log(`${start}`, Logger.colors.cyan(highlight), end)
}
```
Since `this.log` is `this.print` (M-02), and `buildApiLogger` maps `highlight` to `loggerWrap('info')`, the CLI Logger's `highlight` and the API Logger's `highlight` behave completely differently. Also references singleton `Logger.colors` instead of `this.colors`.

### M-05: `logData` crashes on `undefined` arguments
**File**: `src/logger.ts:29-34`
```typescript
return typeof data === `object` || Array.isArray(data)
  ? colors[logColor](JSON.stringify(data, null, 2))
  : typeof data.toString === `function`
    ? colors[logColor](data.toString())
    : colors[logColor](data)
```
If `data` is `undefined`, `typeof data` is `"undefined"` (not `"object"`), so the first branch is skipped. Then `typeof data.toString` throws `TypeError: Cannot read properties of undefined (reading 'toString')`. While uncommon, passing `undefined` as a log argument would crash.

### M-06: `unsafeValues` array has duplicate `/token/i` entry
**File**: `src/utils/safeReplacer.ts:33, 40`
```typescript
const unsafeValues = [
  /token/i,        // line 33
  /auth/i,
  /bearer/i,
  /passw(or)?d/i,
  /^pw$/,
  /^pass$/i,
  /secret/i,
  /token/i,        // line 40 -- exact duplicate
  ...
]
```
Minor performance waste and copy-paste indicator.

### M-07: `stripColors` only strips when `TDSK_TEST_COLORS` is explicitly disabled
**File**: `src/utils/stripColors.ts:1-13`
```typescript
export const loggerColorDisabled = () => {
  const noColors =
    process.env.TDSK_TEST_COLORS === `0` ||
    (process.env.TDSK_TEST_COLORS || ``).toLowerCase().startsWith(`f`)
  return noColors
}
```
The function name `stripColors` suggests it always strips ANSI codes, but it only strips when `TDSK_TEST_COLORS=0` or `TDSK_TEST_COLORS=false`. In production (where the env var is not set), `stripColors` returns the string unchanged. This means the `stdio.ts` interceptor passes ANSI escape sequences into `replaceUnsafe`, which runs regex matching against strings containing escape codes -- potentially causing false matches or regex failures.

### M-08: `@keg-hub/parse-config` is a runtime dependency but only used in dev scripts
**File**: `package.json:32`

`@keg-hub/parse-config` (2.2.0) is listed under `dependencies` but only imported in `scripts/loadEnvs.ts`, used by `vitest.config.ts` (dev-time only). Should be a `devDependency`.

### M-09: `utils/index.ts` does not re-export all utils
**File**: `src/utils/index.ts`
```typescript
export * from './helpers'
export * from './stripColors'
export * from './injectKeyValues'
```
Missing re-exports: `./buildLogger`, `./colors`, `./levels`, `./safeReplacer`. These are exported directly from `src/index.ts` instead. The `utils/index.ts` barrel file is incomplete and misleading.

### M-10: `STL_FORCE_DISABLE_SAFE` env var check is truthy, not boolean
**File**: `src/stdio.ts:9`
```typescript
const replaced = process.env.STL_FORCE_DISABLE_SAFE ? str : replaceUnsafe(str)
```
Any non-empty string value (including `"false"`, `"0"`, `"no"`) for `STL_FORCE_DISABLE_SAFE` will disable redaction. This is inconsistent with `TDSK_TEST_COLORS` in `stripColors.ts` which explicitly checks for `"0"` or `"f..."`.

### M-11: `getLevelMethods` is exported but never consumed
**File**: `src/utils/levels.ts:52-62`

The function is defined and exported but never called anywhere in the logger repo or any consuming repo. Dead code.

### M-12: `levels` object has mistyped `check` property
**File**: `src/utils/levels.ts:37-50`
```typescript
export const levels: TLogLevels = Object.entries(levelMap).reduce(
  (acc, [level, num]) => {
    acc.check[level] = (lvl: string | number) => compare(lvl, num)
    return acc
  },
  { compare, check: {}, levels: {} } as TLogLevels
)
```
The `TLogLevels` type (line 59 of `logger.types.ts`) defines `check` as `(lvl: string | number) => boolean` -- a single function. But the actual runtime value is an object keyed by level names. The `as TLogLevels` assertion masks this structural mismatch.

### M-13: `loadEnvs` and `addToProcess` in `scripts/` duplicate code from domain repo
**Files**: `scripts/loadEnvs.ts`, `scripts/addToProcess.ts`

These are code duplicates of equivalent files in the domain, backend, proxy, database, and CLI repos. Any bug fix or update must be applied in all places.

---

## Low Issues

### L-01: `ApiLogger` singleton created at module load time with default label
**File**: `src/apiLogger.ts:78`
```typescript
export const ApiLogger = buildApiLogger()
```
Creates a Winston logger with label `"TDSK Logger"` and level `"info"` at import time. No consumer repo imports `ApiLogger` (all use `buildApiLogger()` directly), making this a wasted resource allocation.

### L-02: `Log.toggleTag` signature does not match type definition
**File**: `src/logger.ts:135-138` vs `src/types/logger.types.ts:100`

`toggleTag` does not accept a parameter (toggles module-level `TAG_DISABLED`), but the type definition says `toggleTag: (toggle: boolean) => void`.

### L-03: `Log.removeTag` sets `tag` to `undefined` instead of `false`
**File**: `src/logger.ts:125`

The `tag` property is initialized as `false` (line 60), but `removeTag` sets it to `undefined`. Both are falsy so behavior is the same, but violates the type contract `tag: string | boolean`.

### L-04: No TypeScript return type on `buildApiLogger`
**File**: `src/apiLogger.ts:55`

The return type is inferred as a plain object with string-keyed methods. Without an explicit return type, consumers lose IDE autocompletion for the available methods.

### L-05: `safeReplacer` `possibleArrayKeys` transforms string values into arrays
**File**: `src/utils/safeReplacer.ts:125-126`
```typescript
if (possibleArrayKeys.includes(key) && value.indexOf('\n') >= 0)
  return value.split('\n').map((x) => x.trim())
```
When the key is `"stack"` or `"message"` and the value contains newlines, the return type changes from `string` to `string[]`. This type inconsistency may surprise consumers of `JSON.stringify` replacer output.

### L-06: `escapeStrForRegEx` does not escape forward slashes
**File**: `src/utils/safeReplacer.ts:28-30`

The regex escape function handles most special characters but not `/`. While rarely an issue with `new RegExp()` construction, it is an incomplete implementation.

### L-07: `colors.underline` and `colors.dim` include `colorMap` key
**File**: `src/utils/colors.ts:46-56`

`Object.keys(colorsFuncs)` includes `"colorMap"`, so `colors.underline.colorMap` and `colors.dim.colorMap` become functions that call `colorsFuncs.colorMap(log)`. Since `colorsFuncs.colorMap` is an object (not a function), accessing `colors.underline.colorMap("text")` would throw a TypeError.

### L-08: `TSetupLogger` makes `label` optional but `buildLogger` may receive `undefined`
**File**: `src/types/logger.types.ts:126-129`

`TSetupLogger` omits `label` from `TLogOpts` and re-adds as optional. In `setupLogger`, `label` defaults to `tag` which defaults to `undefined`. So `buildLogger` can receive `label: undefined`, which would use the fallback `"TDSK"` from `buildLogger.ts:41`.

### L-09: Unused `capitalize` and `identity` exports from helpers
**File**: `src/utils/helpers.ts:5-6`

`capitalize` and `identity` are re-exported from `@keg-hub/jsutils` but never used within the logger repo or any consuming repo.

### L-10: `module-alias` devDependency never used
**File**: `package.json:38`

`module-alias` (2.2.3) is listed as a devDependency but is never imported or referenced in any source or config file.

### L-11: `vitest.config.ts` calls `loadEnvs({ force: true })` -- tests depend on deploy config files
**File**: `configs/vitest.config.ts:11`

This loads environment variables from the deploy directory for tests. Tests may fail in CI or fresh clones if these config files are absent.

---

## Test Coverage Assessment

### Current State
- **Test File**: `src/logger.test.ts` -- 1 file, 1 test suite, 1 test
- **Single Assertion**: Verifies `Logger instanceof Log` is `true`
- **Effective Coverage**: ~0%

### What Is NOT Tested
| Module | Lines | Coverage |
|--------|-------|----------|
| `apiLogger.ts` | 79 | 0% -- `buildApiLogger`, `setupLogger`, `loggerWrap`, `autoInit` all untested |
| `middleware.ts` | 57 | 0% -- `setupLoggerReq`, `setupLoggerErr` untested |
| `stdio.ts` | 24 | 0% -- stdout/stderr hijacking untested |
| `safeReplacer.ts` | 146 | 0% -- ALL redaction logic untested |
| `injectKeyValues.ts` | 21 | 0% -- secret injection untested |
| `buildLogger.ts` | 63 | 0% -- Winston factory untested |
| `levels.ts` | 63 | 0% -- level comparison untested |
| `colors.ts` | 57 | 0% -- color functions untested |
| `stripColors.ts` | 14 | 0% -- color stripping untested |
| `logger.ts` | 335 | ~1% -- only instanceof check |

### Assessment
This is the security-critical module of the entire platform -- responsible for redacting secrets from all process output. Having zero tests for the redaction logic (`safeReplacer`, `injectUnsafe`, `replaceUnsafe`, `injectKeyValues`) means there is no validation that secrets are actually redacted. The critical bugs (C-03, C-04) in `safeReplacer` would have been caught by even basic unit tests.

---

## Cross-Repo Integration

### Consumers

| Repo | Import | What It Uses | File Count |
|------|--------|-------------|------------|
| **backend** | `buildApiLogger` | `buildApiLogger(config?.logger?.label, config?.logger?.level)` -- `logger.info()`, `logger.debug()`, `logger.error()`, `logger.warn()` | 15+ files |
| **proxy** | `buildApiLogger` | Same pattern as backend | 8+ files |
| **database** | `buildApiLogger` | Same pattern as backend | 1 file |
| **agent** | `buildApiLogger` | Same pattern as backend | 1 file |
| **cli** | `Logger` (Log class) | `Logger.pair()`, `Logger.log()`, `Logger.stderr`, `Logger.colors.*`, `Logger.warn()` | 12 files |

### Cross-Repo Impact of Bugs

1. **C-01 (debug mapped to info)**: Backend has 18 `logger.debug()` calls covering OAuth tokens, proxy details, template caching, and signals. Proxy has 5 `logger.debug()` calls for auth, proxy response, and signals. All are emitted at `info` level, making production log filtering impossible.

2. **C-03/C-04/H-06 (safeReplacer issues)**: The `stdio.ts` import is triggered by `apiLogger.ts:3` (`import './stdio'`). Every repo importing from `@tdsk/logger` gets `stdout`/`stderr` monkey-patched. Backend logs like `"Applied Bearer auth to Authorization"` contain words "Bearer" and "auth" which match unsafe patterns, causing log output corruption.

3. **Backend `logger[logLevel]` dynamic access**: `repos/backend/src/middleware/setupLogger.ts:37` uses `logger[logLevel]` where `logLevel` is `"error"`, `"warn"`, or `"info"`. This works because all three are present on the `buildApiLogger` return object. But if someone added `"http"` or `"debug"`, it would silently map to `info` due to C-01.

### Unused Exports (never imported by any consumer)

| Export | Source |
|--------|--------|
| `setupLoggerReq` | `middleware.ts` |
| `setupLoggerErr` | `middleware.ts` |
| `ApiLogger` | `apiLogger.ts` |
| `setupLogger` | `apiLogger.ts` |
| `getLevelMethods` | `levels.ts` |
| `levels` | `levels.ts` |
| `levelMap` | `levels.ts` |
| `colors` | `colors.ts` |
| `stripColors` | `stripColors.ts` |
| `loggerColorDisabled` | `stripColors.ts` |
| `safeReplacer` | `safeReplacer.ts` |
| `replaceUnsafe` | `safeReplacer.ts` |
| `injectUnsafe` | `safeReplacer.ts` (internal use only) |
| `injectKeyValues` | `injectKeyValues.ts` |
| `resetInjectedLogs` | `safeReplacer.ts` |
| `identity`, `capitalize` | `helpers.ts` |

### Middleware Divergence

Both backend and proxy implement their own request-logging middleware instead of using the logger package's `setupLoggerReq`/`setupLoggerErr`. These custom middlewares:
1. Use `buildApiLogger()` directly (not `express-winston`)
2. Implement request timing (`Date.now()` diff)
3. Generate request IDs
4. Have ignore rules for methods/routes (e.g., `OPTIONS`, health check paths)

This makes `express-winston` (4.2.0) and the entire `middleware.ts` file dead code.

---

## Architecture Notes

### Module Graph
```
index.ts
  ├── logger.ts (CLI Logger - Log class, singleton Logger)
  │   └── utils/colors.ts (ANSI color functions)
  ├── apiLogger.ts (API Logger - buildApiLogger factory)
  │   ├── stdio.ts (SIDE-EFFECT: hijacks process.stdout.write / process.stderr.write)
  │   │   ├── utils/stripColors.ts
  │   │   └── utils/safeReplacer.ts (secret redaction)
  │   ├── utils/buildLogger.ts (Winston factory)
  │   └── utils/helpers.ts (@keg-hub/jsutils re-exports)
  ├── middleware.ts (express-winston wrappers -- UNUSED)
  │   ├── utils/levels.ts
  │   └── utils/buildLogger.ts
  ├── utils/levels.ts (level constants & comparison)
  ├── utils/colors.ts
  ├── utils/buildLogger.ts
  ├── utils/stripColors.ts
  ├── utils/safeReplacer.ts
  └── utils/injectKeyValues.ts
```

### Dual Logger Design

The package maintains two unrelated logging systems:
1. **Winston-based** (`buildApiLogger`): Creates a Winston logger and wraps it in a plain object with methods like `info`, `debug`, `error`, etc. Used by server-side repos (backend, proxy, database, agent).
2. **Console-based** (`Log` class / `Logger` singleton): A colorized console logger for CLI output. Uses ANSI color codes and `console.log`. Used by the CLI repo.

These two systems share nothing except the `stdio.ts` monkey-patch (which only activates when `apiLogger.ts` is imported) and some utility exports.

### Side-Effect Architecture

The `stdio.ts` file is imported via `apiLogger.ts:3` as a bare side effect (`import './stdio'`). This means:
- Any import of `buildApiLogger`, `ApiLogger`, or `setupLogger` triggers `stdout`/`stderr` patching
- The `Log` class (`logger.ts`) does NOT import `apiLogger.ts`, so CLI usage alone does NOT trigger the side effect
- The side effect is process-global and cannot be undone
- `STL_FORCE_DISABLE_SAFE` env var bypasses the redaction but not the monkey-patch itself

### Patterns
- **Singleton**: `Logger` (CLI Log class), `__LOGGER` (Winston, in buildLogger.ts), `__logger` (in apiLogger.ts)
- **Factory**: `buildLogger()`, `buildApiLogger()`
- **Side-effect import**: `import './stdio'` in `apiLogger.ts`
- **Global mutation**: `process.stdout.write` / `process.stderr.write` overwritten at import time

### Dependencies

| Package | Version | Used In | Status |
|---------|---------|---------|--------|
| `winston` | 3.17.0 | `buildLogger.ts`, `middleware.ts`, `levels.ts` | Active |
| `express-winston` | 4.2.0 | `middleware.ts` | **Dead** -- never consumed by any repo |
| `@keg-hub/jsutils` | 10.0.0 | `helpers.ts`, `injectKeyValues.ts`, `middleware.ts` | Active (partially -- `identity`, `capitalize` unused) |
| `@keg-hub/parse-config` | 2.2.0 | `scripts/loadEnvs.ts` only | Should be devDep |
| `alias-hq` | 6.2.4 | `vitest.config.ts`, `loadEnvs.ts` | devDep (correct) |
| `module-alias` | 2.2.3 | Not used anywhere | **Dead devDep** |
| `tsup` | 8.3.6 | Build config | devDep (correct) |
| `vite-tsconfig-paths` | 4.3.2 | `vitest.config.ts` | devDep (correct) |
| `vitest` | 1.6.1 | Tests | devDep (correct) |

### Build
- **Tool**: tsup (esbuild)
- **Format**: CJS only (`format: ['cjs']`)
- **Output**: `dist/log/`
- **Entry**: `src/index.ts`
- **Externals**: All deps + devDeps
- **Sourcemaps**: Enabled
- **Splitting**: Disabled
