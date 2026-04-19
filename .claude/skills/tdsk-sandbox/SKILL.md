---
name: "tdsk-sandbox"
description: "Knowledge base for the pluggable sandbox execution layer"
tags: ["sandbox", "isolation", "v8-isolate", "kubernetes", "just-bash", "isomorphic-git", "security"]
---
# Sandbox Repo Skill

## Overview

The **Sandbox** repo (`repos/sandbox`, `@tdsk/sandbox`) is a pluggable execution layer providing isolated environments for running agent code. Key facts:

- **Type**: Library (no server/CLI/build step -- consumed as TypeScript source), ~3500 LOC across 42 files
- **Pattern**: Factory + Strategy via `createSandboxProvider(type)` returning `ISandboxProvider`
- **Providers**: `local` (in-memory virtual shell + optional V8 isolate + virtual git) and `kubernetes` (K8s Exec API)
- **Graceful Degradation**: Local provider works without `isolated-vm` (shell/fs/git still function)
- **Extensible**: Implement `ISandboxProvider`, register in factory

## Directory Structure

```
repos/sandbox/
├── configs/                # aliases, biome, vitest config
├── src/
│   ├── index.ts            # Barrel export
│   ├── sandbox.ts          # createSandboxProvider() factory
│   ├── constants/          # DefaultWorkdir, DefaultTempdir, PodLabelKeys, PodCycleInterval, etc.
│   ├── git/                # Virtual git (isomorphic-git): gitCommand (20 subcommands), fsAdapter
│   ├── kube/               # K8s provider: kubeClient, kubeSandbox, kubeSandboxProvider, podManifest, kubeEvents, parseSandboxHost, toContainerState, getKubeNS
│   ├── local/              # Local provider: local sandbox, isolate runner, shims/ (13 Node.js shims)
│   ├── types/              # pod.types, kube.types, shims.types, git.types
│   └── utils/              # Logger
```

## Architecture

### Factory

`createSandboxProvider(type: TSandboxType)` returns either `LocalSandboxProvider` or `KubeSandboxProvider`. Map-based, returns fresh instances, throws for unknown types, extensible via `providers.set()`.

### Provider Hierarchy

The `ISandboxProvider` interface (from `@tdsk/domain`) has two implementations. `KubeSandboxProvider` creates `KubeSandbox` instances that connect to existing K8s pods via `KubeClient` and the K8s Exec API (WebSocket, never child_process). Pods are created externally by the backend's `SandboxService`. `LocalSandboxProvider` creates `LocalSandbox` instances backed by a just-bash virtual shell, in-memory filesystem, optional `IsolateRunner` (V8 isolate with 13 Node.js shims), and virtual git via isomorphic-git.

### ISandbox Interface

Defined in `@tdsk/domain`, implemented by both providers. Methods: `exec`, `readFile`, `writeFile`, `listDir`, `deleteFile`, `mkdir`, `fileExists`, `evaluate`, `reset`, `close`.

## Key Components

### KubeSandboxProvider (`src/kube/kubeSandboxProvider.ts`)

Factory creating `KubeSandbox` instances. Requires `config.options.podName` (throws if missing). Optional: `namespace` (defaults via `getKubeNS()`), `runtimes` (array of `TSandboxRuntime`), `defaultRuntime`.

### KubeSandbox (`src/kube/kubeSandbox.ts`)

ISandbox backed by K8s pods. All file/exec operations delegate to `KubeClient.runInPod()`. The `evaluate()` method writes code to a temp dir, runs with the resolved runtime command, then cleans up. `reset()` clears `/workspace/*` and `/tmp/*`. `close()` is a no-op (does NOT delete pod).

### KubeClient (`src/kube/kubeClient.ts`)

K8s API client (~325 LOC). Loads KubeConfig (in-cluster first, fallback to default).

| Category | Methods |
|----------|---------|
| Pod CRUD | `createPod`, `getPod`, `listPods`, `deletePod` |
| Shell | `runInPod(podName, command[], stdin?)` -- K8s Exec API, returns `TSandboxResult` |
| Watch | `watch(events)`, `cycleListen(events, intervalMs?)` (restarts every 10min for K8s bug #596), `stopWatch`, `cleanup` |
| Hydration | `hydrate()` (full), `hydrateSingle(pod)`, `removeFromCache(pod)`, `shouldHydrate`, `shouldRemove`, `onRemoveRoute`, `routes` getter |

### LocalSandboxProvider (`src/local/local.ts`)

Creates `LocalSandbox` with just-bash virtual shell, in-memory FS, optional `IsolateRunner`, and virtual git. Reads `memory` (default 128 MB) and `maxTimerMs` (default 30s) from config options. Gracefully degrades if `isolated-vm` is unavailable.

`LocalSandbox` delegates `exec` to bash, file ops to FS, `evaluate` to `IsolateRunner` (with optional module pre-registration). `reset()` releases user modules and clears `/workspace` + `/tmp`.

### IsolateRunner (`src/local/isolate.ts`)

V8 isolate wrapper (~361 LOC) for safe JS execution. Methods: `init()` (lazy, idempotent), `evaluate(code, timeout?)`, `registerModule(name, code)`, `releaseUserModules()`, `dispose()`.

**Shims Provided** (13 modules + Process global):

| Module | Key APIs |
|--------|----------|
| `buffer` | Buffer class (from, alloc, concat, isBuffer, UTF-8) |
| `path` | join, resolve, dirname, basename, extname, normalize, isAbsolute |
| `fs` | readFile, writeFile, mkdir, readdir, unlink, stat + sync variants (bridged to just-bash IFileSystem) |
| `child_process` | execSync (routes to bash via callback) |
| `url` | URL class, url.parse/format/resolve |
| `querystring` | encode, decode, stringify, parse |
| `events` | EventEmitter (on, once, off, emit) |
| `os` | platform, arch, hostname, tmpdir, homedir, cpus |
| `crypto` | randomBytes, randomUUID, createHash (SHA-256) |
| `util` | promisify, inherits, inspect, isDeepStrictEqual |
| `assert` | assert, assert.ok, assert.equal, assert.deepEqual, assert.throws |
| `console` | log, error, warn, info (captured via callback, globals-only) |
| `fetch` | globalThis.fetch (bridge via callback, globals-only) |
| Process | process.env, cwd(), exit() (throws), stdout/stderr, nextTick |

All shims support both bare and `node:` prefix imports. Compiled in order from `shimRegistry` (dependency order matters). `builtinShimNames` Set distinguishes built-in from user-registered modules.

Timers: `setTimeout`/`setInterval`/`setImmediate` with `maxTimerMs` clamp, max 100 concurrent, cleared at start/end of each evaluation call.

### Git System (`src/git/`)

Full virtual git (~643 LOC) using isomorphic-git against in-memory FS. Registered as a just-bash custom command via `defineCommand('git', ...)`. Supports 20 subcommands:

`init`, `add`, `commit`, `status`, `log`, `branch`, `checkout`, `switch`, `merge`, `diff`, `rev-parse`, `tag`, `remote`, `reset`, `rm`, `show`, `cherry-pick`, `stash`, `clone`, `fetch`/`pull`/`push`

The `fsAdapter` bridges just-bash `IFileSystem` to isomorphic-git's `PromiseFsClient`, wrapping stat objects with method-based type checks and fixing POSIX error codes.

### Pod Manifest (`src/kube/podManifest.ts`)

Builds K8s pod specs. Key functions: `buildPodManifest(opts)`, `buildPodName(sandboxId)` (RFC 1123 compliant), `sanitizeLabel(value)`.

Pod structure: `restartPolicy: Never`, init container for iptables egress proxy redirect, main `sandbox` container with runtime-resolved command, CA cert volume mount, lifecycle `postStart` writing env profile.

Runtime resolution: validates against `SandboxRuntimeConfigs` (from `@tdsk/domain`), sets `TDSK_RUNTIME` and `TDSK_RUNTIME_CMD` env vars. Two-command model: `command`/`args` = container start, `runtimeCommand` = what runs post-SSH. Fallback: `sleep infinity`.

### Watch and Events (`src/kube/kubeEvents.ts`)

`setupKubeWatcher(client)` wires pod events to hydration: added/modified call `hydrateSingle()`, deleted calls `removeFromCache()`. Uses `cycleListen()` (10-min restart cycle).

### Subdomain Parsing (`src/kube/parseSandboxHost.ts`)

Parses flat DNS sandbox hostnames: `3000--sb-a1b2c3d4.local.threadedstack.app` into `{ port, subdomain }`. Uses `--` separator for single-level wildcard compatibility.

## Key Patterns

**Graceful Resource Management**: All components use `safeRelease()` for cleanup (catches expected errors, warns on unexpected). IsolateRunner releases shims/context/isolate in order.

**Lazy Initialization**: `IsolateRunner.init()` is idempotent, only loads `isolated-vm` on first call. `evaluate()` and `registerModule()` auto-call `init()`.

**Directory Listing Convention**: Both providers prefix directory entries with `[DIR]` for type identification.

**Security Model**: KubeSandbox executes only via K8s Exec API (never child_process). LocalSandbox uses V8 isolate with memory limit and timer clamp. Egress proxy routes pod HTTP/HTTPS through iptables to MITM proxy for secret injection. `process.exit()` throws instead of exiting.

## Integration Points

- **Backend**: Uses `KubeClient` for pod CRUD, `podManifest` for spec generation, `setupKubeWatcher` for live monitoring, `parseSandboxHost` for subdomain routing, `runInPod` for shell commands
- **Domain**: `ISandbox`, `ISandboxProvider`, `TSandboxConfig`, `TSandboxResult`, `TSandboxType`, `TSandboxRuntime`, `ESandboxType`, `ESandboxRuntime`, `EContainerState`, `SandboxRuntimeConfigs`, `TKubeSandboxConfig`, `TPlaceholderMap`, `TRouteMap`/`TRouteMapEntry`
- **Agent**: `AgentRunner` calls `createSandboxProvider(type)` for code execution in ReAct loop
- **TSA**: `tsa run` launches runtime command after SSH connection to K8s sandbox

## Commands

```bash
pnpm test           # Vitest tests (~395 tests, 10 files)
pnpm types          # TypeScript type checking
```
