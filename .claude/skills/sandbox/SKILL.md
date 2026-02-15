---
name: "Threaded Stack - Sandbox Repo"
description: "Knowledge base for the pluggable sandbox execution layer"
version: "1.1.0"
tags: ["sandbox", "isolation", "v8-isolate", "e2b", "just-bash", "wasm", "security"]
---
# Sandbox Repo Skill

## Overview

The **Sandbox** repo (`repos/sandbox`, `@tdsk/sandbox`) is a pluggable execution layer that provides isolated environments for running agent code. It abstracts multiple sandbox backends behind a unified `ISandbox` interface:

- **E2B Provider** — Firecracker microVM sandboxes via the E2B cloud API
- **Local Provider** — In-memory virtual shell (just-bash) with optional V8 isolate (isolated-vm)
- **IsolateRunner** — V8 isolate wrapper providing Node.js-like APIs (fs, path, subprocess) in memory-isolated contexts

**Key Characteristics**:
- **Type**: Sandbox execution library (no server, no CLI)
- **Pattern**: Factory + Strategy — `createSandboxProvider(type)` returns the right implementation
- **Extensible**: Add new providers by implementing `ISandboxProvider` and registering in the factory
- **Graceful Degradation**: Local provider works without `isolated-vm` (just shell/fs, no JS isolation)
- **Size**: ~550 LOC across 4 source files + barrel export

**Key Problem Solved**: Provides a unified API for executing code in isolated environments, supporting both cloud (E2B Firecracker) and local (just-bash + V8) backends with the same interface.

## Directory Structure

```
repos/sandbox/
├── configs/
│   ├── aliases.ts              # Path alias configuration
│   ├── biome.json              # Biome linter/formatter config
│   └── vitest.config.ts        # Vitest test runner config
├── src/
│   ├── index.ts                # Barrel export (factory, e2b, local, isolate)
│   ├── factory.ts              # createSandboxProvider() factory function
│   ├── factory.test.ts         # Factory tests (6 tests)
│   ├── isolate.ts              # IsolateRunner — V8 isolation wrapper (~325 LOC)
│   ├── isolate.test.ts         # IsolateRunner tests (28 tests)
│   ├── e2b.ts                  # E2bSandbox + E2bSandboxProvider (~85 LOC)
│   ├── e2b.test.ts             # E2B tests (11 tests)
│   ├── local.ts                # LocalSandbox + LocalSandboxProvider (~135 LOC)
│   └── local.test.ts           # Local sandbox tests (16 tests)
├── package.json
└── tsconfig.json
```

## Key Files

| File | Purpose |
|------|---------|
| `src/factory.ts` | `createSandboxProvider()` — main entry point, maps type string to provider |
| `src/isolate.ts` | IsolateRunner — V8 isolate with fs/path/subprocess shims (~325 LOC) |
| `src/e2b.ts` | E2bSandbox + E2bSandboxProvider — Firecracker microVM wrapper |
| `src/local.ts` | LocalSandbox + LocalSandboxProvider — just-bash + optional isolated-vm |
| `src/index.ts` | Barrel export for all public APIs |

## Architecture

### Factory Pattern

```
createSandboxProvider(type: TSandboxProviderType): ISandboxProvider
  ├── 'e2b'   → E2bSandboxProvider (cloud Firecracker microVMs)
  └── 'local' → LocalSandboxProvider (in-memory virtual shell + optional V8 isolate)
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
            ├── fs shim (readFile, writeFile, mkdir, readdir, rm, stat)
            ├── path shim (join, resolve, dirname, basename, extname)
            └── subprocess shim (routes to shell)
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

Map-based factory that creates sandbox providers:

```typescript
export const createSandboxProvider = (type: TSandboxProviderType): ISandboxProvider => {
  const providers = new Map<TSandboxProviderType, () => ISandboxProvider>([
    [`e2b`, () => new E2bSandboxProvider()],
    [`local`, () => new LocalSandboxProvider()],
  ])

  const factory = providers.get(type)
  if (!factory) throw new Error(`Unknown sandbox provider type: ${type}`)
  return factory()
}
```

- Uses `Map<TSandboxProviderType, () => ISandboxProvider>` (not Record/object)
- Returns fresh instance each call (not singleton)
- Throws for unknown types
- Extensible: add new providers with `providers.set()`

### 2. E2bSandboxProvider (`src/e2b.ts`)

Wraps the E2B SDK for Firecracker microVM sandboxes.

**E2bSandboxProvider**:
```typescript
class E2bSandboxProvider implements ISandboxProvider {
  type = 'e2b'
  async create(config: TSandboxConfig): Promise<ISandbox>
  // Creates E2B microVM with template, apiKey, timeout, envVars from config
}
```

**E2bSandbox**:
```typescript
class E2bSandbox implements ISandbox {
  exec(command, args?)    // → sandbox.commands.run(cmd)
  readFile(path)          // → sandbox.files.read(path)
  writeFile(path, content)// → sandbox.files.write(path, content)
  listDir(path)           // → sandbox.files.list(path), prefixes dirs with [DIR]
  deleteFile(path)        // → sandbox.files.remove(path)
  mkdir(path)             // → sandbox.files.makeDir(path)
  fileExists(path)        // → try/catch on sandbox.files.read(path)
  close()                 // → sandbox.kill()
}
```

**fileExists Implementation** (E2B SDK lacks native `exists()` method):
```typescript
fileExists = async (path: string): Promise<boolean> => {
  try {
    await this.sandbox.files.read(path)
    return true
  } catch {
    return false
  }
}
```

- All operations delegate to E2B SDK (REST API to remote microVM)
- Config accepts: `template`, `apiKey`, `timeout` (→ `timeoutMs`), `envVars`

### 3. LocalSandboxProvider (`src/local.ts`)

Uses just-bash virtual shell with optional V8 isolation for local execution.

**LocalSandboxProvider**:
```typescript
class LocalSandboxProvider implements ISandboxProvider {
  type = 'local'
  async create(config: TSandboxConfig): Promise<ISandbox>
  // Creates InMemoryFs, Bash, /workspace + /tmp dirs
  // Reads memory limit from config.options?.memory (number, default: 128 MB)
  // Optionally initializes IsolateRunner (graceful fallback if unavailable)
}
```

**LocalSandbox**:
```typescript
class LocalSandbox implements ISandbox {
  constructor(bash, fs, isolateRunner?, cwd = '/workspace')
  exec(command, args?)    // → bash.exec(cmd, {cwd})
  readFile(path)          // → fs.readFile(path)
  writeFile(path, content)// → fs.writeFile(path, content)
  listDir(path)           // → fs entries with stat checks, [DIR] prefix
  deleteFile(path)        // → fs.unlink(path)
  mkdir(path)             // → fs.mkdir(path, {recursive: true})
  fileExists(path)        // → try stat, return boolean
  close()                 // → dispose isolateRunner if present
}
```

**Graceful Degradation**: If `isolated-vm` is not available (e.g., no native compilation), the provider logs a warning and continues without JS code isolation:

```typescript
try {
  runner = new IsolateRunner({ bash, fs })
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
  dispose(): void                    // Releases isolate, context, shims
}
```

**Memory Configuration**:
- Read from `config.options?.memory` (number) in LocalSandboxProvider
- Default: 128 MB
- Passed directly to IsolateRunner constructor
- Controls V8 isolate heap size limit

**Shims Provided** (Node.js API compatibility inside the isolate):

| Module | APIs | Implementation |
|--------|------|----------------|
| `fs` + `node:fs` | readFile, writeFile, mkdir, readdir, rm, stat, readFileSync, writeFileSync | Bridged to just-bash IFileSystem |
| `path` + `node:path` | join, resolve, dirname, basename, extname, sep, delimiter | Pure JS path manipulation |
| `child_process` + `node:child_process` | exec, execSync | Routes to bash.exec() via `_shellRun` callback |
| `console` | log, error, warn, info | Captured output bridge |

**Key Design Decisions**:
- **Lazy loading**: `isolated-vm` loaded via dynamic `import()` on first `init()` call (avoids crashes when native addon unavailable)
- **Console capture**: `console.log/error/warn/info` intercepted via callbacks, output collected in `#output[]`
- **Module system**: User code compiled as ES module, imports resolved via shim map
- **Memory limit**: Configurable (default 128 MB)
- **Timeout**: Default 5000ms per eval

## Key Patterns

### 1. Strategy Pattern

Both providers implement `ISandboxProvider` with the same interface, swappable at runtime:

```typescript
const provider = createSandboxProvider('local')  // or 'e2b'
const sandbox = await provider.create(config)
await sandbox.exec('ls', ['-la'])
```

### 2. Adapter Pattern

`IsolateRunner` adapts `isolated-vm` to work with just-bash's filesystem API, providing familiar Node.js APIs inside the V8 isolate.

### 3. Graceful Resource Management

All components handle cleanup safely:

```typescript
// IsolateRunner: try/catch for already-released resources
dispose() {
  try { this.#context?.release() } catch {}
  try { this.#isolate?.dispose() } catch {}
  this.#shims.clear()
}

// LocalSandbox: null-safe runner dispose
async close() {
  this.#runner?.dispose()
}
```

### 4. Lazy Initialization

`IsolateRunner.init()` is idempotent and only loads `isolated-vm` on first call:

```typescript
async init() {
  if (this.#isolate) return  // Already initialized
  const ivm = await import('isolated-vm')
  // ... setup
}
```

### 5. Directory Listing Convention

Both providers prefix directory entries with `[DIR]` for type identification:

```typescript
const entries = await sandbox.listDir('/workspace')
// Returns: ['file.ts', '[DIR] src', '[DIR] node_modules']
```

## Dependencies

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@tdsk/domain` | workspace | ISandbox, ISandboxProvider, TSandboxConfig types |
| `e2b` | ^1.2.0 | Firecracker microVM SDK (cloud provider) |
| `isolated-vm` | ^5.0.1 | V8 isolate wrapper (native addon) |
| `just-bash` | 2.5.5 | Virtual shell + in-memory filesystem |
| `alias-hq` | 6.2.4 | Path alias resolution |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `@biomejs/biome` | Linting and formatting |
| `typescript` | Type checking |
| `vitest` | Test framework |
| `vite-tsconfig-paths` | Path alias resolution in tests |

## Commands

### Testing

```bash
pnpm test            # Run vitest (57 tests, 4 files)
```

### Commands Notes

* Linting and formatting run automatically via Biome — `pnpm lint` and `pnpm format` should be ignored.
* No build step — consumed as TypeScript source via workspace path aliases.
* `isolated-vm` requires native compilation. If it fails to install, the local provider still works (just without JS code isolation).

## Testing

### Current Coverage (57 tests, 4 files)

| Test File | Tests | What's Covered |
|-----------|-------|----------------|
| `src/factory.test.ts` | 7 | Provider creation, error handling, fresh instances, interface compliance |
| `src/isolate.test.ts` | 21 | Constructor, init (context/console/shims/idempotence), eval (auto-init/modules/timeout), dispose |
| `src/e2b.test.ts` | 11 | exec, readFile, writeFile, listDir, deleteFile, mkdir, fileExists, close |
| `src/local.test.ts` | 18 | exec, readFile, writeFile, listDir, deleteFile, mkdir, fileExists, close, provider creation |

**Testing Strategy**:
- All external dependencies mocked (`isolated-vm`, `e2b`, `just-bash`)
- Vitest with Node.js environment
- Co-located test files (`.test.ts` adjacent to source)
- Covers happy paths, error cases, and edge cases (null runner, double dispose)

## Integration Points

### With Agent (`@tdsk/agent`)

- Agent's `AgentRunner` calls `createSandboxProvider(type)` to get a sandbox
- Sandbox used for code execution during ReAct loop
- `ISandbox.exec()` replaces the old Executor shell bridge

### With Domain (`@tdsk/domain`)

- `ISandbox` — Core sandbox interface
- `ISandboxProvider` — Provider interface (type + create)
- `TSandboxConfig` — Configuration passed to `create()`
- `TSandboxResult` — Result from `exec()` (stdout, stderr, exitCode)
- `TSandboxProviderType` — Union type (`'e2b' | 'local'`)

### With REPL (`@tdsk/repl`)

- REPL's `LocalAgentExecutor` passes sandbox config to AgentRunner
- Sandbox type selected based on agent's resolved configuration

### With Backend (`@tdsk/backend`)

- Backend resolves agent sandbox config and passes it to execution context
- Sandbox provider type stored in agent configuration

## Path Aliases

```json
{
  "@TSB": ["src"],
  "@TSB/*": ["src/*"],
  "@TSB/configs": ["configs"],
  "@tdsk/domain": ["../domain/src"]
}
```

## Development Notes

### Adding a New Sandbox Provider

1. Create a new file in `src/` (e.g., `docker.ts`)
2. Implement `ISandboxProvider` and `ISandbox` interfaces
3. Register in `src/factory.ts`:
   ```typescript
   const providers = {
     e2b: () => new E2bSandboxProvider(),
     local: () => new LocalSandboxProvider(),
     docker: () => new DockerSandboxProvider(),  // Add here
   }
   ```
4. Export from `src/index.ts`
5. Add `TSandboxProviderType` union member in `@tdsk/domain`

### Adding a New Shim to IsolateRunner

1. Create the shim module source string in `IsolateRunner.init()`
2. Register callbacks on the context jail (e.g., `_myCallback`)
3. Compile as `ivm.Module` and add to `#shims` map
4. User code can then `import x from 'my-module'`

### isolated-vm Troubleshooting

- Requires native compilation (node-gyp)
- May fail on some platforms (Alpine Linux, ARM)
- If unavailable, LocalSandboxProvider gracefully degrades (shell/fs only, no JS isolation)
- In tests, always mocked — no real V8 isolation tested

---

**Last Updated:** 2026-02-15
**Version:** 1.1.0

### Changelog

#### v1.1.0 (2026-02-15)
- **Fixed**: Factory now uses `Map<TSandboxProviderType, () => ISandboxProvider>` (was incorrectly documented as Record)
- **Fixed**: E2B `fileExists()` implementation details — uses try/catch on `files.read()` (SDK lacks native `exists()` method)
- **Fixed**: LocalSandboxProvider memory config — reads from `config.options?.memory`, default 128 MB
- **Fixed**: IsolateRunner shim modules — documented all 4 shim modules (fs, path, child_process, console)
- **Fixed**: Test count correction — 57 tests across 4 files (factory: 7, e2b: 11, local: 18, isolate: 21)
- **Docs**: Improved clarity on Map-based factory, E2B fileExists workaround, and memory configuration flow

#### v1.0.0 (2026-02-13)
- **Initial Release**: Extracted from agent repo (commit 85aedef)
- **New**: Factory pattern with `createSandboxProvider()` entry point
- **New**: E2bSandboxProvider — Firecracker microVM sandbox via E2B SDK
- **New**: LocalSandboxProvider — just-bash virtual shell + optional V8 isolate
- **New**: IsolateRunner — V8 isolate with fs/path/subprocess shims
- **New**: Graceful degradation when isolated-vm unavailable
- **Testing**: 57/57 tests passing across 4 test files
