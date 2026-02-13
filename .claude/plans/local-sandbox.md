# Plan to implement

**Plan: Local Development Sandbox for Agent Repo**

**Context**

The agent repo uses E2B Firecracker microVMs as its sandbox for code execution. While this works for deployed environments, it's expensive for local development and requires E2B API authorization. We need a local sandbox alternative using isolated-vm (V8 isolation) and just-bash (simulated shell + virtual filesystem) that implements the existing ISandbox interface, so non-production environments can run without E2B.

**Architecture**

**LocalSandbox implements ISandbox**

* **just-bash (primary runtime)**
* Bash instance with MountableFs + OverlayFs
* Handles: all ISandbox methods (shell exec, readFile, writeFile, listDir, etc.)
* Virtual FS: reads from mounted host dir, writes to in-memory overlay
* Command whitelisting + ExecutionLimits for safety


* **isolated-vm (code execution isolation)**
* V8 isolate with configurable memory limit (default 128MB)
* Timeout enforcement per operation
* Node.js module shims: fs, path, child_process routed to just-bash
* Code inside VM interacts with just-bash FS and shell transparently



**How they work together:**

* just-bash is the foundation: it provides the virtual filesystem and shell
* isolated-vm runs user JS code in a V8 isolate, but with shims that route node:fs, node:path, and node:child_process imports to just-bash's filesystem and shell
* Code in the VM sees standard Node.js-like APIs, but all I/O goes through just-bash
* Simple shell commands go directly through just-bash; JS code execution goes through the isolate with just-bash backing

**Changes by Repo**

**1. Agent Repo (repos/agent/)**

**1a. Add dependencies to package.json**

* just-bash: ^2.5.5 (production dependency)
* isolated-vm: ^5.0.1 (production dependency)

**1b. New file: src/sandbox/local.ts — LocalSandbox + LocalSandboxProvider**

**LocalSandbox class (implements ISandbox):**

* Constructor takes TSandboxConfig + internal Bash instance + IsolateRunner
* exec(command, args?): joins args, calls bash.exec(fullCommand, { cwd }), maps BashExecResult to TSandboxResult
* readFile(path): bash.fs.readFile(path)
* writeFile(path, content): bash.fs.writeFile(path, content)
* listDir(path): bash.fs.readdir(path) + bash.fs.stat() for [DIR] prefix (matches e2b output format)
* deleteFile(path): bash.fs.rm(path)
* mkdir(path): bash.fs.mkdir(path, { recursive: true })
* fileExists(path): bash.fs.exists(path)
* close(): dispose isolate, cleanup bash instance

**LocalSandboxProvider class (implements ISandboxProvider):**

* type = 'local'
* create(config):
1. Create MountableFs with InMemoryFs base
2. If config.options?.mountDir is set, mount an OverlayFs at /workspace (copy-on-write from host dir)
3. Create Bash instance with the filesystem, env vars from config, execution limits, and command whitelist
4. Create IsolateRunner with memory limit from config.options?.memory (default 128MB), passing the Bash instance for shim wiring
5. Return LocalSandbox instance



**1c. New file: src/sandbox/isolate.ts — IsolateRunner**

**Wraps isolated-vm for code execution with just-bash backed shims:**

**Constructor: (opts: { memory?: number, bash: Bash })**

* Creates Isolate with memory limit
* Stores reference to Bash instance for shim routing

**async init(): Sets up the V8 context with Node.js API shims:**

* globalThis.console → ivm.Callback that captures output
* Compiles ES6 shim modules for:
* fs module: readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync → all route to just-bash's IFileSystem via ivm.Callback bridges (host-side callbacks that call bash.fs.* methods)
* path module: join, resolve, dirname, basename, extname, normalize, sep, posix → pure JS implementations (no host I/O needed, can run directly in isolate)
* child_process module: execSync → routes to bash.exec() via ivm.Callback (returns stdout as Buffer-like string)


* Module resolution via instantiate() callback: when user code imports 'fs', 'node:fs', 'path', 'node:path', 'child_process', or 'node:child_process', returns the shim module

**async eval(code, timeout?):** Compiles user code as ES6 module, instantiates with shim resolver, evaluates with timeout

**dispose():** Releases context and isolate

**1d. Update src/sandbox/factory.ts**

Add local provider to the providers map:
`['local', () => new LocalSandboxProvider()]`

**1e. Update src/sandbox/index.ts**

Export new classes from ./local and ./isolate.

**1f. New test: src/sandbox/local.test.ts (co-located)**

Comprehensive tests mirroring e2b.test.ts pattern (~15 tests):

* exec() — command with/without args, exit codes, stderr mapping
* readFile() — reads from virtual FS
* writeFile() — writes to virtual FS, verify with read
* listDir() — returns files and [DIR]-prefixed directories
* deleteFile() — removes file from FS
* mkdir() — creates directory (recursive)
* fileExists() — true for existing, false for missing
* close() — cleanup without errors
* Provider creates with env vars, mount options, defaults

**1g. New test: src/sandbox/isolate.test.ts (co-located)**

Tests for IsolateRunner (~10 tests):

* Creates isolate with memory limit
* Evaluates simple JS expressions
* Enforces timeout on long-running code
* console.log works via bridge
* fs.readFileSync shim reads from just-bash FS
* fs.writeFileSync shim writes to just-bash FS
* child_process.execSync shim runs command via just-bash
* path.join works as expected (pure JS)
* Cannot access real Node.js APIs (process, require, etc.)
* Dispose cleans up properly

**1h. Update src/sandbox/tests/factory.test.ts**

Add test for local provider type returning LocalSandboxProvider.

**2. Backend Repo (repos/backend/)**

**2a. Update src/endpoints/agents/runAgent.ts**

Modify sandbox config resolution (lines 113-122) to default to local when no explicit sandbox config is provided:

```typescript
const explicitSandbox = agent.environment?.options?.sandbox
const sandboxConfig = {
  envVars: agent.envVars,
  timeout: agent.environment?.timeout ?? 300000,
  apiKey: explicitSandbox?.apiKey,
  template: explicitSandbox?.template,
  provider: explicitSandbox?.provider || 'local',
}

```

**This means:**

* Agents with explicit sandbox.provider = 'e2b' keep using e2b
* Agents without sandbox config get local sandbox (enabling tool use without e2b)
* No NODE_ENV check needed; the agent's own config determines the provider

**2b. Update src/endpoints/agents/runAgent.test.ts**

Update test expectations for the new default behavior:

* Existing tests that pass sandboxConfig: { provider: 'e2b' } continue working
* Add test verifying default sandbox config uses 'local' when no explicit sandbox set

**3. Domain Repo — No changes needed**

ESandboxProvider.local already exists in sandbox.types.ts.

**File Summary**

* **File:** repos/agent/package.json
* **Action:** Edit; add just-bash, isolated-vm

---

* **File:** repos/agent/src/sandbox/local.ts
* **Action:** Create; LocalSandbox + LocalSandboxProvider

---

* **File:** repos/agent/src/sandbox/isolate.ts
* **Action:** Create; IsolateRunner with just-bash shims

---

* **File:** repos/agent/src/sandbox/factory.ts
* **Action:** Edit; register local provider

---

* **File:** repos/agent/src/sandbox/index.ts
* **Action:** Edit; export new modules

---

* **File:** repos/agent/src/sandbox/local.test.ts
* **Action:** Create; co-located LocalSandbox tests

---

* **File:** repos/agent/src/sandbox/isolate.test.ts
* **Action:** Create; co-located IsolateRunner tests

---

* **File:** repos/agent/src/sandbox/**tests**/factory.test.ts
* **Action:** Edit; add local provider test

---

* **File:** repos/backend/src/endpoints/agents/runAgent.ts
* **Action:** Edit; default sandbox to local

---

* **File:** repos/backend/src/endpoints/agents/runAgent.test.ts
* **Action:** Edit; update expectations

**Verification**

1. Install deps: cd repos/agent && pnpm install
2. Agent tests: cd repos/agent && pnpm test; all existing + new tests pass
3. Backend tests: cd repos/backend && pnpm test; all existing + updated tests pass
4. Build chain: pnpm --filter @tdsk/agent build && pnpm --filter @tdsk/backend build.

Would you like me to start writing the implementation for any specific file from the plan?