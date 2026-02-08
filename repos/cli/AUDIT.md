# CLI Repo (`@tdsk/cli`) — Full Audit

**Date**: 2026-02-08
**Status**: Complete
**Total Issues**: 67 (8 critical, 15 high, 28 medium, 16 low)
**Test Coverage**: ~0% (1 placeholder test, 0 real assertions)
**Files Reviewed**: 85 TypeScript source files

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Repo Purpose & Architecture](#repo-purpose--architecture)
3. [Critical Issues](#critical-issues)
4. [High Issues](#high-issues)
5. [Medium Issues](#medium-issues)
6. [Low Issues](#low-issues)
7. [Security Issues](#security-issues)
8. [Dead Code & Unused Exports](#dead-code--unused-exports)
9. [Type Safety Issues](#type-safety-issues)
10. [Cross-Repo Integration](#cross-repo-integration)
11. [Test Coverage & Test Plan](#test-coverage--test-plan)
12. [SKILL.md Accuracy Assessment](#skillmd-accuracy-assessment)
13. [Recommendations](#recommendations)

---

## Executive Summary

The CLI repo is a DevOps orchestration tool providing Docker, Kubernetes, and DevSpace commands via a hierarchical task system. It is **functionally complete** — all 34 task commands are implemented, not stubs. However, the codebase has **8 critical bugs** that prevent core commands from working correctly, **security issues** around credential logging and unsafe process execution, and **0% real test coverage**.

### Key Findings

| Category | Count | Details |
|----------|-------|---------|
| Critical bugs | 8 | Commands crash, alias collisions, inverted logic, credential leak |
| High bugs | 15 | Validation failures, missing cleanup, unused options |
| Security issues | 4 | Password logged in plaintext, unsafe shell execution, process leak |
| Test coverage | ~0% | 1 file, 1 test — `expect(true).toBe(true)` |
| Dead code | 8 items | Unused exports, unreachable code, duplicate enums |
| Cross-repo issues | 3 | Code duplication with domain, missing type on kubectl.apply |

### Strengths

- Clean hierarchical task architecture (tasks -> subtasks -> actions)
- All 34 commands fully implemented (no stubs)
- Good alias system for CLI ergonomics
- Proper cross-repo integration with `@tdsk/domain` and `@tdsk/logger`
- Well-structured configuration with 5 build contexts
- All 8 declared dependencies are actively used

---

## Repo Purpose & Architecture

### Purpose

The CLI (`@tdsk/cli`) provides a unified command-line interface for:
- **Docker operations**: build, run, exec, login, pull, push
- **Kubernetes management**: secrets (5 presets), namespaces, ingress, pods, set/remove
- **DevSpace orchestration**: start, enter, attach, log, clean, use, render
- **Repository management**: start repos in local or Docker mode

### Execution Flow

```
User: pnpm tdsk docker build --context proxy

  src/cli.ts
  |-- process.argv.slice(2) -> ['docker', 'build', '--context', 'proxy']
  |-- find(tasks, args) -> resolves docker.build task
  |-- argsParse(options, task.options) -> { context: 'proxy', env: 'local' }
  |-- loadCfg('local') -> imports cli.config.ts
  +-- task.action({ task, tasks, params, config, options })
      |-- getCtx(args) -> config.contexts.proxy
      +-- docker.build({ ctx, params }) -> spawn('docker', [...])
```

### File Count by Category

| Category | Files | Purpose |
|----------|-------|---------|
| Entry/Config | 11 | CLI entry, tsup/vitest/biome config, aliases, scripts |
| Types | 7 | TTask, TTaskParams, TKubeMeta, TCtxCfg, etc. |
| Constants | 2 | EnvFilter configuration |
| Tasks | 34 | Command definitions (docker/kube/devspace/repos) |
| Utilities | 37 | Docker/kubectl/devspace wrappers, process spawning |
| Tests | 1 | Single placeholder test |
| **Total** | **85** | |

---

## Critical Issues

### C-01: `pod.ts:31` — `taskError()` always fires (unreachable code)

**File**: `src/tasks/kube/pod.ts:31`

The `taskError()` call is outside the `if/else if` block, so it fires after every successful pod describe operation:

```typescript
if (name) await kubectl.describePod(args, [name, ...describeArgs])
else if (context) {
  const pod = await kubectl.getPod(args, context)
  // ...
  await kubectl.describePod(args, [podName, ...describeArgs])
}

taskError(`Either 'name' or 'context' parameter is required`)  // ALWAYS runs
```

**Impact**: `kube pod` command always exits with error, even on success.
**Fix**: Wrap line 31 in `else { ... }` block.

---

### C-02: `ingress.ts:13-15` — Validation logs but doesn't halt execution

**File**: `src/tasks/kube/ingress.ts:13-15`

```typescript
!name && console.error(`Ingress name is required`)     // logs, continues
!host && console.error(`Host is required`)             // logs, continues
!service && console.error(`Service name is required`)  // logs, continues

const ingressYaml = `...name: ${name}...`  // undefined interpolated
```

**Impact**: Generates YAML with `undefined` values, kubectl applies malformed resources.
**Fix**: Replace `console.error()` with `taskError()`.

---

### C-03: `push.ts:25` & `pull.ts:24` — Alias collision (`pl`)

**Files**: `src/tasks/docker/push.ts:25`, `src/tasks/docker/pull.ts:24`

Both tasks register `alias: ['pl']`. The task registered last wins.

**Impact**: One of `docker push` / `docker pull` is unreachable via the `pl` alias.
**Fix**: Change one alias (e.g., push -> `ph` or `ps`).

---

### C-04: `tsup.config.ts:16-20` — Inverted filter logic in build config

**File**: `configs/tsup.config.ts:16-20`

```typescript
.filter(
  (name) =>
    !name.startsWith(`@tdsk`) &&    // exclude @tdsk
    !name.startsWith(`@keg-hub`) && // exclude @keg-hub
    name.startsWith(`alias-hq`)     // BUG: should be !name.startsWith
)
```

The last condition requires `name.startsWith('alias-hq')` while the first two require it NOT start with `@tdsk` or `@keg-hub`. This returns only `alias-hq` at most. Combined with `noExternal: [/(.*)/]` on line 36, the net effect is everything gets bundled (including devDependencies like vitest and tsx).

**Impact**: Bloated bundle with unnecessary dependencies.
**Fix**: Change line 20 to `!name.startsWith('alias-hq')`.

---

### C-05: `cli.ts:24` — Unguarded `task.action` access

**File**: `src/cli.ts:24`

```typescript
!task.action && taskError(`Task ${task.name} does not have an action to preform`)
```

If `find()` returns a task object without `.action` (parent tasks like `docker`, `kube`), this works. But the `find()` function could theoretically return undefined in edge cases, causing `task.action` to crash before `taskError` runs.

**Impact**: Unhelpful crash message instead of "Task not found".
**Fix**: Add null check: `!task?.action && ...`

---

### C-06: `helpers.ts:28` — Crash on undefined `params.ports`

**File**: `src/utils/docker/helpers.ts:28`

```typescript
Object.entries(ports).forEach(([local, remote = local]) => ...)
```

`params.ports` can be undefined when running docker commands without `--port`.

**Impact**: `TypeError: Cannot convert undefined or null to object` in `docker run`.
**Fix**: Add guard: `Object.entries(ports || {})`.

---

### C-07: `helpers.ts:43` — Crash on undefined `params.envs`

**File**: `src/utils/docker/helpers.ts:43`

Same pattern as C-06:
```typescript
Object.entries(params.envs).reduce(...)
```

**Impact**: `TypeError` when running Docker commands without `--envs`.
**Fix**: Add guard: `Object.entries(params.envs || {})`.

---

### C-08: `kube.types.ts:1-4` — Unsound hybrid array/object type

**File**: `src/types/kube.types.ts:1-4`

```typescript
export type TKubeMeta = [`--namespace`, string, `--kube-context`, string] & {
  context?: string
  namespace?: string
}
```

TypeScript allows this intersection but runtime behavior is undefined — arrays don't have custom string properties. The code in `getKubeMeta.ts` mutates the array to add `.context` and `.namespace`, which works in practice but is fragile and type-unsafe.

**Impact**: Type system lies about runtime shape; `.context`/`.namespace` aren't discoverable.
**Fix**: Return `{ args: string[], context: string, namespace: string }` instead.

---

## High Issues

### H-01: `docker/secret/docker.ts:37-41` — Token masking logic is fragile

**File**: `src/tasks/kube/secret/docker.ts:37-41` (identical pattern in `tdsk.ts:33-37`)

```typescript
const hidden = `${token.slice(0, 2 - token.length)}${token
  .slice(2, token.length).split('').map(() => '*').join('')}`
```

The expression `2 - token.length` produces a negative index which wraps around correctly for tokens >= 2 chars, but breaks for short tokens (shows full token).

**Impact**: Tokens < 2 chars logged in full; confusing code that works by accident.
**Fix**: Use `token.slice(0, 2) + '*'.repeat(Math.max(0, token.length - 2))`.

---

### H-02: `secret.ts:156-159` — Temp files leak on kubectl failure

**File**: `src/tasks/kube/secret/secret.ts:156-159`

```typescript
await kubectl.create(props, [`secret`, type, name, ...secretArgs])
tempFiles.map((loc) => rmSync(loc))  // Never runs if kubectl.create throws
```

**Impact**: Temporary files containing secret values left in `/tmp/` on failure.
**Fix**: Wrap in try/finally.

---

### H-03: `namespace.ts:13`, `set.ts:13`, `remove.ts:19` — Validation doesn't halt

**Files**: Multiple kube tasks

Same pattern as C-02 — `console.error()` instead of `taskError()`:
- `namespace.ts:13`: `!namespace && console.error(...)`
- `set.ts:13`: `!context && console.error(...)`
- `remove.ts:19`: `!resource && console.error(...)`

**Impact**: Commands proceed with undefined parameters, fail cryptically.

---

### H-04: `devspace/use.ts:18` & `devspace/start.ts:29` — Alias collision (`st`)

Both `use` and `start` in the devspace group use `alias: ['st']`.

**Impact**: One command unreachable via `st` alias within the devspace group.

---

### H-05: `find.ts:75` — `throwError` parameter is ignored

**File**: `src/utils/tasks/find.ts:67,75`

```typescript
export const find = (tasks: TTasks, opts = noOpArr, throwError = true) => {
  // ...
  return foundTask && foundTask.task
    ? { ...foundTask, tasks }
    : taskError(`Task not found for argument: ${taskName}`)  // Always throws
}
```

The `throwError` parameter is never checked before calling `taskError()`.

**Impact**: Cannot gracefully handle missing tasks; callers can't catch errors.
**Fix**: `throwError ? taskError(...) : undefined`.

---

### H-06: `docker/run.ts:17` — `--pull` option defined but not implemented

**File**: `src/tasks/docker/run.ts:17`

```typescript
// TODO: Check pull param, and pull the image before running if set
```

The `pull` option exists in the task schema (line 44-48) but the TODO was never completed.

**Impact**: `--pull` flag is silently ignored.

---

### H-07: `proc/exec.ts:22` — Unsafe shell execution via string joining

**File**: `src/utils/proc/exec.ts:22`

```typescript
const command = [...ensureArr(cmd), ...args].join(` `)
return execSync(command, { ... })
```

Args are joined into a single string and passed to a shell. Shell metacharacters (`;`, `|`, `&&`) in args would be interpreted.

**Impact**: If user-controlled data reaches args, unintended commands could run.
**Note**: Current usage is CLI-parsed strings, so risk is limited. But the pattern should be replaced with `execFileSync()` which takes an array and doesn't invoke a shell.

---

### H-08: `spawn.ts:32-43` — Process event listeners leak

**File**: `src/utils/proc/spawn.ts:32-43`

```typescript
const events = (child: ChildProcess) => {
  Array.from([`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`])
    .map((event) =>
      process.on(event, (exitCode) => { ... child.kill(`SIGKILL`) })
    )
}
```

Listeners are added to `process` but never removed. Each `spawn()` call adds 6 new listeners.

**Impact**: Memory leak; MaxListenersExceededWarning after ~2 spawn calls; stale handlers try to kill already-dead processes.
**Fix**: Use `process.once()` or store references and remove after child exits.

---

### H-09: `docker/index.ts` — Missing exports for most utilities

**File**: `src/utils/docker/index.ts`

```typescript
export * from './build'
export * from './docker'
```

Missing: `auth`, `login`, `pull`, `push`, `exec`, `run`, `helpers`.

**Impact**: Barrel import `from '@TSCL/utils/docker'` doesn't include most utilities. Tasks import directly from subpaths.
**Note**: Works because tasks use direct imports, but barrel export is misleading.

---

### H-10: `kubectl.ts:77` — `apply` method not in `TKubeCtl` type

**File**: `src/utils/kube/kubectl.ts:77` vs type at line 21-37

`kubectl.apply` is defined at runtime (line 77) but not declared in the `TKubeCtl` type interface.

**Impact**: TypeScript may error when calling `kubectl.apply()` depending on strictness settings.

---

### H-11: `login.ts:23` — Docker password returned in plaintext array

**File**: `src/utils/docker/login.ts:23`

```typescript
return [`login`, url, `-u`, user, `-p`, password]
```

This array is passed to `spawn()` which logs the full command (spawn.ts:68):
```typescript
log && Logger.pair(`[Running CMD]`, [cmd, ...args].join(` `))
```

**Impact**: Docker registry password logged in plaintext when `--log` is enabled.
**Fix**: Use `--password-stdin` or redact `-p` values before logging.

---

### H-12: `tasks.types.ts:21-22` — Type safety weakened to `any`

**File**: `src/types/tasks.types.ts:21-22`

```typescript
export type TTaskPMap = {
  //[K: string]: TParamValue  // Original strict type
  [K: string]: any            // Weakened
}
```

**Impact**: No type checking on task parameters; typos in param names go undetected.

---

### H-13: `cli.config.ts:3` — Imports `loadEnvs` from domain (fragile)

**File**: `configs/cli.config.ts:3`

CLI also has a local `scripts/loadEnvs.ts` (identical copy). The config uses domain's version. If domain removes or changes `loadEnvs`, CLI config breaks.

**Impact**: Coupling to domain's internal export structure.

---

### H-14: `cli.ts:10` — No NODE_ENV validation

**File**: `src/cli.ts:10`

```typescript
if (!process.env.NODE_ENV && environment) process.env.NODE_ENV = environment
```

No validation that `environment` is a valid value (`local`, `dev`, `staging`, `prod`).

**Impact**: Typos like `--env prodution` set invalid NODE_ENV, loading wrong config.

---

### H-15: `addTags` returns mutated shared reference

**File**: `src/utils/docker/helpers.ts:6-17`

```typescript
return tags.reduce((acc, tag) => {
  // ...
  return acc
}, noOpArr as string[])
```

`noOpArr` is a shared constant empty array. Using it as the initial accumulator for `reduce` means it gets mutated (items pushed). Subsequent calls that receive `noOpArr` will see stale data.

**Impact**: Tags accumulate across multiple `addTags` calls within the same process.
**Fix**: Use `[] as string[]` instead of `noOpArr`.

---

## Medium Issues

### M-01: `pod.ts:23,26` — `console.error()` used instead of `taskError()`

Validation warnings don't halt execution; `describePod` called with undefined podName.

### M-02: Inconsistent `log` option descriptions across Docker tasks

Typos in 5+ files: "Log command before they are **build**" (should be "built"), wrong verbs in copy-pasted descriptions (`login.ts:35` says "build" instead of "login").

### M-03: `docker/run.ts:48-51` — Pull flag fallback to `--pull=never`

Invalid pull values silently become `--pull=never` instead of being rejected.

### M-04: `addToProcess.ts:26-31` — Uses `.map()` for side effects

Should use `.forEach()`. Creates unused array in memory.

### M-05: `loadEnvs.ts:38-39` — Double negation obscures logic

```typescript
__LOADED_ENVS__ = (!force && __LOADED_ENVS__) || loadConfigs({...})
```

### M-06: `tdsk` bash script:54,60 — Unquoted variables

`cd $TDSK_REPO` and `code $TDSK_REPO` break if path contains spaces.

### M-07: `devspace/render.ts` — Missing `context` option

All other devspace tasks have `context` option; `render` doesn't.

### M-08: Docker option spread collision

`build.ts:78`, `pull.ts:58`, `push.ts:59` spread `...login.options` which may overwrite the task's own `log` option.

### M-09: Inconsistent `envs` vs `env` option naming

Tasks use `envs` (object) inconsistently.

### M-10: `secret.ts:63` — `taskError()` called with wrong 2nd arg type

`taskError(msg, undefined, cfg)` — 2nd arg should be boolean (stack flag), not undefined.

### M-11: `removeCacheDir.ts:13-20` — Promise wraps sync operation, never rejects

`rmSync` errors are unhandled inside the Promise.

### M-12: `getCtx.ts:13-14` — Side-effect `&&` for error throwing

Uses `!found && taskError(...)` pattern which doesn't narrow TypeScript types properly.

### M-13: `resolveArgs` kubectl wrapper silently drops object args

Passing `TTaskParams` as args falls through to `emptyArr` with no warning.

### M-14: `kubectl.ts` — Inconsistent `ensureContext` calls

`getPods` calls `ensureContext` but `currentContext` and `getContexts` don't.

### M-15: `spawn.ts:74` — `detached` option not passed to `child_process.spawn`

```typescript
child = cps(cmd, args, { cwd, stdio, env })  // Missing: detached
detached && stdio !== `inherit` && child.unref()
```

Process is never truly detached from parent's process group.

### M-16: `biome.json:66` — `noUnusedVariables: off`

Prevents detection of dead code.

### M-17: `vitest.config.ts:12` — Async config loading timing

`await loadEnvs()` in vitest config may not be awaited by vitest's config loader.

### M-18: Inconsistent example strings in task definitions

Examples use different command patterns (`pnpm tdsk dev img build` vs `pnpm tdsk docker exec`).

### M-19: `kubectl.ts` — Duplicate `close`/`exit` handling pattern repeated 5 times

5 methods (`currentContext`, `getContexts`, `getPods`, `describe`, and via `ensureContext`) all duplicate the close/exit/error/resolved pattern. Should be extracted.

### M-20: DevSpace `clean` option alias `st` in `start.ts:57` conflicts

The `clean` option inside `start` task has alias `st`, but `st` is also the alias for the `start` task itself.

### M-21: `config.types.ts` `ECtxMap` and `tdsk.types.ts` `ETSApps` — Duplicate enums

Both define `be->backend`, `ad->admin`, `px->proxy` mappings. Two sources of truth.

### M-22: `tsconfig.json:32-45` — Path aliases for unused repos

Defines `@tdsk/logger/*` and `@TDB/*` path aliases but these resolve through workspace, not paths.

### M-23: `docker/run.ts:23` — Command split on spaces breaks quoted args

```typescript
return (command && command.split(` `)) || emptyArr
```

Commands like `sh -c "echo hello"` get incorrectly split.

### M-24: `selector.ts:10-12` — Invalid contexts silently filtered

Maps via `ETSApps` enum, filters with `.filter(Boolean)`. Invalid context names silently disappear.

### M-25: `helpers.ts:16` — `noOpArr` cast loses type safety

```typescript
}, noOpArr as string[])
```

Mutating a shared constant via `as` cast hides the real type mismatch. (Also see H-15.)

### M-26: `tsup.config.ts:36-38` — `noExternal` conflicts with `esbuildOptions.external`

`noExternal: [/(.*)/]` bundles everything, then `esbuildOptions` tries to mark some external. Unclear which wins.

### M-27: `start.ts:29` (repos) — Wrong description

```typescript
description: 'Calls the image build command'  // Should be about starting repos
```

### M-28: Secret subtask delegation is tightly coupled

All 5 secret subtasks navigate `tasks?.kube?.tasks?.secret` — fragile if task tree changes.

---

## Low Issues

### L-01: `cli.ts:24` — Typo "preform" should be "perform"
### L-02: `package.json:4` — Missing description field
### L-03: `package.json:22-24` — Missing author, generic ISC license
### L-04: `tdsk:71` — TODO comment about esbuild-register abandoned
### L-05: `constants/index.ts` — Barrel export for single file (unnecessary indirection)
### L-06: `docker/exec.ts:44,50` — `attach: true` and `detach: false` defined but conflicting
### L-07: `secret.ts:223` — `type` option has no description of valid values
### L-08: `devspace/render.ts:24` — `follow` option irrelevant for render (one-shot)
### L-09: `secret.ts:164` — 5 aliases for secret is excessive (`secrets`, `scrt`, `sct`, `sec`, `sc`)
### L-10: `helpers/index.ts` — Barrel export for single file
### L-11: `docker/docker.ts:16` vs `build.ts` — Two ways to import same function
### L-12: Inconsistent `await` usage in kubectl methods (unnecessary `return await`)
### L-13: Missing JSDoc for most utility functions
### L-14: `login.ts:35` — Log description says "build" instead of "login"
### L-15: `enter.ts:19` — Alias `enter` duplicates task name
### L-16: `constants.ts` `EnvFilter` — Defined but never used in CLI code

---

## Security Issues

### S-01: Password Logging (Critical)

**Files**: `utils/docker/login.ts:23`, `utils/proc/spawn.ts:68`

Docker login returns `[-p, password]` which `spawn()` logs in plaintext.

**Fix**: Use `--password-stdin` or redact `-p` values before logging.

### S-02: Unsafe Shell Execution (High)

**File**: `utils/proc/exec.ts:22`

Args are joined into a single string and passed to `execSync()`, which invokes a shell. Shell metacharacters in args are interpreted. Should use `execFileSync()` with array args instead (no shell invocation).

**Fix**: Replace `execSync(joined_string)` with `execFileSync(cmd, args, opts)`.

### S-03: Process Listener Leak (High)

**File**: `utils/proc/spawn.ts:32-43`

6 event listeners added to `process` per `spawn()` call, never removed. After ~10 spawns, Node emits `MaxListenersExceededWarning`.

**Fix**: Use `process.once()` or clean up on child exit.

### S-04: Temp Files with Secrets Not Cleaned on Error (High)

**File**: `tasks/kube/secret/secret.ts:156-159`

Secret values written to temp files in `/tmp`. If `kubectl.create` throws, cleanup never runs.

**Fix**: Wrap in `try/finally`.

---

## Dead Code & Unused Exports

| Item | Location | Status |
|------|----------|--------|
| `EnvFilter` constant | `src/constants/constants.ts` | Exported but never imported |
| `configs/aliases.ts` | `configs/aliases.ts` | Side-effect import in vitest only; vitest uses `vite-tsconfig-paths` instead |
| `module-alias` (devDep) | `package.json` | Installed but never used |
| `ETSApps` enum | `src/types/tdsk.types.ts` | Duplicates `ECtxMap`; only one is needed |
| `return []` after `taskError()` | `utils/devspace/use.ts:9,19` | Unreachable (taskError exits process) |
| Pod action after `if/else if` | `tasks/kube/pod.ts:20-29` | Effectively dead (line 31 always fires) |
| `@TDB` path aliases | `tsconfig.json:43-45` | No database imports in CLI |
| `resolveLocalPath` dot case | `utils/helpers/resolveLocalPath.ts:18-19` | CLI uses absolute paths; dot case likely unused |

---

## Type Safety Issues

| Issue | Location | Severity |
|-------|----------|----------|
| `TTaskPMap` weakened to `any` | `types/tasks.types.ts:21-22` | High |
| `TTParams` maps all keys to `any` | `types/tasks.types.ts:39` | High |
| `TTask` accepts arbitrary `[key: string]: any` | `types/tasks.types.ts:64` | Medium |
| `TKubeMeta` hybrid array/object | `types/kube.types.ts:1-4` | Critical |
| `kubectl.apply` missing from `TKubeCtl` | `utils/kube/kubectl.ts:21-37` | High |
| `noOpArr as string[]` cast | `utils/docker/helpers.ts:16` | Medium |
| `TSpawnProm` process property timing | `utils/proc/spawn.ts:25-27,123` | Low |

---

## Cross-Repo Integration

### Dependencies (All Used)

| Package | Version | Where Used |
|---------|---------|------------|
| `@keg-hub/args-parse` | 10.0.1 | `src/cli.ts:4` |
| `@keg-hub/jsutils` | 10.0.0 | 33 files (emptyArr, isObj, uuid, etc.) |
| `@keg-hub/parse-config` | 2.2.0 | `scripts/loadEnvs.ts:5` |
| `alias-hq` | 6.2.4 | Config resolution, process cwd |
| `@tdsk/domain` | workspace | `configs/cli.config.ts:3` (loadEnvs) |
| `@tdsk/logger` | workspace | 12 files (Logger.info, pair, stdout, stderr) |

### Code Duplication with Domain

**100% duplication** between:
- `repos/cli/scripts/loadEnvs.ts` (70 lines) = `repos/domain/src/environment/loadEnvs.ts`
- `repos/cli/scripts/addToProcess.ts` (33 lines) = `repos/domain/src/environment/addToProcess.ts`

**Why**: Vitest config needs envs before domain package is available at config-time. The runtime CLI uses domain's version.

**Risk**: If domain's version changes, CLI's local copy becomes stale.

### Monorepo Integration

Root `package.json` wires CLI correctly:
```json
"tdsk": "cd repos/cli; pnpm cli",
"ts": "cd repos/cli; pnpm cli"
```

Build contexts correctly resolve to `repos/proxy`, `repos/backend`, `repos/admin`, and `deploy/`.

---

## Test Coverage & Test Plan

### Current State

- **Test files**: 1 (`src/utils/config/getCtx.test.ts`)
- **Real assertions**: 0 (`expect(true).toBe(true)`)
- **Coverage**: ~0%

### Testability Classification

| Category | Fully Testable | Needs Mocking | Integration-Only |
|----------|----------------|---------------|------------------|
| Utils/Config | 2 | 0 | 0 |
| Utils/Proc | 0 | 2 | 0 |
| Utils/Docker | 6 | 4 | 0 |
| Utils/Kube | 1 | 2 | 0 |
| Utils/DevSpace | 5 | 3 | 0 |
| Utils/Tasks | 4 | 0 | 0 |
| Utils/Helpers | 1 | 0 | 0 |
| Tasks/* | 0 | 0 | 28 |
| **Totals** | **19** | **11** | **28** |

### Recommended Test Priority

**P0 — Foundation (catches existing crashes)**:
1. `utils/proc/spawn.ts` — Process lifecycle, cleanup
2. `utils/proc/exec.ts` — Command construction, error handling
3. `utils/config/getCtx.ts` — Context lookup, validation
4. `utils/tasks/find.ts` — Task routing, alias resolution
5. `utils/tasks/error.ts` — Error formatting, process exit

**P1 — Docker utilities (most user-facing)**:
6. `utils/docker/helpers.ts` — Tag/port/env/mount builders (will catch C-06, C-07, H-15)
7. `utils/docker/build.ts` — Build command construction
8. `utils/docker/login.ts` — Credential handling

**P2 — Kubernetes utilities (complex logic)**:
9. `utils/kube/getKubeMeta.ts` — Metadata extraction
10. `utils/kube/kubectl.ts` — All 12 methods (most complex file, ~300 lines)

**P3 — DevSpace & task validation**:
11. `utils/devspace/selector.ts` — Label selector building
12. `utils/devspace/clean.ts`, `start.ts`, `purge.ts`, `use.ts`
13. Task validation logic (validate required options before execution)

### Mocking Strategy

**Process mocks**: Mock `child_process.spawn` and `child_process.execFileSync`
**Logger mock**: Replace Logger with vi.fn() stubs
**Filesystem mock**: Mock `fs.existsSync`, `writeFileSync`, `rmSync`
**Alias mock**: Mock `alias-hq` to return fixed `@ROOT` path

### Target Coverage: 70% within 5 weeks

| Week | Focus | Files |
|------|-------|-------|
| 1 | Foundation (proc, config, tasks) | 5 files |
| 2 | Docker utilities | 6 files |
| 3 | Kubernetes utilities | 3 files |
| 4 | DevSpace utilities | 5 files |
| 5 | Integration tests | Task validation |

---

## SKILL.md Accuracy Assessment

The CLI SKILL.md at `.claude/skills/cli/SKILL.md` was evaluated against the actual codebase.

| Claim | Accuracy | Notes |
|-------|----------|-------|
| Directory structure | ~90% | Missing `email.ts`, `payments.ts` in kube/secret |
| Available commands | ~85% | Missing `pod`, `exec`, `pull`, `push`, `render` commands |
| Task hierarchy | ~80% | Shows 3 levels but doesn't show all 34 tasks |
| Architecture flow | 95% | Accurate description of CLI -> find -> parse -> execute |
| Dependencies | 95% | Correct list |
| Type system | 90% | Accurate but doesn't mention `any` weakening |
| Error handling | ~70% | Claims "comprehensive" but doesn't mention validation bugs |
| Docker commands | 75% | Missing `exec`, `pull`, `push` |
| Kube commands | 80% | Missing `pod`, `email`, `payments` secrets |
| DevSpace commands | 85% | Missing `render` command |

**Overall SKILL.md accuracy**: ~85%

**Needed updates**: Add missing commands (pod, exec, pull, push, render, email, payments), correct error handling description, note type safety issues.

---

## Recommendations

### P0 — Fix Immediately (Blocking Core Functionality)

1. **C-01**: Fix `pod.ts:31` — wrap `taskError` in `else` block
2. **C-02**: Fix `ingress.ts:13-15` — replace `console.error` with `taskError`
3. **C-03**: Fix alias collision `push.ts:25` / `pull.ts:24`
4. **C-06/C-07**: Fix `helpers.ts:28,43` — guard `Object.entries()` against undefined
5. **H-03**: Fix validation in `namespace.ts:13`, `set.ts:13`, `remove.ts:19`
6. **H-15**: Fix `addTags` — replace `noOpArr` with `[]` to prevent mutation

### P1 — Fix Soon (Security / Data Integrity)

7. **S-01**: Redact passwords before logging in `spawn.ts`
8. **S-04**: Wrap `secret.ts:156-159` in try/finally for temp file cleanup
9. **H-08**: Fix process listener leak in `spawn.ts:32-43`
10. **S-02**: Replace string-joined shell execution with array-based `execFileSync`
11. **H-04**: Fix alias collision `devspace/use.ts:18` / `devspace/start.ts:29`

### P2 — Fix Next Sprint (UX / Consistency)

12. **C-04**: Fix tsup.config.ts filter logic (line 20)
13. **H-06**: Implement `--pull` option in `docker/run.ts`
14. **H-05**: Respect `throwError` parameter in `find.ts`
15. **H-14**: Add NODE_ENV validation in `cli.ts`
16. **M-02**: Fix typos in `log` option descriptions
17. **M-21**: Consolidate `ECtxMap` and `ETSApps` enums

### P3 — Refactor (Technical Debt)

18. **C-08**: Replace `TKubeMeta` with proper object type
19. **H-12**: Restore strict typing in `TTaskPMap`
20. **M-19**: Extract duplicate kubectl close/exit/error pattern
21. **M-28**: Extract secret creation delegation to shared utility
22. Remove dead code: `EnvFilter`, `aliases.ts`, `module-alias` dep
23. Add tests (see Test Plan above)
24. Update SKILL.md to reflect full command inventory

---

## Issue Summary

| Severity | Count | Examples |
|----------|-------|---------|
| **Critical** | 8 | pod.ts always errors, alias collisions, undefined crashes, type unsoundness |
| **High** | 15 | Token masking, temp file leak, validation failures, credential logging |
| **Medium** | 28 | Inconsistent options, wrong descriptions, dead code, type casts |
| **Low** | 16 | Typos, excessive aliases, missing JSDoc, unnecessary barrels |
| **Total** | **67** | |

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Logic Bugs | 4 | 5 | 8 | 2 |
| Security | 1 | 3 | 0 | 0 |
| Type Safety | 1 | 3 | 4 | 1 |
| Dead Code | 0 | 1 | 2 | 5 |
| UX/Consistency | 1 | 2 | 12 | 7 |
| Architecture | 1 | 1 | 2 | 1 |
