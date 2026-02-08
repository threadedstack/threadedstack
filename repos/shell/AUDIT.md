# Shell Repo Audit

**Date**: 2026-02-08
**Repo**: `repos/shell/` (`@tdsk/shell`)
**Files audited**: 22 source files in `src/`, 5 config files, 6 script files, 1 test file, 1 WIT file
**Vitest cached results**: 1 test suite, 64ms (stale -- tests cannot currently run)

---

## Summary

The shell repo provides a cross-platform virtual shell abstraction over the `just-bash` library, targeting browser (IndexedDB), Node.js, and Bun runtimes. The codebase is in an early/experimental state with significant architectural issues:

- The **main export** (`src/shell.ts`) is a 49-line experimental stub that tests `join`/`dirname` -- the real Shell class lives in `src/shell.ts.bak` and is never exported
- There are **two conflicting StreamManager implementations** -- one using Node.js streams (`src/utils/streams.ts`), one using WHATWG streams (`src/io/StreamManager.ts`) -- with the Shell class in `.bak` referencing the Node.js one while the only test file targets the WHATWG one
- The vitest config depends on `vite-plugin-node-polyfills` which is **not in package.json and not installed** anywhere (verified in both local and root `node_modules/`)
- `just-bash` is listed as a devDependency but is imported at runtime throughout the codebase
- The web worker (`shell.worker.ts`) is a complete stub returning fake output
- The `IndexedDBFileSystem` (870 lines, fully implemented) is never wired into the filesystem creation path

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High     | 10 |
| Medium   | 10 |
| Low      | 8 |
| **Total** | **33** |

---

## Critical Issues

### C-01: Shell class replaced with 49-line experimental stub -- entire library non-functional
**File**: `src/shell.ts` (lines 1-49)
**Real class**: `src/shell.ts.bak` (lines 1-323)
**Impact**: The entire `@tdsk/shell` library is broken for any consumer

**Verified**: The current `src/shell.ts` exports only a `run` function that:
- Imports `Bash` and `ReadWriteFs` from `just-bash` but uses neither
- Calls `join('/duper', 'file.txt')` and `dirname()` on the result
- Logs those paths via `console.log` with debug markers
- Contains ~25 lines of commented-out code (lines 14-44) exploring different approaches
- Returns empty string on success, `'ERROR: ' + err` on failure

The full Shell class (323 lines) exists in `src/shell.ts.bak` with proper `initialize()`, `execute()`, `cd()`, `pwd()`, `destroy()`, `reset()`, `getStreams()`, `getState()`, `getPlatform()`, `getHomeDir()`, `isInitialized()`, and `getExecutionCount()` methods. The `.bak` file is not imported by anything.

The barrel export `src/index.ts` line 2 does `export * from './shell'`, so consumers get the `run` stub, not the `Shell` class.

### C-02: just-bash is devDependency but required at runtime
**File**: `package.json` (line 42)
**Impact**: Production builds and standalone installs will fail

`just-bash@2.5.5` is listed under `devDependencies` but is imported at runtime by:
- `src/shell.ts:1` -- `import { Bash, ReadWriteFs } from 'just-bash'`
- `src/shell.ts.bak:1,9` -- imports and instantiates `Bash`
- `src/io/StreamManager.ts:24` -- `import type { Bash } from 'just-bash'`
- `src/utils/filesystem.ts:1` -- `import { MountableFs, ReadWriteFs, InMemoryFs } from 'just-bash'`
- `src/fs/IndexedDBFileSystem.ts:7-14` -- `import type { IFileSystem, FsStat, ... } from 'just-bash'`
- `src/fs/index.ts:6` -- `export type { IFileSystem, FsStat, FileContent } from 'just-bash'`
- `src/constants/bash.ts:1` -- `import type { BashOptions } from 'just-bash'`
- `src/types/shell.types.ts:2` -- `import type { Bash, BashOptions } from 'just-bash'`
- `src/tests/StreamManager.test.ts:8` -- `import { Bash } from 'just-bash'`

The `tsup.config.ts` `getExternal()` function (lines 12-17) marks all deps/devDeps as external (except `@tdsk` and `@keg-hub` prefixed), so `just-bash` is excluded from the bundle and must be available at runtime.

### C-03: Tests cannot run -- vitest config imports missing vite-plugin-node-polyfills
**File**: `configs/vitest.config.ts` (line 8)
**Impact**: `pnpm test` fails immediately; no tests execute

```typescript
import { nodePolyfills } from 'vite-plugin-node-polyfills'
```

**Verified**: This package is:
- Not in `package.json` (neither dependencies nor devDependencies)
- Not installed in local `node_modules/` (confirmed via filesystem check)
- Not installed in root workspace `node_modules/` (confirmed via filesystem check)

The plugin is used in the vitest config's plugins array (lines 58-64) to polyfill `buffer`, `process`, and `stream` for browser test environments. Without it, the vitest config fails to load.

The cached `results.json` shows a previous successful run (vitest 1.6.1), indicating the dependency existed at some point and was removed.

### C-04: dangerouslyAllowFullInternetAccess: true hardcoded in default bash options
**Files**: `src/constants/bash.ts` (lines 8-10), `src/shell.ts.bak` (lines 37-40)
**Impact**: Security -- any shell instance allows unrestricted network access by default

In `src/constants/bash.ts`:
```typescript
export const DefBashOpts: BashOptions = {
  // ...
  network: {
    dangerouslyAllowFullInternetAccess: true,
  },
}
```

In `src/shell.ts.bak` constructor (lines 35-41):
```typescript
bashOptions: {
  ...options?.bashOptions,
  network: {
    dangerouslyAllowFullInternetAccess: true,
    ...options?.bashOptions?.network,
  },
},
```

In the `.bak` file, user network options spread after the dangerous flag so they CAN override it to `false`. However, the `DefBashOpts` constant has no override mechanism and is exported for any consumer to use directly. Given this repo's purpose of running AI-generated commands (per the agent repo integration), enabling unrestricted network access by default is a significant security risk.

### C-05: cd() in shell.ts.bak interpolates user path into command string without escaping
**File**: `src/shell.ts.bak` (line 297)
**Impact**: Command injection via path argument

```typescript
const result = await this._state.bash.exec(`cd ${path} && pwd`, {
  cwd: this._currentWorkingDirectory,
})
```

The `path` parameter is interpolated directly into the shell command string with zero escaping or validation. A path like `; rm -rf /` or `$(malicious_command)` would execute arbitrary commands within the just-bash sandbox. While just-bash runs in a WASM sandbox (mitigating OS-level damage), this still allows unintended command execution within the sandbox, and combined with C-04's unrestricted network access, could enable data exfiltration.

---

## High Issues

### H-01: Two conflicting StreamManager classes with same name
**Files**: `src/utils/streams.ts` (Node.js streams, 181 lines), `src/io/StreamManager.ts` (WHATWG streams, 342 lines)
**Impact**: Architectural confusion; wrong class used in different contexts

**Node.js StreamManager** (`src/utils/streams.ts`):
- Uses `PassThrough` from `node:stream`
- Has `getStreams()`, `getStdout()`, `getStderr()`, `clearBuffers()`, `write()`, `writeLine()`, `endInput()`, `destroy()`, `createCommandStreams()`
- Exported via `src/utils/index.ts` -> `src/index.ts` (the **main export**)
- Referenced by Shell class in `.bak` file

**WHATWG StreamManager** (`src/io/StreamManager.ts`):
- Uses `ReadableStream`, `WritableStream`, `CountQueuingStrategy`
- Has `exec()`, `pipe()`, `pipeStderr()`, `teeStdout()`, `getCombinedOutput()`, `close()`, `isHealthy()`, `getStdinQueueSize()`
- Exported via `src/io/index.ts` but **NOT re-exported from `src/index.ts`**
- Tested by the only test file (`src/tests/StreamManager.test.ts`)

The WHATWG version is the more feature-complete implementation (piping, teeing, combined output, backpressure) but is unreachable from the public API. The Node.js version is exported but breaks browser compatibility.

### H-02: TShellStreams uses node:stream types, breaking browser compatibility
**File**: `src/types/shell.types.ts` (lines 3, 64-68)
**Impact**: Browser consumers get type errors or runtime failures

```typescript
import type { Readable, Writable } from 'node:stream'

export type TShellStreams = {
  stdin: Writable
  stdout: Readable
  stderr: Readable
}
```

This type is used by the Node.js StreamManager's `getStreams()` return type (line 60) and `createCommandStreams()` (line 165). In browser environments, `node:stream` is unavailable. This contradicts the repo's stated goal of cross-platform (Browser/Node/Bun) support.

### H-03: IndexedDBFileSystem fully implemented (870 lines) but never wired in
**File**: `src/fs/IndexedDBFileSystem.ts` (870 lines), `src/utils/filesystem.ts` (lines 21-35)
**Impact**: 870 lines of dead code; browser persistence does not work

The `IndexedDBFileSystem` is a complete `IFileSystem` implementation with:
- Full POSIX-like operations (readFile, writeFile, appendFile, mkdir, readdir, rm, cp, mv, chmod, symlink, link, readlink, stat, lstat)
- Symlink resolution with cycle detection
- Multiple encoding support (utf-8, base64, hex, binary, ascii, latin1)
- Proper error handling with POSIX error codes

However, in `src/utils/filesystem.ts` (lines 21-35), the browser path always creates `InMemoryFs`:

```typescript
if (platform === EPlatform.Browser) {
  if (persistent && typeof indexedDB !== 'undefined') {
    // Note: just-bash may not have direct IndexedDB support
    // We'll use InMemoryFs for now but can be extended
    const memFs = new InMemoryFs()
    await mountableFs.mount('/home', memFs)
  } else {
    const memFs = new InMemoryFs()
    await mountableFs.mount('/home', memFs)
  }
}
```

Both branches do the exact same thing. The `persistent` parameter has no effect. The comment on line 25-26 explicitly acknowledges the `IndexedDBFileSystem` is not used.

### H-04: WHATWG StreamManager exec() collects stdin but never passes it to bash
**File**: `src/io/StreamManager.ts` (lines 152-159)
**Impact**: stdin input is silently discarded

```typescript
async exec(command: string): Promise<void> {
  try {
    const stdin = this.stdinQueue.join('')  // Collected
    this.stdinQueue = []                     // Queue cleared

    const result = await this.bash.exec(command)  // stdin NOT passed
```

The `stdin` variable is computed and the queue is cleared, but the collected stdin content is never passed to `this.bash.exec()`. Any data written to the `WritableStream<string>` stdin is silently discarded on every command execution.

### H-05: getAllPaths() silently returns empty array
**File**: `src/fs/IndexedDBFileSystem.ts` (lines 785-789)
**Impact**: Any code relying on path enumeration gets no results

```typescript
getAllPaths(): string[] {
  // This is synchronous in the interface, but IndexedDB is async
  // Return empty array - most implementations don't need this
  return []
}
```

The `IFileSystem` interface requires `getAllPaths()` to be synchronous, but IndexedDB is async-only. Rather than maintaining a synchronous cache or throwing, it returns `[]`. Any just-bash internals or consumer code calling `getAllPaths()` will see an empty filesystem.

### H-06: mv() uses two separate IndexedDB transactions -- not atomic
**File**: `src/fs/IndexedDBFileSystem.ts` (lines 754-770)
**Impact**: Partial failure can lose or duplicate data

```typescript
async mv(src: string, dest: string): Promise<void> {
  // ...
  await this.putEntry(destNormalized, srcEntry)  // Transaction 1
  await this.deleteEntry(srcNormalized)           // Transaction 2
}
```

Each `putEntry()` and `deleteEntry()` call creates its own IndexedDB transaction via the `transaction()` helper (line 213-228). If the process crashes between the two operations, the file could exist in both locations or be lost entirely.

### H-07: Hard link shares buffer reference instead of clone
**File**: `src/fs/IndexedDBFileSystem.ts` (lines 844-853)
**Impact**: Modifying one hard-linked file's content mutates the other

```typescript
const newEntry: StoredEntry = {
  type: 'file',
  content: existingEntry.content,  // Shares same Uint8Array reference
  mode: existingEntry.mode,
  mtime: Date.now(),
  size: existingEntry.size,
}
```

Unlike `cp()` which properly clones: `content: new Uint8Array(srcEntry.content!)` (line 734), `link()` shares the same `Uint8Array` reference. Any in-memory mutation to one file's content buffer will affect the other before the next persistence to IndexedDB.

### H-08: Worker execute() is a stub returning fake output
**File**: `src/worker/shell.worker.ts` (lines 58-116)
**Impact**: Worker-based execution produces fabricated results

The `execute()` function contains:
```typescript
// TODO: Execute actual command via shell instance
// For now, simulate execution
```

It returns hardcoded fake output for every command:
```typescript
return {
  stdout: `Executed: ${request.command}\nEnv vars: ${Object.keys(execEnv).length}`,
  stderr: '',
  exitCode: 0,
  duration,
}
```

No actual shell execution occurs. Any code using `ShellWorker.execute()` gets incorrect results.

### H-09: ShellWorker timeout setTimeout never cleared on success
**File**: `src/worker/ShellWorker.ts` (lines 192-199)
**Impact**: Timer leak -- dangling timeouts accumulate with each request

```typescript
setTimeout(() => {
  const pending = this.pendingRequests.get(id)
  if (pending) {
    this.pendingRequests.delete(id)
    pending.reject(new Error('Request timeout'))
  }
}, 30000)
```

The `setTimeout` timer ID is never stored or cleared when the request resolves successfully. While the callback checks if the pending request still exists (it won't after resolution, so it's a no-op), the timeout object itself lives for 30 seconds per request. In high-throughput scenarios, thousands of dangling timers accumulate in the event loop.

### H-10: Node.js StreamManager streams are created but never connected to bash execution
**Files**: `src/utils/streams.ts`, `src/shell.ts.bak` (lines 94-95, 141-148)
**Impact**: Exported streams never carry data from command execution

In `shell.ts.bak`:
```typescript
// Line 94-95 in initialize()
this._streamManager = new StreamManager()
const streams = this._streamManager.getStreams()  // assigned but never used
```

The `streams` variable is assigned but never passed to bash or written to. In `execute()` (lines 141-148), the method reads `result.stdout` and `result.stderr` directly from the `bash.exec()` return value rather than from the streams. The Node.js `StreamManager` creates `PassThrough` streams and sets up `data` event listeners, but nothing ever writes to them. The `getStreams()` method on the Shell class (line 195) returns these empty streams to consumers.

---

## Medium Issues

### M-01: src/index.ts exports non-existent Shell class
**File**: `src/index.ts` (line 2)
**Impact**: Consumers importing `Shell` get undefined

`src/index.ts` does `export * from './shell'`. The current `src/shell.ts` exports only a `run` function. Any consumer expecting `import { Shell } from '@tdsk/shell'` will get `undefined`. The barrel also exports types like `TShellOptions`, `TShellState`, `TExecutionResult` from `./types` -- these types reference `Bash` and `BashOptions` which assume a Shell class exists.

### M-02: Two identical browser branches in createFileSystem
**File**: `src/utils/filesystem.ts` (lines 21-35)
**Impact**: Dead code; `persistent` flag has no effect

Both branches of `if (persistent && typeof indexedDB !== 'undefined')` and `else` execute identical code: create `InMemoryFs` and mount at `/home`. The `persistent` parameter accepted by `createFileSystem()` is silently ignored.

### M-03: getCombinedOutput() deadlocks when one stream has no data
**File**: `src/io/StreamManager.ts` (lines 302-341)
**Impact**: Combined output stream hangs indefinitely

```typescript
const [stdoutResult, stderrResult] = await Promise.all([
  stdoutReader.read(),
  stderrReader.read(),
])
```

`Promise.all` waits for both `read()` calls to resolve. If stdout produces output but stderr has no data (or vice versa), the `read()` on the empty stream blocks forever. The loop only breaks when both `.done` are true simultaneously, but streams rarely produce output at the same cadence.

### M-04: vitest config references non-existent test files
**File**: `configs/vitest.config.ts` (lines 20-28)
**Impact**: Environment matching configuration is inert

The `environmentMatchGlobs` references 4 test files that do not exist:
- `tests/unit/IndexedDBFileSystem.test.ts`
- `tests/fs/IndexedDBFileSystem.test.ts`
- `tests/unit/WebWorker.test.ts`
- `tests/integration/browser.test.ts`

The only actual test file is `src/tests/StreamManager.test.ts`. The `include` pattern `['src/**/*.test.ts']` would find it, but the jsdom environment mapping targets phantom files.

### M-05: Coverage thresholds set to 80% but actual coverage is near 0%
**File**: `configs/vitest.config.ts` (lines 38-43)
**Impact**: Coverage check would fail if ever enabled

```typescript
thresholds: {
  statements: 80,
  branches: 75,
  functions: 80,
  lines: 80,
},
```

With only 1 test file testing the WHATWG StreamManager (which is not even the main export), actual coverage of src/ is extremely low. Running `vitest --coverage` would fail these thresholds.

### M-06: mkdir with recursive: true throws EEXIST for existing target directory
**File**: `src/fs/IndexedDBFileSystem.ts` (lines 572-575)
**Impact**: `mkdir -p` equivalent does not work correctly for existing paths

```typescript
const existing = await this.getEntry(normalized)
if (existing) {
  throw new Error(`EEXIST: Path already exists: ${path}`)
}
```

The existence check (lines 572-575) happens before the `recursive` check (line 578). If the target path already exists as a directory, it throws `EEXIST` instead of succeeding silently. POSIX `mkdir -p` behavior should succeed if the directory already exists.

### M-07: Logger ignores configured log level
**Files**: `src/utils/logger.ts` (lines 1-8), `configs/shell.config.ts` (lines 18-21)
**Impact**: No log level filtering; all output goes to console unconditionally

The logger is a thin wrapper over `console`:
```typescript
export const logger = {
  log: (...args: any[]) => console.log(...args),
  info: (...args: any[]) => console.info(...args),
  // ...
}
```

Despite `configs/shell.config.ts` defining `config.logger.level` from `TDSK_LOG_LEVEL`, the logger ignores it entirely. The shell.ts.bak Shell class calls `logger.info`, `logger.debug`, `logger.warn`, and `logger.error` throughout, all of which emit unconditionally.

### M-08: Config module loads envs at import time with side effects
**File**: `configs/shell.config.ts` (line 11)
**Impact**: Importing config triggers filesystem reads and process.env mutations

```typescript
loadEnvs({ force: nodeEnv === `local` })
```

This runs at module evaluation time, reading YAML files from multiple filesystem locations and mutating `process.env`. Any import of `@TSH/configs/shell.config` triggers this side effect.

### M-09: Worker and IO modules not exported from main entry
**Files**: `src/index.ts`, `src/worker/index.ts`, `src/io/index.ts`
**Impact**: ShellWorker, createShellWorker, and WHATWG StreamManager are unreachable

`src/index.ts` does not export from `./worker` or `./io`. These modules (ShellWorker: 264 lines, WHATWG StreamManager: 342 lines) are dead code from the consumer perspective.

### M-10: loadEnvs and addToProcess are duplicated across repos
**Files**: `scripts/loadEnvs.ts` (70 lines), `scripts/addToProcess.ts` (33 lines)
**Impact**: Maintenance burden -- identical code in backend, database, domain, proxy, cli, and shell repos

Both files are verbatim copies of utilities found across the monorepo. Changes to env-loading logic must be replicated manually in each copy.

---

## Low Issues

### L-01: Unused ReadWriteFs import in shell.ts stub
**File**: `src/shell.ts` (line 1)

```typescript
import { Bash, ReadWriteFs } from 'just-bash'
```

Neither `Bash` nor `ReadWriteFs` is used in the stub implementation.

### L-02: Redundant and inconsistent path imports in shell.ts
**File**: `src/shell.ts` (lines 3-4)

```typescript
import { join } from 'node:path'
import { dirname } from 'path'
```

Two different import styles for the same module (`node:path` vs `path`).

### L-03: Empty values.ts and script.ts files
**Files**: `src/constants/values.ts` (line 1), `scripts/script.ts` (line 1)

Both contain only `export {}` and contribute nothing.

### L-04: Debug console.log statements in shell.ts stub
**File**: `src/shell.ts` (lines 9-12)

```typescript
console.log(`------- join - location -------`)
console.log(location)
console.log(`------- dirname - location -------`)
console.log(dirname(location))
```

Development debug output that would execute in production.

### L-05: console.log/console.error in WHATWG StreamManager
**File**: `src/io/StreamManager.ts` (lines 111, 125, 139, 246)

```typescript
console.error('stdin aborted:', reason)
console.log('stdout cancelled:', reason)
console.log('stderr cancelled:', reason)
console.error('Error closing stdin:', error)
```

Debug statements that leak to consumer console.

### L-06: @bytecodealliance/preview2-shim is only production dependency but unused in src/
**File**: `package.json` (line 31)

The only production dependency (`@bytecodealliance/preview2-shim@0.17.7`) is not imported by any `src/` file. It is only relevant for WASM build scripts in `scripts/wasm/`.

### L-07: Unused devDependencies
**File**: `package.json`

The following devDependencies are not imported anywhere in source code:
- `pako` (compression library -- never imported)
- `unenv` (environment unification -- never imported)
- `fake-indexeddb` (intended for tests that cannot run)
- `jsdom` (intended for browser tests that do not exist)

### L-08: Documentation files inside src/ directory
**Files**: `src/docs/StreamManager.md` (542 lines), `src/fs/README.md` (320 lines)

Both document features that are not functional (WHATWG StreamManager is not exported; IndexedDBFileSystem is not wired in). Located inside `src/` which may cause them to be included in build output.

---

## Test Coverage Assessment

### Current state: Tests cannot run

**Root cause**: `configs/vitest.config.ts` line 8 imports `vite-plugin-node-polyfills` which is not in `package.json` and not installed. Running `pnpm test` fails immediately.

### Test files inventory

| File | Exists | Status |
|------|--------|--------|
| `src/tests/StreamManager.test.ts` | Yes | Cannot run (config broken). Tests the WHATWG StreamManager from `src/io/`, not the Node.js one from `src/utils/`. 23 test cases across 9 describe blocks. |
| `tests/unit/IndexedDBFileSystem.test.ts` | No | Referenced in vitest.config environmentMatchGlobs |
| `tests/fs/IndexedDBFileSystem.test.ts` | No | Referenced in vitest.config environmentMatchGlobs |
| `tests/unit/WebWorker.test.ts` | No | Referenced in vitest.config environmentMatchGlobs |
| `tests/integration/browser.test.ts` | No | Referenced in vitest.config environmentMatchGlobs |

### What the existing test file covers (if it could run)
The `StreamManager.test.ts` file (350 lines) has 23 well-structured test cases:
- Initialization: stream creation, health check, empty stdin queue (3 tests)
- Command execution: stdout streaming, stderr streaming, multiple commands (3 tests)
- Stdin handling: queue writes, consume on exec, reject after close (3 tests)
- Piping: stdout pipe, stderr pipe (2 tests)
- Teeing: independent branches, independent consumption (2 tests)
- Combined output: merged stdout+stderr (1 test)
- Stream lifecycle: close all, multiple close, controller cleanup (3 tests)
- Backpressure: highWaterMark, slow consumers (2 tests)
- Error handling: exec errors, stream cancellation (2 tests)
- Options: custom options, defaults (2 tests)

### What is NOT tested (0% coverage)
- Shell class (both stub and .bak -- the core of the library)
- IndexedDBFileSystem (870 lines)
- Node.js StreamManager (`src/utils/streams.ts` -- the actually exported one)
- ShellWorker and shell.worker.ts (worker infrastructure)
- Platform detection (`src/utils/platform.ts`)
- Filesystem creation/validation (`src/utils/filesystem.ts`)
- Logger, paths, constants

**Effective coverage**: ~0% (tests cannot execute; even if they could, only the non-exported WHATWG StreamManager would be covered)

---

## Architecture Notes

### Package structure
```
src/
  shell.ts              -- 49-line experimental stub (main export, BROKEN)
  shell.ts.bak          -- 323-line full Shell class (dead code)
  index.ts              -- barrel exports
  constants/
    bash.ts             -- DefBashOpts with dangerouslyAllowFullInternetAccess
    values.ts           -- empty export
    index.ts            -- barrel
  fs/
    IndexedDBFileSystem.ts  -- 870-line full IFileSystem impl (never wired in)
    index.ts            -- barrel
    README.md           -- documentation for unwired code
  io/
    StreamManager.ts    -- WHATWG streams impl (not exported, tested)
    index.ts            -- barrel
  types/
    shell.types.ts      -- types using node:stream (breaks browser)
    index.ts            -- barrel
  utils/
    filesystem.ts       -- createFileSystem (InMemoryFs for all browser cases)
    logger.ts           -- console wrapper (ignores config log level)
    paths.ts            -- alias-hq path resolution
    platform.ts         -- detectPlatform, isBrowser, isNode, isBun (works correctly)
    streams.ts          -- Node.js StreamManager (main export, untested)
    index.ts            -- barrel
  worker/
    ShellWorker.ts      -- Worker manager (timeout leak)
    shell.worker.ts     -- Worker impl (stub, fake output)
    types.ts            -- Worker message types
    index.ts            -- barrel
  tests/
    StreamManager.test.ts  -- tests WHATWG version only
  docs/
    StreamManager.md    -- 542 lines documenting non-exported StreamManager
```

### Dependency analysis

| Package | Listed As | Actually Used By | Status |
|---------|-----------|------------------|--------|
| `just-bash` | devDep | 8+ src files at runtime | **Should be dependency** |
| `@bytecodealliance/preview2-shim` | dep | WASM scripts only | Should be devDep |
| `vite-plugin-node-polyfills` | Not listed | vitest.config.ts import | **Missing -- breaks tests** |
| `pako` | devDep | Not imported anywhere | Unused |
| `unenv` | devDep | Not imported anywhere | Unused |
| `fake-indexeddb` | devDep | Not imported (no IndexedDB tests) | Unused |
| `jsdom` | devDep | Referenced in vitest config but no browser tests exist | Unused |
| `@tdsk/domain` | devDep | scripts/configs only | Correct |
| `@tdsk/wasm` | devDep | WASM build scripts only | Correct |

### What works correctly
- Platform detection (`detectPlatform`, `isBrowser`, `isNode`, `isBun`)
- `getHomeDir()` utility
- `IndexedDBFileSystem` implementation (if it were wired in)
- WHATWG `StreamManager` (if it were exported)
- Worker message protocol types and `ShellWorker` manager (except the stub execute and timeout leak)
- Path resolution via `alias-hq`

### Cross-repo integration
- The agent repo maps `@tdsk/shell` in its tsconfig and references it in WIT comments
- `configs/shell.config.ts` imports `loadEnvs` from `@tdsk/domain`
- WASM build/run scripts import from `@tdsk/wasm`
- `loadEnvs.ts` and `addToProcess.ts` are shared copies found in 6+ repos
