---
name: "tdsk-sandbox"
description: "Knowledge base for the pluggable sandbox execution layer"
tags: ["sandbox", "isolation", "v8-isolate", "e2b", "just-bash", "wasm", "security"]
---
# Sandbox Repo Skill

## Overview

The **Sandbox** repo (`repos/sandbox`, `@tdsk/sandbox`) is a pluggable execution layer that provides isolated environments for running agent code. It abstracts multiple sandbox backends behind a unified `ISandbox` interface:

- **E2B Provider** - Firecracker microVM sandboxes via the E2B cloud API
- **Local Provider** - In-memory virtual shell (just-bash) with optional V8 isolate (isolated-vm)
- **IsolateRunner** - V8 isolate wrapper providing Node.js-like APIs (fs, path, subprocess) in memory-isolated contexts
- **K8s Provider** - Kubernetes pod-based sandboxes with SSH access, project scoping, and idle timeout management

**Key Characteristics**:
- **Type**: Sandbox execution library (no server, no CLI, no build step — consumed as TypeScript source)
- **Pattern**: Factory + Strategy - `createSandboxProvider(type)` returns the right implementation
- **Extensible**: Add new providers by implementing `ISandboxProvider` and registering in the factory
- **Graceful Degradation**: Local provider works without `isolated-vm` (just shell/fs, no JS isolation)
- **Size**: ~570 LOC across 4 local source files + K8s support (~400 LOC) + barrel export

## Directory Structure

```
repos/sandbox/
├── configs/                       # aliases, biome, vitest config
├── src/
│   ├── index.ts                   # Barrel export (factory, e2b, local, isolate, kube)
│   ├── factory.ts                 # createSandboxProvider() factory function
│   ├── factory.test.ts            # Factory tests (7 tests)
│   ├── isolate.ts                 # IsolateRunner — V8 isolation wrapper (~325 LOC)
│   ├── isolate.test.ts            # IsolateRunner tests (21 tests)
│   ├── e2b.ts                     # E2bSandbox + E2bSandboxProvider (~85 LOC)
│   ├── e2b.test.ts                # E2B tests (11 tests)
│   ├── local.ts                   # LocalSandbox + LocalSandboxProvider (~133 LOC)
│   ├── local.test.ts              # Local sandbox tests (18 tests)
│   ├── kube/                      # Kubernetes sandbox support
│   │   ├── kubeClient.ts          # K8s API client — pod CRUD, exec, route hydration
│   │   ├── kubeClient.test.ts     # KubeClient tests
│   │   ├── podManifest.ts         # Pod spec builder — labels, SSH port, egress proxy, CA cert volume
│   │   └── podManifest.test.ts    # Pod manifest tests
│   └── types/
│       └── pod.types.ts           # K8s pod types (TKubeClientConfig, TPodManifestOpts, etc.)
├── package.json
└── tsconfig.json
```

## Architecture

### Factory Pattern

```
createSandboxProvider(type: TSandboxProviderType): ISandboxProvider
  ├── 'e2b'   → E2bSandboxProvider (cloud Firecracker microVMs)
  ├── 'local' → LocalSandboxProvider (in-memory virtual shell + optional V8 isolate)
  └── 'kubernetes' → KubeClient (K8s pod-based sandboxes with SSH access)
```

### Provider Hierarchy

```
ISandboxProvider (interface from @tdsk/domain)
├── E2bSandboxProvider
│   └── create(config) → E2bSandbox (ISandbox)
│       └── Wraps E2B SDK (commands.run, files.read/write, kill)
│
└── LocalSandboxProvider
    └── create(config) → LocalSandbox (ISandbox)
        ├── Bash (just-bash) — virtual shell for exec()
        ├── IFileSystem (just-bash) — in-memory filesystem
        └── IsolateRunner (optional) — V8 isolate for JS execution
            ├── fs shim (readFile, writeFile, mkdir, readdir, unlink, stat, exists + sync variants)
            ├── path shim (join, resolve, dirname, basename, extname, normalize, sep, posix)
            └── subprocess shim (run, execSync — routes to shell)
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
  close(): Promise<void>
}
```

## Key Components

### 1. Factory (`src/factory.ts`)

Map-based factory that creates sandbox providers. The `providers` Map is defined at module scope (not inside the function):

```typescript
const providers = new Map<TSandboxProviderType, () => ISandboxProvider>([
  [`e2b`, () => new E2bSandboxProvider()],
  [`local`, () => new LocalSandboxProvider()],
])

export const createSandboxProvider = (type: TSandboxProviderType): ISandboxProvider => {
  const factory = providers.get(type)
  if (!factory) throw new Error(`Unknown sandbox provider: ${type}`)
  return factory()
}
```

- Returns fresh instance each call (not singleton)
- Throws for unknown types
- Extensible: add new providers with `providers.set()`

### 2. E2bSandboxProvider (`src/e2b.ts`)

Wraps the E2B SDK for Firecracker microVM sandboxes.

```typescript
class E2bSandboxProvider implements ISandboxProvider {
  readonly type = 'e2b' as const
  create = async (config: TSandboxConfig): Promise<ISandbox>
  // Creates E2B microVM with template, apiKey, timeout, envVars from config
}

class E2bSandbox implements ISandbox {
  exec(command, args?)    // → sandbox.commands.run(cmd)
  readFile(path)          // → sandbox.files.read(path)
  writeFile(path, content)// → sandbox.files.write(path, content)
  listDir(path)           // → sandbox.files.list(path), prefixes dirs with [DIR]
  deleteFile(path)        // → sandbox.files.remove(path)
  mkdir(path)             // → sandbox.files.makeDir(path)
  fileExists(path)        // → try/catch on sandbox.files.read(path) (no native exists)
  close()                 // → sandbox.kill()
}
```

- Config accepts: `template`, `apiKey`, `timeout` (-> `timeoutMs`), `envVars` (-> `envs`)

### 3. LocalSandboxProvider (`src/local.ts`)

Uses just-bash virtual shell with optional V8 isolation for local execution.

```typescript
class LocalSandboxProvider implements ISandboxProvider {
  readonly type = 'local' as const
  create = async (config: TSandboxConfig): Promise<ISandbox>
  // Creates InMemoryFs, Bash, /workspace + /tmp dirs
  // Reads memory limit from config.options?.memory (number, default: 128 MB)
  // Optionally initializes IsolateRunner (graceful fallback if unavailable)
}

class LocalSandbox implements ISandbox {
  constructor(bash, fs, isolateRunner?, cwd = '/workspace')
  exec(command, args?)    // → bash.exec(cmd, {cwd})
  readFile(path)          // → fs.readFile(path, {encoding: 'utf-8'})
  writeFile(path, content)// → fs.writeFile(path, content)
  listDir(path)           // → fs.readdir + stat checks, [DIR] prefix
  deleteFile(path)        // → fs.rm(path)
  mkdir(path)             // → fs.mkdir(path, {recursive: true})
  fileExists(path)        // → try fs.stat, return boolean
  close()                 // → dispose isolateRunner if present
}
```

**Graceful Degradation**: If `isolated-vm` is not available, the provider logs a warning and continues without JS code isolation:

```typescript
try {
  const memory = (config.options?.memory as number) || 128
  runner = new IsolateRunner({ memory, bash, fs })
  await runner.init()
} catch {
  runner = null
  console.warn('isolated-vm not available — sandbox running without code execution isolation')
}
```

### 4. IsolateRunner (`src/isolate.ts`)

V8 isolate wrapper using `isolated-vm` for safe JavaScript code execution with Node.js-like APIs.

```typescript
class IsolateRunner {
  constructor(opts: { bash: Bash, fs: IFileSystem, memory?: number })
  async init(): Promise<void>       // Lazy-loads isolated-vm, creates context + shims
  async eval(code: string, timeout?: number): Promise<{ output: string, result: any }>
  dispose(): void                    // Releases shims, context, isolate; resets initialized flag
}
```

**Shims Provided** (Node.js API compatibility inside the isolate):

| Module | APIs | Implementation |
|--------|------|----------------|
| `fs` + `node:fs` | readFile, writeFile, exists, existsSync, mkdir, mkdirSync, readdir, readdirSync, unlink, unlinkSync, stat, statSync, readFileSync, writeFileSync | Bridged to just-bash IFileSystem via `_fs*` callbacks |
| `path` + `node:path` | join, resolve, dirname, basename, extname, normalize, sep, posix | Pure JS path manipulation |
| `child_process` + `node:child_process` | run, execSync | Routes to bash via `_shellRun` callback |
| `console` | log, error, warn, info | Captured output bridge via `_log` callback |

**Shim Compilation**: Shims are compiled in a private `#compile()` method called at the end of `init()`. Each shim is compiled as an `ivm.Module`, instantiated in the context, evaluated, and stored in `#shims` Map keyed by module name (both bare and `node:` prefixed).

**Key Design Decisions**:
- **Lazy loading**: `isolated-vm` loaded via a module-level `loadIvm()` helper using dynamic `import()` on first `init()` call
- **Console capture**: `console.log/error/warn/info` intercepted via `_log` callback, output collected in `#output[]`
- **Module system**: User code compiled as ES module (`user-code.js`), imports resolved via shim map; default export retrieved after evaluation
- **Memory limit**: Configurable (default 128 MB)
- **Timeout**: Default 5000ms per eval

### 5. K8s Sandbox Support (`src/kube/`)

Kubernetes-based sandbox pods with SSH access, project scoping, and lifecycle management.

#### KubeClient (`src/kube/kubeClient.ts`)

Manages K8s pod lifecycle and route hydration for sandbox pods.

**Key Operations:**
- `createPod(opts)` — Create pod from manifest with labels (orgId, userId, sandboxId, projectId)
- `deletePod(name, namespace)` — Delete pod by name
- `listPods(labels, stateFilter?)` — List pods filtered by labels and optional state
- `getPodState(name)` — Get pod phase (Running, Pending, Failed, Succeeded, Unknown)
- `execInPod(name, command, args)` — Execute command inside running pod
- `hydrateRoutes(routeMap)` — Update in-memory route map for sandbox subdomain proxying

#### Pod Manifest (`src/kube/podManifest.ts`)

Builds K8s pod specifications for sandbox containers.

**Key Features:**
- **Labels**: orgId, userId, sandboxId, and optional projectId for multi-tenant filtering
- **SSH Port 2222**: Automatically added to container ports if `sshEnabled !== false`
- **Egress Proxy Init Container**: Routes HTTP/HTTPS traffic through proxy IP for secret placeholder replacement
- **CA Certificate Volume**: Mounts TLS certificate secret for MITM proxy verification
- **Annotations**: Stores subdomain, ports, and placeholder mappings as pod metadata
- **RFC 1123 Pod Names**: `buildPodName()` generates compliant names; `sanitizeLabel()` cleans label values
- **Runtime-Aware Container**: `buildSandboxContainer()` resolves container start command based on `config.runtime`

**Pod Name Format:** `tdsk-sb-<first8CharsOfSandboxId>-<randomSuffix>`

**Runtime Resolution** (`buildSandboxContainer()`):
- Validates `config.runtime` against `SandboxRuntimeConfigs` keys (from `@tdsk/domain`)
- Sets `TDSK_RUNTIME` env var on the pod (runtime ID, e.g., `claude-code`)
- Sets `TDSK_RUNTIME_CMD` env var (the command `tsa run` will execute after SSH connect)
- Container start command resolution order:
  1. Built-in runtime config (`SandboxRuntimeConfigs[runtime].command` + `args`)
  2. Custom `command`/`args` from sandbox config
  3. Fallback: `sleep infinity` (keeps pod alive for SSH)
- Two-command model: `command`/`args` = container start (keeps pod alive + SSH), `runtimeCommand` = what `tsa run` launches after connecting

#### Pod Types (`src/types/pod.types.ts`)

```typescript
type TKubeClientConfig = { namespace: string; kubeConfig?: any }
type TPodManifestOpts = {
  orgId: string; userId: string; sandboxId: string; projectId?: string
  config: TKubeSandboxConfig; placeholders?: TPlaceholderMap
  egressProxyIp?: string; subdomain?: string
}
```

## Key Patterns

### 1. Graceful Resource Management

All components handle cleanup safely:

```typescript
// IsolateRunner: releases shims, context, isolate in order with try/catch
dispose() {
  for (const mod of this.#shims.values()) {
    try { mod.release() } catch {}
  }
  this.#shims.clear()
  try { this.#context?.release() } catch {}
  try { this.#isolate?.dispose() } catch {}
  this.#initialized = false
}

// LocalSandbox: null-safe runner dispose
async close() {
  this.isolateRunner?.dispose()
}
```

### 2. Lazy Initialization

`IsolateRunner.init()` is idempotent (checks `#initialized` flag) and only loads `isolated-vm` on first call:

```typescript
async init() {
  if (this.#initialized) return
  const ivm = await loadIvm()
  // ... setup isolate, context, shims
  this.#initialized = true
}
```

### 3. Directory Listing Convention

Both providers prefix directory entries with `[DIR]` for type identification:

```typescript
const entries = await sandbox.listDir('/workspace')
// Returns: ['file.ts', '[DIR] src', '[DIR] node_modules']
```

## Testing (57 tests, 4 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `src/factory.test.ts` | 7 | Provider creation, error handling, fresh instances, interface compliance |
| `src/isolate.test.ts` | 21 | Constructor, init (context/console/shims/idempotence), eval (auto-init/modules/timeout), dispose |
| `src/e2b.test.ts` | 11 | exec, readFile, writeFile, listDir, deleteFile, mkdir, fileExists, close |
| `src/local.test.ts` | 18 | exec, readFile, writeFile, listDir, deleteFile, mkdir, fileExists, close, provider creation |

- All external dependencies mocked (`isolated-vm`, `e2b`, `just-bash`)
- Co-located test files (`.test.ts` adjacent to source)
- Covers happy paths, error cases, and edge cases (null runner, double dispose)

## Integration Points

### With Agent (`@tdsk/agent`)
- Agent's `AgentRunner` calls `createSandboxProvider(type)` to get a sandbox
- Sandbox used for code execution during ReAct loop

### With Domain (`@tdsk/domain`)
- `ISandbox`, `ISandboxProvider`, `TSandboxConfig`, `TSandboxResult`, `TSandboxProviderType` types

### With TSA (`@tdsk/tsa`)
- TSA's `LocalAgentExecutor` passes sandbox config to AgentRunner

### With Backend (`@tdsk/backend`)
- Backend resolves agent sandbox config and passes it to execution context
- Backend's `SandboxService` uses `KubeClient` for pod CRUD and `podManifest` for pod spec generation
- Pod lifecycle (start/stop) managed by backend, not sandbox repo directly
- Route hydration keeps the in-memory proxy map up-to-date with running pods

## Development Notes

### Adding a New Sandbox Provider

1. Create a new file in `src/` (e.g., `docker.ts`)
2. Implement `ISandboxProvider` and `ISandbox` interfaces
3. Register in `src/factory.ts` by adding to the `providers` Map
4. Export from `src/index.ts`
5. Add `TSandboxProviderType` union member in `@tdsk/domain`

### Adding a New Shim to IsolateRunner

1. Add host callbacks to the context jail in `init()` (e.g., `_myCallback`)
2. Create the shim module source string in `#compile()`
3. Compile as `ivm.Module`, instantiate, evaluate, and add to `#shims` map with both bare and `node:` keys
4. User code can then `import x from 'my-module'`

### isolated-vm Troubleshooting

- Requires native compilation (node-gyp)
- May fail on some platforms (Alpine Linux, ARM)
- If unavailable, LocalSandboxProvider gracefully degrades (shell/fs only, no JS isolation)
- In tests, always mocked - no real V8 isolation tested
