---
name: "tdsk-sandbox"
description: "Knowledge base for the pluggable sandbox execution layer"
tags: ["sandbox", "isolation", "v8-isolate", "kubernetes", "just-bash", "isomorphic-git", "security"]
---
# Sandbox Repo Skill

## Overview

The **Sandbox** repo (`repos/sandbox`, `@tdsk/sandbox`) is a pluggable execution layer that provides isolated environments for running agent code. It abstracts multiple sandbox backends behind a unified `ISandbox` interface:

- **Local Provider** - In-memory virtual shell (just-bash) with optional V8 isolate (isolated-vm) and full virtual git (isomorphic-git)
- **Kubernetes Provider** - Connects to existing K8s pods (created by backend's SandboxService), runs commands via K8s Exec API (WebSocket), supports runtime selection
- **IsolateRunner** - V8 isolate wrapper providing 13 Node.js shims + Process global, timer support, and user module registration
- **Git System** - Full virtual git implementation (~643 LOC) using isomorphic-git with a just-bash filesystem adapter

**Key Characteristics**:
- **Type**: Sandbox execution library (no server, no CLI, no build step -- consumed as TypeScript source)
- **Pattern**: Factory + Strategy - `createSandboxProvider(type)` returns the right implementation
- **Extensible**: Add new providers by implementing `ISandboxProvider` and registering in the factory
- **Graceful Degradation**: Local provider works without `isolated-vm` (just shell/fs, no JS isolation)
- **Size**: ~3500 LOC across 42 source files (excluding tests)
- **Providers**: `local` and `kubernetes` (E2B removed from factory)

## Directory Structure

```
repos/sandbox/
├── configs/                           # aliases, biome, vitest config
├── src/
│   ├── index.ts                       # Barrel export (git, kube, local, types, sandbox, constants)
│   ├── sandbox.ts                     # createSandboxProvider() factory function
│   ├── sandbox.test.ts                # Factory tests (4 tests)
│   ├── constants/
│   │   ├── index.ts                   # Re-exports kube + values
│   │   ├── values.ts                  # DefaultWorkdir, DefaultTempdir, EnvProfilePath, CACertMountPath, DefaultRuntime
│   │   └── kube.ts                    # PodCycleInterval, PodLabelKeys, PodAnnotationKeys, PodManagedSelector, KubeSBPrefix
│   ├── git/
│   │   ├── index.ts                   # Re-exports fsAdapter + gitCommand
│   │   ├── gitCommand.ts             # Virtual git command (~643 LOC) -- 20 subcommands via isomorphic-git
│   │   ├── gitCommand.test.ts        # Git command tests (101 tests)
│   │   ├── fsAdapter.ts              # Bridges just-bash IFileSystem to isomorphic-git PromiseFsClient
│   │   ├── fsAdapter.test.ts         # FS adapter tests (25 tests)
│   │   └── gitIntegration.test.ts    # End-to-end git workflow tests (77 tests)
│   ├── kube/
│   │   ├── index.ts                   # Re-exports all kube modules
│   │   ├── kubeClient.ts             # K8s API client -- pod CRUD, exec, watch, hydration (~325 LOC)
│   │   ├── kubeClient.test.ts        # KubeClient tests (40 tests)
│   │   ├── kubeSandbox.ts            # KubeSandbox -- ISandbox backed by K8s pods (~166 LOC)
│   │   ├── kubeSandbox.test.ts       # KubeSandbox tests (29 tests)
│   │   ├── kubeSandboxProvider.ts    # Factory creating KubeSandbox instances, requires podName
│   │   ├── kubeEvents.ts             # setupKubeWatcher() -- watch + cycleListen bridge
│   │   ├── podManifest.ts            # Pod spec builder -- labels, egress proxy, runtime resolution (~231 LOC)
│   │   ├── podManifest.test.ts       # Pod manifest tests (33 tests)
│   │   ├── parseSandboxHost.ts       # Flat DNS subdomain parser (port--subdomain format)
│   │   ├── parseSandboxHost.test.ts  # Subdomain parser tests (10 tests)
│   │   ├── toContainerState.ts       # Maps pod phase string to EContainerState enum
│   │   └── getKubeNS.ts             # Namespace resolution (arg > in-cluster file > "default")
│   ├── local/
│   │   ├── index.ts                   # Re-exports local + isolate
│   │   ├── local.ts                  # LocalSandbox + LocalSandboxProvider (~201 LOC)
│   │   ├── local.test.ts             # Local sandbox tests (34 tests)
│   │   ├── isolate.ts                # IsolateRunner -- V8 isolation wrapper (~361 LOC)
│   │   ├── isolate.test.ts           # IsolateRunner tests (42 tests)
│   │   └── shims/                    # 13 Node.js module shims + Process global
│   │       ├── index.ts              # Barrel + shimRegistry array + builtinShimNames set
│   │       ├── registry.ts           # Ordered shimRegistry array (compilation order matters)
│   │       ├── assert.ts             # assert, assert.ok, assert.equal, etc.
│   │       ├── buffer.ts             # Buffer class (from/alloc/concat/isBuffer, UTF-8 encode/decode)
│   │       ├── childProcess.ts       # execSync routes to bash via _shellRun callback
│   │       ├── console.ts            # log/error/warn/info captured via _log callback
│   │       ├── crypto.ts             # randomBytes, randomUUID, createHash (SHA-256)
│   │       ├── events.ts             # EventEmitter (on/once/off/emit/removeListener)
│   │       ├── fetch.ts              # globalThis.fetch bridge via _fetch callback (globals-only, no module)
│   │       ├── fs.ts                 # readFile/writeFile/mkdir/readdir/unlink/stat + sync variants via _fs* callbacks
│   │       ├── os.ts                 # platform/arch/hostname/tmpdir/homedir/cpus/type/EOL
│   │       ├── path.ts               # join/resolve/dirname/basename/extname/normalize/sep/posix/parse/format/isAbsolute
│   │       ├── process.ts            # globalThis.process (env, cwd, exit-throws, stdout/stderr, nextTick)
│   │       ├── querystring.ts        # encode/decode/stringify/parse
│   │       ├── url.ts                # URL class + url.parse/format/resolve
│   │       └── util.ts               # promisify, inherits, inspect, isDeepStrictEqual, types
│   ├── types/
│   │   ├── index.ts                   # Re-exports all type files
│   │   ├── pod.types.ts              # TPodEgressOpts, TBuildPodOpts, TBuildPodMeta
│   │   ├── kube.types.ts             # TKubeEventHandlers, TKubeClientConfig
│   │   ├── shims.types.ts            # TShimDeps, TShimDefinition
│   │   └── git.types.ts              # TGitFsAdapter, TGitCmdResult
│   └── utils/
│       ├── index.ts                   # Re-exports logger
│       └── logger.ts                 # Log instance via @tdsk/logger
├── package.json
└── tsconfig.json
```

## Architecture

### Factory Pattern

```
createSandboxProvider(type: TSandboxType): ISandboxProvider
  ├── 'local'      -> LocalSandboxProvider (in-memory virtual shell + optional V8 isolate + virtual git)
  └── 'kubernetes' -> KubeSandboxProvider (connects to existing K8s pods via Exec API)
```

Only `local` and `kubernetes` are registered in the factory `providers` Map. E2B is not currently registered.

### Provider Hierarchy

```
ISandboxProvider (interface from @tdsk/domain)
├── KubeSandboxProvider
│   └── create(config) -> KubeSandbox (ISandbox)
│       ├── Requires config.options.podName (pods created externally by SandboxService)
│       ├── KubeClient -- all exec via K8s Exec API (WebSocket, NOT child_process)
│       ├── evaluate() -- writes temp file, runs with configured runtime, cleans up
│       └── reset() -- rm -rf /workspace/* /tmp/*
│
└── LocalSandboxProvider
    └── create(config) -> LocalSandbox (ISandbox)
        ├── Bash (just-bash) -- virtual shell for exec() with git custom command
        ├── IFileSystem (just-bash) -- in-memory filesystem
        ├── IsolateRunner (optional) -- V8 isolate for JS execution
        │   ├── 13 module shims (see Shims table below)
        │   ├── Process global (globalThis.process)
        │   ├── Timer system (setTimeout/setInterval/setImmediate with maxTimerMs clamp)
        │   ├── registerModule(name, code) -- dynamic user module registration
        │   └── releaseUserModules() -- cleanup for pool reuse
        ├── evaluate() -- delegates to IsolateRunner.eval() with optional module pre-registration
        ├── reset() -- releases user modules, clears /workspace + /tmp contents
        └── gitCommand (just-bash custom command) -- full virtual git via isomorphic-git
```

### ISandbox Interface

Defined in `@tdsk/domain`, implemented by both providers:

```typescript
interface ISandbox {
  exec(command: string, args?: string[]): Promise<TSandboxResult>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listDir(path: string): Promise<string[]>
  deleteFile(path: string): Promise<void>
  mkdir(path: string): Promise<void>
  fileExists(path: string): Promise<boolean>
  evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult>
  reset(): Promise<void>
  close(): Promise<void>
}
```

## Key Components

### 1. Factory (`src/sandbox.ts`)

Map-based factory that creates sandbox providers:

```typescript
const providers = new Map<TSandboxType, () => ISandboxProvider>([
  [ESandboxType.local, () => new LocalSandboxProvider()],
  [ESandboxType.kubernetes, () => new KubeSandboxProvider()],
])

export const createSandboxProvider = (type: TSandboxType): ISandboxProvider => {
  const factory = providers.get(type)
  if (!factory) throw new Error(`Unknown sandbox provider: ${type}`)
  return factory()
}
```

- Returns fresh instance each call (not singleton)
- Throws for unknown types
- Extensible: add new providers with `providers.set()`

### 2. KubeSandboxProvider (`src/kube/kubeSandboxProvider.ts`)

Factory that creates `KubeSandbox` instances connected to existing K8s pods. Pods are NOT created by this provider -- they are managed by the backend's `SandboxService`.

```typescript
class KubeSandboxProvider implements ISandboxProvider {
  readonly type = ESandboxType.kubernetes

  async create(config: TSandboxConfig): Promise<ISandbox> {
    // Requires config.options.podName -- throws if missing
    // Accepts options: podName, namespace, runtimes, defaultRuntime
    // Creates KubeClient + KubeSandbox
  }
}
```

- `config.options.podName` is **required** -- throws with descriptive error if missing
- `config.options.namespace` is optional (defaults via `getKubeNS()`)
- `config.options.runtimes` -- array of `TSandboxRuntime` for evaluate() runtime selection
- `config.options.defaultRuntime` -- name of the default runtime for evaluate()

### 3. KubeSandbox (`src/kube/kubeSandbox.ts`)

ISandbox implementation that runs all commands inside K8s pods via the K8s Exec API (WebSocket). Does NOT use child_process -- no host-level shell access.

```typescript
class KubeSandbox implements ISandbox {
  constructor(client: KubeClient, podName: string, runtimes?: TSandboxRuntime[], defaultRuntime?: string)

  exec(command, args?)     // -> KubeClient.runInPod(podName, ['sh', '-c', cmd])
  readFile(path)           // -> runInPod(['cat', path])
  writeFile(path, content) // -> runInPod(['sh', '-c', "printf '%s' '...' > '...'"])
  listDir(path)            // -> runInPod(['ls', '-1aF', path]), strips ./ ../, [DIR] prefix
  deleteFile(path)         // -> runInPod(['rm', '-rf', path])
  mkdir(path)              // -> runInPod(['mkdir', '-p', path])
  fileExists(path)         // -> runInPod(['test', '-e', path]), returns boolean
  evaluate(code, opts?)    // -> writes temp file, runs with runtime command, cleans up
  reset()                  // -> rm -rf /workspace/* /tmp/*
  close()                  // -> no-op (disconnect only, does NOT delete pod)
}
```

**evaluate() flow:**
1. Resolves runtime from `opts.runtime` or `defaultRuntime` (matched against `runtimes[]`)
2. Creates temp dir at `/tmp/tdsk-eval-<nanoid>/`
3. Writes any `opts.modules` as `<name>.<ext>` files in temp dir
4. Writes main code as `main.<ext>` in temp dir
5. Runs with runtime command (e.g. `node main.js`), optional `timeout` flag
6. Cleans up temp dir
7. Returns `{ output, error, result: undefined }` (K8s captures stdout only)

### 4. KubeClient (`src/kube/kubeClient.ts`)

K8s API client managing pod CRUD, command execution, watch events, and route hydration.

**Construction:**
- Loads KubeConfig: tries in-cluster first, falls back to default (unless `inCluster: false`)
- Creates `k8s.Exec`, `k8s.Watch`, `k8s.CoreV1Api`
- Namespace resolved via `getKubeNS()`: explicit arg > in-cluster file > `"default"`

**Pod CRUD:**
- `createPod(manifest)` -- create pod in namespace
- `getPod(name)` -- read pod by name
- `listPods(labelSelector?)` -- list pods (default: managed selector)
- `deletePod(name, gracePeriod?)` -- delete pod

**Shell Operations:**
- `runInPod(podName, command[], stdin?)` -- run via K8s Exec API (not child_process)
  - Collects stdout/stderr via PassThrough streams
  - Returns `TSandboxResult` with `{ output, error, exitCode, success }`
  - Container name hardcoded as `"sandbox"`

**Watch System:**
- `watch(events: TKubeEventHandlers)` -- watch pods with label selector via `k8s.Watch`
- `cycleListen(events, intervalMs?)` -- restarts watch every `PodCycleInterval` (10 min, default)
  - Workaround for K8s client library bug #596 (watch connections go stale)
- `stopWatch()` -- abort current watch
- `cleanup()` -- stop watch + clear cycle timer

**Hydration System:**
- `hydrate()` -- full hydration: list all managed pods, build route map, delete failed/succeeded pods
- `hydrateSingle(pod)` -- add one pod to route map (or remove if should-remove)
  - Reads subdomain, podIp, ports, placeholders from annotations
  - Builds `TRouteMapEntry` with `{ placeholders, ports, meta: { podIp, podName, sandboxId, state } }`
- `removeFromCache(pod)` -- remove pod from route map, fire `onRouteRemoved` callback
- `shouldHydrate(pod)` -- true if Running/Pending and no deletionTimestamp
- `shouldRemove(pod)` -- true if Failed/Succeeded or has deletionTimestamp
- `onRemoveRoute(callback)` -- register callback for route removal events
- `routes` -- readonly getter for the `TRouteMap`

### 5. LocalSandboxProvider (`src/local/local.ts`)

Uses just-bash virtual shell with optional V8 isolation and virtual git for local execution.

```typescript
class LocalSandboxProvider implements ISandboxProvider {
  readonly type = ESandboxType.local
  create = async (config: TSandboxConfig): Promise<ISandbox>
  // Creates InMemoryFs, Bash (with gitCommand custom command), /workspace + /tmp dirs
  // Reads memory limit from config.options?.memory (number, default: 128 MB)
  // Reads maxTimerMs from config.options?.maxTimerMs (default: 30000)
  // Optionally initializes IsolateRunner (graceful fallback if unavailable)
}
```

```typescript
class LocalSandbox implements ISandbox {
  constructor(bash, fs, isolateRunner?, cwd = '/workspace')

  exec(command, args?)     // -> bash.exec(cmd, {cwd})
  readFile(path)           // -> fs.readFile(path, {encoding: 'utf-8'})
  writeFile(path, content) // -> fs.writeFile(path, content)
  listDir(path)            // -> fs.readdir + stat checks, [DIR] prefix
  deleteFile(path)         // -> fs.rm(path)
  mkdir(path)              // -> fs.mkdir(path, {recursive: true})
  fileExists(path)         // -> try fs.stat, return boolean
  evaluate(code, opts?)    // -> IsolateRunner.eval(code, opts.timeout), with optional module pre-registration
  reset()                  // -> releaseUserModules() + clear /workspace + /tmp contents
  close()                  // -> dispose isolateRunner if present
}
```

**evaluate()**: Delegates to `IsolateRunner.eval()`. If `opts.modules` is provided, each module is registered via `IsolateRunner.registerModule(name, code)` before evaluation. Throws if isolateRunner is null (isolated-vm not available).

**reset()**: First calls `isolateRunner.releaseUserModules()` to free V8 heap from user modules. Then iterates `/workspace` and `/tmp`, removing entries. Handles `ENOTEMPTY`/`not empty` errors gracefully.

**Graceful Degradation**: If `isolated-vm` is not available, the provider logs a warning and continues without JS code isolation. Shell/FS operations and virtual git still work.

### 6. IsolateRunner (`src/local/isolate.ts`)

V8 isolate wrapper using `isolated-vm` for safe JavaScript code execution with Node.js-like APIs.

```typescript
class IsolateRunner {
  constructor(opts: {
    bash: Bash, fs: IFileSystem, memory?: number,
    env?: Record<string, string>, maxTimerMs?: number
  })

  async init(): Promise<void>                          // Lazy-loads isolated-vm, creates context + shims + timers
  async eval(code: string, timeout?: number): Promise<{ output: string, result: any }>
  async registerModule(name: string, code: string): Promise<void>  // Register named ES module for user code imports
  releaseUserModules(): void                           // Release user modules, keep builtins (pool reuse)
  dispose(): void                                      // Releases shims, context, isolate; resets initialized flag
}
```

**Shims Provided** (13 Node.js module shims + Process global):

| Module | APIs | Implementation |
|--------|------|----------------|
| `buffer` / `node:buffer` | Buffer class (from, alloc, concat, isBuffer, UTF-8 encode/decode) | Pure JS, sets globalThis.Buffer |
| `path` / `node:path` | join, resolve, dirname, basename, extname, normalize, sep, posix, parse, format, isAbsolute | Pure JS path manipulation |
| `fs` / `node:fs` | readFile, writeFile, exists, existsSync, mkdir, mkdirSync, readdir, readdirSync, unlink, unlinkSync, stat, statSync, readFileSync, writeFileSync | Bridged to just-bash IFileSystem via `_fs*` callbacks |
| `child_process` / `node:child_process` | execSync | Routes to bash via `_shellRun` callback |
| `url` / `node:url` | URL class, url.parse, url.format, url.resolve | Pure JS |
| `querystring` / `node:querystring` | encode, decode, stringify, parse | Pure JS |
| `events` / `node:events` | EventEmitter (on, once, off, emit, removeListener, removeAllListeners) | Pure JS |
| `os` / `node:os` | platform, arch, hostname, tmpdir, homedir, cpus, type, EOL | Pure JS (linux defaults) |
| `crypto` / `node:crypto` | randomBytes, randomUUID, createHash (SHA-256) | Pure JS |
| `util` / `node:util` | promisify, inherits, inspect, isDeepStrictEqual, types | Pure JS |
| `assert` / `node:assert` | assert, assert.ok, assert.equal, assert.deepEqual, assert.throws, etc. | Pure JS |
| `console` | log, error, warn, info | Captured output bridge via `_log` callback (globals-only) |
| `fetch` | globalThis.fetch | Bridge via `_fetch` callback (globals-only, no module) |
| Process (global) | process.env, process.cwd(), process.exit() (throws), process.stdout/stderr, process.nextTick | Via `setupGlobals` on context (no module name) |

**Shim System Architecture:**
- Each shim implements `TShimDefinition`: `{ names, source?, setupCallbacks?, setupGlobals? }`
- Shims are compiled in order from `shimRegistry` array (order matters for dependency chains)
- Console and fetch come first (globals-only), buffer before crypto (crypto uses Buffer)
- `builtinShimNames` Set tracks which module names are built-in vs user-registered

**Timer Implementation:**
- `setTimeout`, `setInterval`, `setImmediate` with `maxTimerMs` clamp (default 30s)
- Max 100 concurrent timers (throws on overflow)
- `queueMicrotask` polyfill via `Promise.resolve().then()`
- Timer callbacks fire via `__timerFire(id)` evaluated in context
- All timers cleared at start and end of each `eval()` call

**Module Registration:**
- `registerModule(name, code)` -- compile and register a named ES module
  - Auto-releases existing module with same name (prevents V8 heap leak)
  - Module imports resolved against existing shims
- `releaseUserModules()` -- releases all non-builtin modules (identified via `builtinShimNames`)
- Used for sandbox pool reuse without full dispose/reinit cycle

**eval() Flow:**
1. Auto-init if needed
2. Clear all pending timers
3. Reset output buffer
4. Compile user code as ES module (`user-code.js`)
5. Instantiate with shim resolution
6. Evaluate with timeout (default 5000ms)
7. Extract default export via structured clone, JSON fallback, or undefined
8. Release user module, clear timers
9. Return `{ output, result }`

### 7. Git System (`src/git/`)

Full virtual git implementation using isomorphic-git against the in-memory filesystem.

#### gitCommand (`src/git/gitCommand.ts`, ~643 LOC)

Registered as a just-bash custom command via `defineCommand('git', ...)`. Supports 20 subcommands:

| Command | Description |
|---------|-------------|
| `init` | Initialize repo (optional `--bare`, `-b <branch>`) |
| `add` | Stage files (`.` for all, specific paths) |
| `commit` | Commit with `-m` message, uses `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars |
| `status` | Porcelain-style status output |
| `log` | Commit log with `-n` limit |
| `branch` | List, create, delete (`-d`/`-D`) branches |
| `checkout` | Switch branches, create (`-b`), restore files |
| `switch` | Switch/create (`-c`) branches |
| `merge` | Fast-forward + three-way merge |
| `diff` | Show unstaged changes |
| `rev-parse` | `HEAD`, `--abbrev-ref HEAD`, `--show-toplevel`, `--git-dir` |
| `tag` | Create, list, annotated (`-a -m`), delete (`-d`) |
| `remote` | add, remove, get-url |
| `reset` | `--hard`, `--soft`, `--mixed` (HEAD~N, specific SHA) |
| `rm` | Remove tracked files (with `--cached`) |
| `show` | Show commit details |
| `cherry-pick` | Apply commit to current branch |
| `stash` | push/pop/list/drop/clear |
| `clone` | Clone remote repo via isomorphic-git/http/node |
| `fetch` / `pull` / `push` | Network operations via isomorphic-git/http/node |

#### fsAdapter (`src/git/fsAdapter.ts`)

Bridges just-bash `IFileSystem` to isomorphic-git's `PromiseFsClient` shape:
- Wraps `FsStat` into objects with `isFile()`/`isDirectory()`/`isSymbolicLink()` as methods (not booleans)
- Fixes POSIX error codes (`ENOENT`, `EEXIST`, etc.) -- just-bash includes codes in messages but doesn't set `.code`
- `ino` uses `mtimeMs` so isomorphic-git's `compareStats` detects sub-second changes

### 8. Pod Manifest (`src/kube/podManifest.ts`)

Builds K8s pod specifications for sandbox containers.

**Key Functions:**
- `buildPodManifest(opts: TBuildPodOpts)` -- complete pod spec
- `buildPodName(sandboxId)` -- RFC 1123 compliant: `tdsk-sb-<first8chars>-<4charSuffix>`
- `sanitizeLabel(value)` -- alphanumeric start/end, max 63 chars, `[a-zA-Z0-9._-]` only

**Pod Structure:**
- `restartPolicy: Never`, `automountServiceAccountToken: false`
- Init container: `proxy-redirect` (Alpine + iptables, redirects ports 80/443 to egress proxy)
- Main container: `sandbox` with runtime-resolved command
- Volume: CA cert secret mount at `/usr/local/share/ca-certificates/tdsk-proxy.crt`
- Lifecycle `postStart`: writes env profile script to `/etc/profile.d/tdsk-env.sh`

**Runtime Resolution** (`buildSandboxContainer()`):
1. Validates `config.runtime` against `SandboxRuntimeConfigs` keys (from `@tdsk/domain`)
2. Sets `TDSK_RUNTIME` env var (runtime ID, e.g., `claude-code`)
3. Sets `TDSK_RUNTIME_CMD` env var (what `tsa run` launches after SSH connect)
4. Container start command resolution order:
   a. Built-in runtime config (`SandboxRuntimeConfigs[runtime].command` + `args`)
   b. Custom `command`/`args` from sandbox config
   c. Fallback: `sleep infinity` (keeps pod alive for SSH)
5. Two-command model: `command`/`args` = container start, `runtimeCommand` = what runs post-SSH

**Extra Environment Variables:**
- `DISABLE_AUTOUPDATER=1`, `NODE_EXTRA_CA_CERTS=<CACertMountPath>`
- `config.envVars` + `extraEnv` (from `TBuildPodOpts`)
- SSH port 2222 auto-added unless `sshEnabled === false`

**Annotations:**
- `tdsk.app/subdomain` -- subdomain for routing
- `tdsk.app/ports` -- JSON port map
- `tdsk.app/placeholders` -- JSON placeholder map for MITM secret injection

**Labels:**
- `tdsk.app/managed=true`, `tdsk.app/org-id`, `tdsk.app/user-id`, `tdsk.app/sandbox-id`
- Optional: `tdsk.app/project-id`

### 9. Watch and Events (`src/kube/kubeEvents.ts`)

`setupKubeWatcher(client)` -- convenience function that wires up event handlers:
- `added` / `modified` -> `client.hydrateSingle(pod)`
- `deleted` -> `client.removeFromCache(pod)`
- `error` -> `logger.error()`

Uses `client.cycleListen()` which restarts the K8s watch every 10 minutes (workaround for K8s client bug #596).

### 10. Subdomain Parsing (`src/kube/parseSandboxHost.ts`)

Parses flat DNS format sandbox hostnames:
```
"3000--sb-a1b2c3d4.local.threadedstack.app"
-> { port: "3000", subdomain: "sb-a1b2c3d4" }
```

- `--` separator keeps port + subdomain in one DNS label (single-level wildcard compatible)
- Validates subdomain starts with `sb-` prefix
- Validates port is numeric

### 11. Constants

**`src/constants/values.ts`** -- Path and runtime defaults:
- `DefaultWorkdir = '/workspace'`, `DefaultTempdir = '/tmp'`
- `EnvProfilePath = '/etc/profile.d/tdsk-env.sh'`
- `VolumeMountName = 'proxy-ca-cert'`, `CACertMountPath = '/usr/local/share/ca-certificates/tdsk-proxy.crt'`
- `DefaultRuntime = { name: 'node', command: 'node', extension: '.js' }`

**`src/constants/kube.ts`** -- K8s-specific constants:
- `PodCycleInterval = 600000` (10 min, K8s bug #596 workaround)
- `PodLabelKeys` -- label key strings (`tdsk.app/org-id`, etc.)
- `PodAnnotationKeys` -- annotation key strings (`tdsk.app/subdomain`, etc.)
- `PodManagedSelector = 'tdsk.app/managed=true'`
- `KubeSBPrefix = 'sb'`
- `ContainerStatesSet` -- Set of valid `EContainerState` values
- `InClusterNamespacePath` -- K8s service account namespace file path

## Key Patterns

### 1. Graceful Resource Management

All components handle cleanup safely using a `safeRelease()` helper:

```typescript
const safeRelease = (fn: () => void, keyword: string, label: string) => {
  try { fn() } catch (err: any) {
    if (!String(err?.message || '').includes(keyword))
      console.warn(`Unexpected error ${label}:`, err)
  }
}
```

- IsolateRunner: releases shims, context, isolate in order with safeRelease
- LocalSandbox: null-safe runner dispose
- KubeSandbox: close() is no-op (pod lifecycle managed externally)

### 2. Lazy Initialization

`IsolateRunner.init()` is idempotent (checks `#initialized` flag) and only loads `isolated-vm` on first call. `eval()` and `registerModule()` auto-call `init()` if needed.

### 3. Directory Listing Convention

Both providers prefix directory entries with `[DIR]` for type identification:
```typescript
const entries = await sandbox.listDir('/workspace')
// Returns: ['file.ts', '[DIR] src', '[DIR] node_modules']
```

### 4. Security Model

- **KubeSandbox**: All execution via K8s Exec API (WebSocket) -- never child_process. Commands run inside pod containers only.
- **LocalSandbox**: V8 isolate with memory limit, timer clamp, no native addon access. Shell routes through just-bash virtual shell (not real OS shell).
- **Egress proxy**: Pod HTTP/HTTPS traffic routed through iptables to MITM proxy for secret placeholder injection.
- **Process.exit**: Throws error instead of exiting (sandboxed process global).

## Types

### Pod Types (`src/types/pod.types.ts`)

```typescript
type TPodEgressOpts = {
  servicePort: number; serviceName: string; serviceIp?: string; certSecretName: string
}

type TBuildPodOpts = {
  orgId: string; userId: string; sandbox: Sandbox; projectId?: string
  namespace?: string; egressOpts: TPodEgressOpts; placeholders: TPlaceholderMap
  extraEnv?: Record<string, string>
}

type TBuildPodMeta = {
  orgId: string; userId: string; podName: string; sandbox: Sandbox
  subdomain: string; projectId?: string; config: TKubeSandboxConfig; placeholders: TPlaceholderMap
}
```

### Kube Types (`src/types/kube.types.ts`)

```typescript
type TKubeEventHandlers = {
  added?: (pod: V1Pod) => void; modified?: (pod: V1Pod) => void
  deleted?: (pod: V1Pod) => void; bookmark?: (pod: V1Pod) => void; error?: (err: any) => void
}

type TKubeClientConfig = { namespace?: string; inCluster?: boolean }
```

### Shim Types (`src/types/shims.types.ts`)

```typescript
type TShimDeps = {
  bash: Bash; fs: IFileSystem; maxTimerMs?: number
  env?: Record<string, string>; onLog?: (...args: any[]) => void
}

type TShimDefinition = {
  names: string[]        // Module names (bare + node: prefix)
  source?: string        // Module source code (compiled as ivm.Module)
  setupGlobals?: (context: any, deps: TShimDeps) => Promise<void>    // Set globalThis values
  setupCallbacks?: (jail: any, ivm: any, deps: TShimDeps) => Promise<void>  // Register host callbacks
}
```

### Git Types (`src/types/git.types.ts`)

```typescript
type TGitFsAdapter = ReturnType<typeof createGitFsAdapter>
type TGitCmdResult = { stdout: string; stderr: string; exitCode: number }
```

## Testing (~395 tests, 10 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `src/sandbox.test.ts` | 4 | Provider creation, error handling, fresh instances, interface compliance |
| `src/local/isolate.test.ts` | 42 | Constructor, init, eval (auto-init/modules/timeout), shims, timers, registerModule, releaseUserModules, dispose |
| `src/local/local.test.ts` | 34 | exec, readFile, writeFile, listDir, deleteFile, mkdir, fileExists, evaluate, reset, close, provider creation |
| `src/kube/kubeClient.test.ts` | 40 | Pod CRUD, runInPod, watch, cycleListen, hydrate, hydrateSingle, removeFromCache, cleanup |
| `src/kube/kubeSandbox.test.ts` | 29 | exec, readFile, writeFile, listDir, deleteFile, mkdir, fileExists, evaluate, reset, close |
| `src/kube/podManifest.test.ts` | 33 | buildPodManifest, buildPodName, sanitizeLabel, runtime resolution, egress proxy, env vars, SSH port |
| `src/kube/parseSandboxHost.test.ts` | 10 | Flat DNS parsing, port extraction, validation, edge cases |
| `src/git/gitCommand.test.ts` | 101 | All 20 git subcommands, error cases, flag parsing |
| `src/git/fsAdapter.test.ts` | 25 | FS adapter bridging, error code fixing, stat wrapping |
| `src/git/gitIntegration.test.ts` | 77 | End-to-end workflows: init+commit, branching, merge, stash, remote, clone |

- All external dependencies mocked (`isolated-vm`, `@kubernetes/client-node`, `just-bash`, `isomorphic-git`)
- Co-located test files (`.test.ts` adjacent to source)
- Covers happy paths, error cases, and edge cases

## Integration Points

### With Backend (`@tdsk/backend`)
- Backend's `SandboxService` uses `KubeClient` for pod CRUD and `podManifest` for pod spec generation
- Pod lifecycle (start/stop) managed by backend, not sandbox repo directly
- Route hydration (`hydrate()`, `hydrateSingle()`) keeps in-memory proxy map current with running pods
- `setupKubeWatcher()` used by backend for live pod event monitoring
- `parseSandboxHost()` used by proxy layer for sandbox subdomain routing
- Backend shell endpoint uses `KubeClient.runInPod()` for shell commands

### With Domain (`@tdsk/domain`)
- `ISandbox`, `ISandboxProvider`, `TSandboxConfig`, `TSandboxResult`, `TSandboxType` types
- `TSandboxEvalOpts`, `TSandboxEvalResult` types for evaluate()
- `TSandboxRuntime` type for runtime configuration
- `ESandboxType`, `ESandboxRuntime`, `EContainerState` enums
- `SandboxRuntimeConfigs` for runtime command resolution
- `TKubeSandboxConfig`, `TPlaceholderMap`, `TRouteMap`, `TRouteMapEntry`, `TRouteEntry` types

### With Agent (`@tdsk/agent`)
- Agent's `AgentRunner` calls `createSandboxProvider(type)` to get a sandbox
- Sandbox used for code execution during ReAct loop

### With TSA (`@tdsk/tsa`)
- TSA's runtime execution uses sandbox config to create local or kubernetes sandboxes
- `tsa run` launches runtime command after SSH connection to K8s sandbox

### With Logger (`@tdsk/logger`)
- `Log` instance tagged `TDSK - Sandbox` via `@TSB/utils/logger`

## Development Notes

### Adding a New Sandbox Provider

1. Create a new file in `src/` (e.g., `src/docker/`)
2. Implement `ISandboxProvider` and `ISandbox` interfaces (including `evaluate()` and `reset()`)
3. Register in `src/sandbox.ts` by adding to the `providers` Map
4. Export from `src/index.ts`
5. Add `TSandboxType` union member in `@tdsk/domain`

### Adding a New Shim to IsolateRunner

1. Create a new file in `src/local/shims/` implementing `TShimDefinition`
2. If the shim needs host callbacks, implement `setupCallbacks(jail, ivm, deps)`
3. If the shim sets globals (like process or Buffer), implement `setupGlobals(context, deps)`
4. If the shim provides an importable module, set `source` with the module code and `names` with bare + `node:` prefix
5. Add to `shimRegistry` array in `src/local/shims/registry.ts` -- **order matters** (dependencies must come first)
6. Export from `src/local/shims/index.ts`

### Adding a New Git Subcommand

1. Add handler function (`onMyCommand`) in `src/git/gitCommand.ts`
2. Add `case 'my-command':` to the switch in the `defineCommand` callback
3. Return `TGitCmdResult` via `ok(stdout)` or `fail(stderr)` helpers
4. Use `createGitFsAdapter(ctx.fs)` for isomorphic-git operations

### isolated-vm Troubleshooting

- Requires native compilation (node-gyp)
- May fail on some platforms (Alpine Linux, ARM)
- If unavailable, LocalSandboxProvider gracefully degrades (shell/fs + git still work, no JS isolation)
- In tests, always mocked -- no real V8 isolation tested
