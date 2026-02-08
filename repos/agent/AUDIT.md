# Agent Repo Audit

**Date**: 2026-02-08
**Repo**: `repos/agent` (`@tdsk/agent`)
**Version**: 1.6.0

## Summary

| Severity | Count |
|----------|-------|
| Critical | 22 |
| High | 30 |
| Medium | 38 |
| Low | 25 |
| **Total** | **115** |

**Test Coverage**: ~30-35% real coverage (10/11 test suites fail on import due to `@TAG/*` path alias resolution failure)

**Overall Assessment**: The agent repo has severe security vulnerabilities in its sandbox/executor model, multiple broken core features (sub-agent system entirely non-functional, WASM logger broken, shell execution in broken transition state), and test suites that largely cannot run. The security model is fundamentally compromised by allowing package managers in the command allowlist.

---

## Critical Issues (22)

### C-01: AllowedCommands includes shell-equivalent package managers
**File**: `src/constants/values.ts:6-11`
**Impact**: Complete sandbox bypass

The `AllowedCommands` list includes `npm`, `pnpm`, `yarn`, `pip`, `uv`, and `pdm`. All of these can run arbitrary shell commands (e.g., `npm run` with a custom package.json, `pip install` with a setup.py). This renders the entire Executor security model ineffective.

### C-02: AllowedCommands includes `rm`
**File**: `src/constants/values.ts:14`
**Impact**: Data destruction

The `rm` command is in the allowlist. Combined with insufficient path validation, a WASM guest could delete files outside its project directory.

### C-03: `git` in AllowedCommands enables arbitrary command running
**File**: `src/constants/values.ts:2`
**Impact**: Sandbox bypass

`git` supports config-based command injection (e.g., `git -c core.sshCommand='malicious' clone ...`), `git submodule`, and other vectors for arbitrary command running.

### C-04: BlockedPatterns regex bypass via `/g` flag
**File**: `src/constants/values.ts:20`
**Impact**: Pattern bypass

Some `BlockedPatterns` regexes use the `/g` flag. In JavaScript, `/g` regexes have stateful `lastIndex` that alternates between matching and not matching on consecutive `.test()` calls. An attacker can bypass any `/g`-flagged pattern by sending it twice.

### C-05: No `projectDir` validation in Executor
**File**: `src/services/executor.ts:40`
**Impact**: Path traversal

The `projectDir` passed to `Executor` is never validated for existence, permissions, or containment. Combined with insufficient `cwd` validation, commands can operate anywhere on the filesystem.

### C-06: `process.env.PATH` leaks host PATH into sandbox
**File**: `src/services/executor.ts:46`
**Impact**: Information disclosure / sandbox bypass

The sanitized environment still includes `process.env.PATH`, exposing the full host system PATH to sandboxed commands. This reveals system structure and allows accessing any binary on the host.

### C-07: Sandbox timeout ineffective for synchronous WASM
**File**: `src/services/sandbox.ts:90-99`
**Impact**: DoS

The sandbox timeout uses `setTimeout`, but WASM guest code runs synchronously (via `spawnSync`). The timeout callback can never fire while the event loop is blocked by synchronous execution.

### C-08: Path traversal via `startsWith()` without trailing `/`
**File**: `src/tsagent.ts:105,119,137,155,170,185,199`
**Impact**: Directory escape

Multiple methods in `TSAgent` validate paths using `path.startsWith(projectDir)` without appending a trailing `/`. This means `/home/user/project-evil` would pass validation for `projectDir=/home/user/project`.

### C-09: WASM Logger broken — `func.apply(console, ...args)`
**File**: `src/wasm/logger.ts:21`
**Impact**: All WASM guest logging broken

The spread operator is incorrectly applied: `func.apply(console, ...args)` should be `func.apply(console, args)`. The `apply` method expects an array as the second argument, not spread arguments. This breaks all logging from WASM guests.

### C-10: Logger level typo — "vebose" instead of "verbose"
**File**: `src/wasm/logger.ts:1,15`
**Impact**: Verbose logging level never works

The string literal `"vebose"` is used instead of `"verbose"`, so verbose-level log calls are silently dropped.

### C-11: Wrong env var prefix in agent config
**File**: `configs/agent.config.ts:17`
**Impact**: Config reads wrong values

Uses `TDSK_BE_LOGGER_PRETTY` (backend prefix) instead of `TDSK_AG_LOGGER_PRETTY`. The agent reads the backend's logger configuration instead of its own.

### C-12: `allowedTools` defaults to `[]` — blocks all tools
**File**: `src/wasm/guest/agent.ts:90-91`, `src/wasm/guest/guest.ts:60-61`
**Impact**: Zero tools available by default

`allowedTools` defaults to `[]` (empty array). Since an empty array is truthy in JavaScript, the filter logic treats it as "filtering enabled" and filters out ALL tools, making the agent unable to use any tools.

### C-13: Anthropic tool_use loop broken
**File**: `src/wasm/guest/provider.ts:152-172`
**Impact**: Anthropic provider cannot use tools

The Anthropic provider's tool_use message formatting is incorrect. Assistant messages with `tool_use` content blocks are not correctly structured per the Anthropic API spec, causing tool calls to fail silently or error.

### C-14: Shell command injection via unsanitized args
**File**: `src/wasm/guest/builtins.ts:56`
**Impact**: Command injection

Shell tool arguments are joined into a single string (`cmdArgs.join(' ')`) and passed to the shell, allowing metacharacter injection. No escaping or quoting is applied.

### C-15: `builtins.ts` args crash — no runtime validation
**File**: `src/wasm/guest/builtins.ts:56`
**Impact**: Runtime crash

`cmdArgs.join()` is called without checking that `cmdArgs` is defined or is an array. If `args` is undefined or missing the expected field, the tool crashes.

### C-16: No path validation on filesystem operations
**File**: `src/wasm/guest/fs/fs.ts`, `src/wasm/guest/builtins.ts`
**Impact**: Arbitrary file access

All 7 filesystem tools (readFile, writeFile, listDir, createDir, deleteFile, exists, stat) accept paths without any validation or sandboxing. A WASM guest can read/write anywhere the process has access.

### C-17: Sub-agent system entirely non-functional
**Files**: `src/wasm/wasm.ts:57-68`, `src/services/subagent.ts`, `src/wasm/guest/agent.ts`
**Impact**: Feature completely broken

The sub-agent system has at least 4 independent failures:
1. `wasm.ts:57-68` — WasmBridge only maps 10 host functions; sub-agent functions (`spawnAgent`, `sendMessage`, `receiveMessage`, `terminateAgent`) are never wired
2. Sub-agents have no LLM provider config (would need their own API keys)
3. `spawnAgent` creates a sandbox that would deadlock on the parent's mutex
4. All sub-agent tests mock everything — 0% real coverage

### C-18: `executeShell` mapped but WIT contract broken
**File**: `src/wasm/wasm.ts`, `wit/world.wit`
**Impact**: Feature in broken transition state

`executeShell` is mapped in the host bridge, but `shell-exec` is commented out in the WIT file. Meanwhile, the WASM guest uses `just-bash` for in-WASM shell execution, completely bypassing the Host Executor's security controls (AllowedCommands, BlockedPatterns, CWD isolation).

### C-19: Guest-side sandbox uses dynamic code evaluation without isolation
**File**: `src/wasm/guest/sandbox.ts`
**Impact**: Sandbox escape

The guest-side sandbox uses dynamic code evaluation via the `Function` constructor, which is not isolated — it can access all WASM module globals, including imported host functions and any state in the guest module scope.

### C-20: `tsup.config.ts` noExternal/external conflict
**File**: `configs/tsup.config.ts:31,33-35`
**Impact**: Build unpredictability

`noExternal: [/(.*)/]` (bundle everything) directly conflicts with `esbuildOptions.external: [...]` (externalize specific packages). The interaction between tsup's `noExternal` and esbuild's `external` is undefined and leads to unpredictable bundling behavior.

### C-21: Duplicate `TSandboxOpts` type definitions
**File**: `src/types/sandbox.types.ts:60` vs `src/services/sandbox.ts:17`
**Impact**: Type confusion

Two completely different `TSandboxOpts` types exist with different shapes. The type in `sandbox.types.ts` has fields like `maxMemory`, `maxCpu`, `networkAccess`, while the one in `sandbox.ts` has `projectDir`, `tools`, `config`. Depending on which import is used, code may silently get the wrong type.

### C-22: `TWasmImports` optional fields crash WasmBridge
**File**: `src/types/wasm.types.ts:23-24`
**Impact**: Runtime crash

`TWasmImports.vfsMounts` and `TWasmImports.config` are typed as optional (`?`), but `WasmBridge` calls `Object.entries()` on them without null checks. Passing undefined causes a crash.

---

## High Issues (30)

### H-01: `package.json` main points to nonexistent file
**File**: `package.json:7`
`"main": "index.js"` — the actual build output is `dist/index.cjs`. Any `require('@tdsk/agent')` fails.

### H-02: CJS build but `"type": "module"` in package.json
**File**: `package.json:7`
Build produces `dist/index.cjs` but package.json declares `"type": "module"`. This creates confusion for module resolution.

### H-03: `@tdsk/database` dependency never imported
**File**: `package.json:35`
Listed as a dependency but never imported anywhere in the agent codebase.

### H-04: Unused dependencies — browserify-zlib, events, sprintf-js
**File**: `package.json:40,42,45`
Three npm packages listed as dependencies but never imported.

### H-05: Unused devDependencies — @types/shell-quote, rimraf
**File**: `package.json:51,53`
`@types/shell-quote` has no corresponding `shell-quote` dep. `rimraf` is never referenced.

### H-06: Mutex `maxLocks` and `timeout` never enforced
**File**: `src/services/mutex.ts:9-10`
Constructor accepts `maxLocks` and `timeout` parameters but they're stored as properties and never checked. Any number of locks can be acquired with no timeout.

### H-07: Mutex `clearAll()` leaves dangling promises
**File**: `src/services/mutex.ts:57-59`
`clearAll()` resolves the current lock but doesn't drain the queue, leaving pending lock promises that will never resolve or reject.

### H-08: SubAgentManager `setInterval` leaks
**File**: `src/services/subagent.ts:52-66`
The cleanup interval is created but never cleared. If `SubAgentManager` is instantiated multiple times, intervals accumulate. The async cleanup function called from `setInterval` has no error handling.

### H-09: Custom tools accumulate across runs
**File**: `src/services/sandbox.ts`
Tools registered via `registerTool()` persist across runs on the same sandbox instance. There's no mechanism to clear custom tools between agent invocations.

### H-10: Sandbox `tools` property is public
**File**: `src/services/sandbox.ts:36`
The `tools` map is a public property. In a multi-tenant scenario, one tenant's sandbox could access or modify another tenant's tool registrations if they share a reference.

### H-11: Executor stderr returned as success output
**File**: `src/services/executor.ts:55`
When a command writes to stderr but exits with code 0, the stderr output is returned as the result. This masks warnings and partial failures.

### H-12: `spawnSync` blocks event loop
**File**: `src/services/executor.ts`
All command execution uses `spawnSync`, blocking the Node.js event loop for the entire duration of every command. This prevents handling other requests or timeouts during command execution.

### H-13: Re-initialization overwrites active sandbox instance
**File**: `src/services/sandbox.ts`
Calling `initialize()` on an already-initialized sandbox replaces the WASM instance without cleaning up the previous one, potentially leaking resources.

### H-14: Logger ignores pretty/silent config
**File**: `src/utils/logger.ts` (referenced from `configs/agent.config.ts`)
The logger setup reads config for `pretty` and `silent` but these values are never applied to the Winston transport configuration.

### H-15: 100% code duplication with domain's `loadEnvs`/`addToProcess`
**File**: `scripts/loadEnvs.ts`
Identical copies of `loadEnvs` and `addToProcess` from `@tdsk/domain`. Should import from domain instead.

### H-16: OpenAI provider sends empty tools array
**File**: `src/wasm/guest/provider.ts`
When no tools are available, the OpenAI provider still sends `tools: []` in the request. Some API versions treat this differently than omitting the field entirely.

### H-17: Anthropic model default outdated
**File**: `src/wasm/guest/provider.ts:105`
Default model is `claude-3-5-sonnet-20240620` — an outdated model identifier.

### H-18: No request timeout on LLM API calls
**File**: `src/wasm/guest/provider.ts:47-59`
LLM API calls have no timeout configuration. A slow or hanging API response blocks the agent indefinitely.

### H-19: JSON.parse of tool config with no error handling
**File**: `src/wasm/guest/agent.ts:91-98`
Tool configuration loaded from environment variables is parsed with `JSON.parse()` but has no try/catch. Malformed JSON crashes the agent.

### H-20: Token estimation ignores tool_calls field
**File**: `src/wasm/guest/context.ts:29`
The token counting function only counts `content` fields in messages, ignoring `tool_calls` and `tool_use` blocks which can be substantial. This causes context windows to overflow.

### H-21: Anthropic max_tokens hardcoded to 4096
**File**: `src/wasm/guest/provider.ts:143`
The `max_tokens` parameter is hardcoded to 4096, regardless of the model being used. Newer models support much larger output windows.

### H-22: Debug console.log leaks environment variables
**File**: `src/wasm/guest/shell.ts:51-55`
Debug `console.log` statements dump the full environment including `AGENT_API_KEY` and other sensitive values. These are not gated behind a debug flag.

### H-23: Duplicate StreamManager class — manager.ts is dead code
**File**: `src/wasm/guest/tools/manager.ts` vs `src/wasm/guest/tools/streams.ts`
Two `StreamManager` implementations exist. The one in `manager.ts` has inverted stream types (stdin/stdout swapped) and is never imported. It should be deleted.

### H-24: Shell `init()` error silently swallowed
**File**: `src/wasm/guest/shell.ts:45`
If `Shell.init()` throws, the error is caught and silently ignored. The `initialized` flag is never set, causing all subsequent `run()` calls to fail with a confusing error.

### H-25: Shell `run()` ignores exit code and stderr
**File**: `src/wasm/guest/shell.ts:48-57`
The shell's `run()` method returns only stdout, discarding the exit code and stderr. Failed commands appear to succeed.

### H-26: Custom tool name passed without validation
**File**: `src/wasm/guest/guest.ts:107-110`
Custom tool names from LLM responses are used directly without validation. Malicious or malformed tool names could cause unexpected behavior.

### H-27: JSON.parse error in tool execution leaks internals to LLM
**File**: `src/wasm/guest/guest.ts:113`
When JSON.parse fails on tool arguments, the error message (including internal details) is returned to the LLM as the tool result.

### H-28: `ILLMProvider.complete()` uses `any[]` for tools
**File**: `src/types/agent.types.ts:43`
The `complete()` method accepts `any[]` for tools, losing all type safety. Should use a proper tool type.

### H-29: `TWasmInstance` type incomplete vs implementation
**File**: `src/types/wasm.types.ts`
The `TWasmInstance` type definition is missing several methods that exist on the actual WASM instance at runtime.

### H-30: Per-tool-call Shell instance — no state persistence
**File**: `src/wasm/guest/builtins.ts:51`
Each shell tool invocation creates a new `Shell` instance. Working directory changes, environment variable modifications, and other state are lost between tool calls.

---

## Medium Issues (38)

### M-01: `rootDir: "../../"` in tsconfig.json is overly broad
Scopes the entire monorepo root as the TypeScript root directory.

### M-02: `strictNullChecks: false` in tsconfig.json
Disables one of TypeScript's most important safety checks.

### M-03: `noImplicitAny: false` in tsconfig.json
Allows implicit `any` types throughout the codebase.

### M-04: vitest.config.ts uses both alias-hq and vite-tsconfig-paths
Redundant alias resolution systems that conflict, causing 10/11 test suites to fail.

### M-05: `as unknown as UserConfig` cast in vitest.config.ts
Type assertion bypasses type checking on the entire vitest configuration.

### M-06: ReAct loop max iterations hardcoded to 10
No configuration option. Some tasks legitimately need more iterations.

### M-07: Context "middle-out" truncation is lossy
Truncation removes middle messages but doesn't track which tool results were dropped, potentially leaving orphaned tool_call references.

### M-08: No retry logic for LLM API calls
A single transient error (network blip, rate limit) fails the entire agent run.

### M-09: Grok provider is copy-paste of OpenAI with different URL
No Grok-specific handling for API differences.

### M-10: Gemini and ZAI providers return "not implemented"
Two provider types are referenced but throw "not implemented" at runtime.

### M-11: Tool result not validated before sending to LLM
Tool results of any size/content are sent directly to the LLM without truncation or sanitization.

### M-12: No rate limiting on tool calls
An agent could make unlimited rapid tool calls, causing resource exhaustion.

### M-13: Executor `AllowedCommands` is a flat list — no per-project config
All projects get the same command allowlist. No way to restrict specific projects to specific commands.

### M-14: Executor argument validation is string-based only
BlockedPatterns use regex on individual args but don't consider the semantic meaning of combined arguments.

### M-15: WASM build script uses esbuild directly (not tsup)
The WASM guest build uses a separate esbuild script, diverging from the tsup build for the host. Different bundler configurations can produce inconsistent results.

### M-16: Build script hardcodes wasm-tools path
The build script assumes `wasm-tools` is available at a specific path rather than resolving it dynamically.

### M-17: No WASM memory limits configured
WASM instances are created without explicit memory limits, defaulting to the engine's maximum.

### M-18: WIT file has commented-out functions
The `world.wit` file has commented-out interface functions, indicating an incomplete API surface.

### M-19: Host-Guest function mapping is fragile
The mapping between host functions and WIT imports is done by string matching. Adding or renaming a function requires changes in multiple files.

### M-20: No health check or readiness probe
The agent service has no health check endpoint for container orchestration.

### M-21: No graceful shutdown handling
Unlike the backend/proxy, the agent has no signal handlers for SIGTERM/SIGINT.

### M-22: `allowedTools` filter logic potentially inverted
**File**: `src/wasm/guest/agent.ts`
The filtering logic for `allowedTools` may filter IN or filter OUT depending on interpretation. Combined with the empty array default (C-12), this is confusing.

### M-23: Agent config not validated at startup
Configuration is read from environment but never validated for required fields or correct types.

### M-24: No structured error responses from tools
Tools return plain strings for both success and error cases. The LLM has no reliable way to distinguish success from failure.

### M-25: Thread/conversation history not persisted
Agent conversations are in-memory only. If the process restarts, all context is lost.

### M-26: No request tracing or correlation IDs
Logs from different agent runs interleave without any way to correlate them.

### M-27: Provider factory has no validation
The provider factory accepts any string as a provider type and only fails at runtime when the switch statement falls through.

### M-28: Tool descriptions not validated for length
Long tool descriptions consume tokens from the context window without any budget management.

### M-29: Agent doesn't report token usage
No tracking or reporting of total tokens consumed per agent run.

### M-30: Environment variables used as configuration store
Tool configs and provider settings are loaded from environment variables with complex parsing, rather than a proper config file.

### M-31: `just-bash` version pinned to 2.5.5
No automated dependency update mechanism for security patches.

### M-32: esbuild listed as production dependency
**File**: `package.json:41`
`esbuild` (build tool) is in `dependencies` rather than `devDependencies`.

### M-33: `tsx` listed as production dependency
**File**: `package.json:46`
`tsx` (TypeScript executor for development) is in `dependencies` rather than `devDependencies`.

### M-34: Dead export of `./adminPath` equivalent
Several index.ts barrel exports reference modules that don't exist.

### M-35: Missing `provider` relation in tool configs
Tool configurations reference provider types but have no relation back to the providers table.

### M-36: componentize-js version may have known issues
The WASM compilation toolchain version is not verified against known-good versions.

### M-37: Build output not verified
No post-build verification that the WASM binary is valid or that the CJS bundle loads correctly.

### M-38: Script files duplicate domain utility code
Multiple scripts in `scripts/` duplicate utility functions available from `@tdsk/domain`.

---

## Low Issues (25)

### L-01: Inconsistent file naming (camelCase vs kebab-case)
Mixed naming conventions across the codebase.

### L-02: Console.log used instead of logger in multiple files
Several files use `console.log` directly instead of the Winston logger.

### L-03: TODO comments without tracking
Multiple TODO comments in the codebase with no associated issue tracker items.

### L-04: Type assertions (`as`) used extensively
Many `as` casts that could be replaced with proper type narrowing.

### L-05: No JSDoc on public APIs
Exported functions and classes lack documentation.

### L-06: Inconsistent error message formatting
Error messages vary between `Error:`, `[ERROR]`, plain text, etc.

### L-07: Magic numbers without named constants
Hardcoded values like `10` (max iterations), `4096` (max tokens), etc.

### L-08: Unused type imports in multiple files
TypeScript `import type` statements for types that are never referenced.

### L-09: Dead type exports from types/index.ts
Several exported types are never imported by any consumer.

### L-10: Test file naming inconsistency
Mix of `*.test.ts` and `*.spec.ts` naming (though project standard is `*.test.ts`).

### L-11: `json-schema-to-ts` devDep appears unused
Listed in devDependencies but no import found.

### L-12: vitest version mismatch with other repos
Agent uses vitest 1.6.1 while other repos use 1.4.0.

### L-13: Incomplete .gitignore for build artifacts
WASM build artifacts may not be properly gitignored.

### L-14: No changelog or version history
Version is 1.6.0 but no changelog documents what changed between versions.

### L-15: Path alias `@TAG` (no slash) resolves to `./src`
The bare `@TAG` alias without slash can cause ambiguous imports.

### L-16: tsconfig includes `../shell/src` and `../database/src`
Includes external repo source in the agent's TypeScript compilation scope.

### L-17: No explicit Node.js version requirement
No `engines` field in package.json specifying required Node.js version.

### L-18: `module-alias` in dependencies but alias-hq handles resolution
Both `module-alias` and `alias-hq` are dependencies for path resolution.

### L-19: Test setup loads environment variables
Tests call `loadEnvs({ force: true })` which may conflict with CI environments.

### L-20: No test fixtures or factories
Tests create objects inline rather than using shared fixtures.

### L-21: Missing types for WASM host function parameters
Some host function parameters are typed as `any` or `unknown`.

### L-22: WasmBridge error messages not internationalized
Error messages are English-only hardcoded strings (minor for a developer tool).

### L-23: No contributing guide for the agent repo
No CONTRIBUTING.md or development setup instructions.

### L-24: Build scripts don't clean before building
`pnpm build` doesn't run `pnpm clean` first, potentially leaving stale artifacts.

### L-25: `@keg-hub/parse-config` version differs from other repos
Agent uses 2.1.0 while other repos use 2.2.0.

---

## Security Assessment

### Sandbox Security Model — FUNDAMENTALLY BROKEN

The agent's security model relies on three layers:
1. **WASM isolation** — Guest code runs in a WASM sandbox
2. **Host Executor** — Command allowlist + argument blocklist + CWD isolation
3. **Minimal environment** — Restricted env vars passed to commands

**All three layers are compromised:**

1. **WASM isolation bypassed**: The `just-bash` library runs shell commands inside the WASM guest, completely bypassing the Host Executor. Any command can be run without AllowedCommands or BlockedPatterns checks.

2. **Executor allowlist too permissive**: Even if the Host Executor were used, `npm`, `pnpm`, `yarn`, `pip`, `uv`, `pdm`, `git`, and `rm` in AllowedCommands allow arbitrary command execution and data destruction.

3. **Environment leaks**: `process.env.PATH` is passed to commands, revealing the entire host system binary layout. Debug `console.log` statements dump API keys and other secrets.

4. **Path traversal**: `startsWith()` without trailing `/` allows escaping project directories. Filesystem tools have zero path validation.

5. **Timeout ineffective**: `setTimeout`-based timeout cannot fire while `spawnSync` blocks the event loop.

### Recommendations

1. **Remove all package managers from AllowedCommands** — These are shell-equivalent
2. **Remove `rm` and `git` from AllowedCommands** — Too powerful without fine-grained controls
3. **Fix path validation** — Append trailing `/` to `startsWith()` checks; add path validation to all filesystem tools
4. **Route all shell through Host Executor** — Remove `just-bash` from WASM guest or add equivalent security controls
5. **Use async execution** — Replace `spawnSync` with `spawn` to allow timeouts to work
6. **Sanitize environment** — Don't pass `process.env.PATH`; construct a minimal PATH
7. **Remove debug logging** — Strip all `console.log` that dumps env vars
8. **Add per-project command policies** — Different projects may need different security profiles

---

## Test Assessment

### Current State
- **11 test files** exist across the codebase
- **10/11 suites fail** on import due to `@TAG/*` path alias not resolving in vitest
- Only `src/wasm/__tests__/agent.test.ts` passes (it uses no `@TAG/*` imports)
- Root cause: `configs/vitest.config.ts` uses both `alias-hq` (webpack format) and `vite-tsconfig-paths` but neither resolves `@TAG/*` correctly

### Test Quality Issues
- **Integration tests are theater**: `subagent.integration.test.ts` (781 lines) mocks the entire system, testing mock implementations rather than real code
- **Unit tests test recreations**: `agent.test.ts` copy-pastes function implementations into the test file and tests those instead of importing actual source code
- **Security tests are tautologies**: Mock-driven tests that verify mocks behave as mocked
- **Estimated real coverage**: ~30-35% (only tests that import and exercise actual source code)

### Recommended Fixes
1. Fix vitest alias resolution (choose one system, not both)
2. Rewrite integration tests to use real code paths
3. Add actual unit tests for Executor, Sandbox, and SubAgentManager
4. Add security-focused tests with real command execution (in a test sandbox)

---

## Cross-Repo Issues

### Domain Model Mismatches
- Agent uses `agentId` field (not in database schema)
- Thread/Message models reference `orgId`/`projectId` (not in database)
- `Function.defaultArgs` typed as `Record<string,any>` in domain but defaults to `[]` in database

### Shared Code Duplication
- `scripts/loadEnvs.ts` is identical to `@tdsk/domain/environment/loadEnvs.ts`
- `scripts/addToProcess.ts` is identical to `@tdsk/domain/environment/addToProcess.ts`
- Should import from `@tdsk/domain` instead of maintaining copies

### WASM/Shell Integration
- Agent depends on `@tdsk/wasm` and `@tdsk/shell` via workspace
- Shell execution is in a transition state: old Host Bridge (`executeShell`) is mapped but WIT contract is broken, new approach (`just-bash` in-WASM) bypasses security
- The `@TSH/*` path alias in tsconfig maps to `../shell/src` but shell types are not consistently used

---

## Architecture Notes

### Component Overview
```
TSAgent (Host - Node.js)
  Sandbox (WASM runtime)
    WasmBridge (Host-Guest interface)
    Guest Module (WASM)
      ReAct Loop (agent.ts)
      LLM Provider (provider.ts)
      Context Manager (context.ts)
      Tools (guest.ts, builtins.ts)
      Shell (shell.ts via just-bash)
  Executor (command runner)
  Mutex (per-project locking)
  SubAgentManager (non-functional)
```

### Build Pipeline
1. `build:app` — tsup bundles host code to `dist/index.cjs`
2. `build:agent` — esbuild bundles guest code, then `componentize-js` + `wasm-tools` compile to WASM component
3. `build:sandbox` — Same as agent but for sandbox variant

### Key Dependencies
- `@tdsk/wasm` — WASM compilation toolchain (componentize-js, wasm-tools)
- `@tdsk/shell` — Virtual shell environment (just-bash, ZenFS)
- `@tdsk/domain` — Shared types and utilities
- `@tdsk/logger` — Winston-based logging
- `esbuild` — Guest code bundling
- `tsx` — Runtime TypeScript execution for scripts

---

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| WASM Guest Execution | Partially Working | Logger broken, tools limited by empty allowedTools default |
| LLM Provider (OpenAI) | Working | Missing timeout, sends empty tools array |
| LLM Provider (Anthropic) | Broken | Tool use loop broken (C-13), outdated model default |
| LLM Provider (Grok) | Working | Copy-paste of OpenAI |
| LLM Provider (Gemini) | Not Implemented | Returns "not implemented" |
| LLM Provider (ZAI) | Not Implemented | Returns "not implemented" |
| Shell Execution | Broken/Insecure | just-bash bypasses security; Host Bridge WIT broken |
| Sub-Agent System | Non-Functional | 4 independent failures (C-17) |
| Filesystem Tools | Working but Insecure | No path validation (C-16) |
| Command Executor | Working but Insecure | AllowedCommands too permissive |
| Mutex/Locking | Partially Working | Limits not enforced (H-06) |
| Context Management | Partially Working | Token estimation incomplete (H-20) |
| Build Pipeline | Working | Config conflicts (C-20) but produces output |
| Tests | Mostly Broken | 10/11 suites fail on import |
