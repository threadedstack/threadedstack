---
name: "Threaded Stack - Agent Repo"
description: "Knowledge base for the AI Agent WASM backend repo"
version: "1.1.0"
tags: ["wasm", "nodejs", "ai-agent", "componentize-js", "security", "isolation", "llm-providers", "proxy-adapter"]
---
# Agent Repo Skill

## Overview

The **Agent** repo (`repos/agent`) is a secure, headless AI coding agent backend built with WebAssembly for maximum isolation and security. It provides a Node.js Host that spawns isolated WASM Guest instances to handle AI agent requests with strict security boundaries, concurrent execution control, and provider-agnostic LLM integration.

**Key Characteristics:**
- **Type**: AI Agent Backend (Node.js + WebAssembly)
- **Tech Stack**: TypeScript, WebAssembly Component Model, componentize-js, preview2-shim
- **Architecture**: Host-Guest separation with security layers
- **Security Model**: Fresh WASM instance per request, command allowlist + blocklist
- **LLM Support**: OpenAI, Anthropic, Grok, and custom providers
- **Concurrency**: Mutex-based serial execution per projectId

## Directory Structure

```
repos/agent/
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript config with path mappings
├── README.md                     # User documentation
├── configs/                      # Build & tooling configs
│   ├── agent.config.ts           # TSAgent configuration
│   ├── aliases.ts                # Path aliases (@TAG/*)
│   ├── biome.json                # Biome linter config
│   └── tsup.config.ts            # Main app build (TSAgent export)
│   ├── vitest.config.ts          # Test configuration for vitest
├── scripts/                      # Build pipeline scripts
│   └── wasm/
│       ├── build.ts              # TS → WASM componentization
│       └── deps.ts               # Download WASM module dependencies
├── docs/                         # Documentation
│   └── IMPLEMENTATION.md         # Detailed architecture & implementation guide
├── dist/                         # Build outputs
│   ├── index.cjs                 # Host package
│   ├── agent/agent.js            # Pre-componentized agent
│   ├── sandbox/sandbox.js        # Pre-componentized code sandbox
│   └── wasm/                     # Compiled WASM agent + JS bindings
│       ├── interfaces/           # WASI interface definitions
│       ├── agent.core.wasm       # WASM binary
│       ├── agent.js              # JS bindings with WASI polyfills
│       ├── agent.d.ts            # TypeScript definitions
│       ├── sandbox.core.wasm     # WASM binary
│       ├── sandbox.js            # JS bindings with WASI polyfills
│       └── sandbox.d.ts          # TypeScript definitions
├── src/                          # Application source code
│   ├── constants/                # Security constants
│   │   └── executor.ts           # Command allowlist + blocklist patterns
│   ├── llm/                      # LLM adapter layer
│   │   ├── factory.ts            # createLLMAdapter factory
│   │   ├── anthropic.ts          # Anthropic streaming adapter (18 tests)
│   │   ├── openai.ts             # OpenAI streaming adapter (17 tests)
│   │   ├── google.ts             # Google Gemini streaming adapter (25 tests)
│   │   ├── proxy.ts              # ProxyAdapter — routes LLM calls through backend SSE (7 tests)
│   │   ├── factory.test.ts       # Factory tests (6 tests)
│   │   └── index.ts              # LLM exports
│   ├── runner/                   # Agent execution orchestration
│   │   ├── runner.ts             # AgentRunner — multi-step conversation loop
│   │   └── runner.test.ts        # Runner tests (21 tests)
│   ├── tools/                    # Tool definitions for LLM
│   │   ├── definitions/          # Individual tool schemas
│   │   └── index.ts              # Tool exports
│   ├── services/                 # Host-side services
│   │   ├── mutex.ts              # Promise-based locking (serial execution, 15 tests)
│   │   ├── executor.ts           # Secure shell command execution
│   │   ├── wasm.ts               # WASM instantiation bridge
│   │   └── index.ts              # Service exports
│   ├── index.ts                  # Main export (AgentRunner, ProxyAdapter, etc.)
│   ├── tsagent.ts                # Host wrapper class (14 tests)
│   ├── types/                    # TypeScript type definitions
│   │   ├── agent.types.ts        # LLM providers, messages, config
│   │   ├── runner.types.ts       # TAgentRunOpts, IAgentRunnerDB
│   │   ├── executor.types.ts     # Command execution types
│   │   ├── mutex.types.ts        # Concurrency control types
│   │   ├── wasm.types.ts         # WASM bridge types
│   │   ├── index.types.ts        # Public API types (TSAgent options)
│   │   └── index.ts              # Type exports
│   └── wasm/                     # WASM Guest code (compiled to WASM)
│       ├── agent.ts              # Main ReAct loop entry point
│       ├── context.ts            # Token management ("Middle-Out" truncation)
│       ├── provider.ts           # LLM provider abstractions
│       ├── sandbox.ts            # Sandbox code execution entry point
│       └── tools.ts              # Tool definitions passed to the llm provider
└── wit/
    ├── deps                      # WASM dependencies
    └── world.wit                 # WASM Component Model interface definition
```

## Key Files

### Entry Points

- **`src/index.ts`** - Root export, re-exports TSAgent class
- **`src/tsagent.ts`** - Main Host class with `run()` method (122 lines)
- **`src/agent/agent.ts`** - WASM Guest entry point with `processRequest()` function

### Build Pipeline

- **`scripts/wasm/build.ts`** - TS → WASM componentization via componentize-js (3 steps)
- **`scripts/wasm/transpile.ts`** - WASM → JS transpilation via jco (unused, integrated in build.ts)
- **`world.wit`** - WebAssembly Component Model interface definition

### Services (Host-Side)

- **`src/services/mutex.ts`** - Promise-chaining mutex for serial execution per projectId
- **`src/services/executor.ts`** - Secure shell execution with multi-layer validation
- **`src/services/wasm.ts`** - WASM instantiation, VFS mounting, import object creation (156 lines)

### Agent (Guest-Side)

- **`src/agent/context.ts`** - Token budget management with "Middle-Out" truncation strategy
- **`src/agent/provider.ts`** - LLM provider factory (OpenAI, Anthropic, Grok support)
- **`src/agent/agent.ts`** - ReAct loop: `/run` tool execution, LLM chat, token streaming

### Type Definitions

- **`src/types/agent.types.ts`** - LLM provider interface, message types, config types
- **`src/types/wasm.types.ts`** - WASM bridge imports/exports, instance types
- **`src/types/executor.types.ts`** - Command execution options, security config
- **`src/types/mutex.types.ts`** - Mutex configuration
- **`src/types/index.types.ts`** - Public TSAgent API types

### Security Constants

- **`src/constants/executor.ts`** - Command allowlist (git, npm, etc.) + blocklist regex patterns

### Documentation

- **`README.md`** - User-facing documentation with usage examples
- **`docs/IMPLEMENTATION.md`** - Comprehensive architecture guide (700+ lines)

## Architecture

### Host-Guest Separation

```
Node.js Host (TSAgent)
  ├─ Mutex (Serial execution per projectId)
  ├─ Executor (Secure shell bridge)
  └─ WasmBridge (WASM instantiation + VFS)
      └─ WASM Guest (Agent)
          ├─ Context (Token management)
          ├─ Provider (LLM abstraction)
          └─ ReAct Loop (Tool execution)
```

**Host Responsibilities**:
- Manage concurrency (Mutex locking)
- Provide secure shell access (Executor with allowlist/blocklist)
- Instantiate WASM instances (WasmBridge)
- Mount VFS (project directory → `/data`)
- Inject capabilities (tools, env vars)

**Guest Responsibilities**:
- Process user requests
- Execute ReAct loop (Reasoning + Acting)
- Call LLM providers for responses
- Invoke tools via Host Bridge
- Stream tokens back to Host

### Request Flow

```
User Request (prompt, config, projectId)
    ↓
TSAgent.run()
    ├─ 1. Acquire Mutex Lock (serial execution)
    ├─ 2. Create Project Directory
    ├─ 3. Build WASM Imports (tools, VFS, config)
    ├─ 4. WasmBridge.initialize()
    │      ├─ Load dist/wasm/agent.js
    │      ├─ Create Import Object
    │      │   ├─ local:agent/host-callback → { onToken }
    │      │   ├─ local:agent/tools → { executeShell, webSearch }
    │      │   ├─ wasi:cli/environment → { getEnvironment }
    │      │   └─ wasi:filesystem/preopens → { getDirectories }
    │      └─ Return instance.processRequest()
    ├─ 5. instance.processRequest(prompt)
    │      ├─ Parse Intent (/run, /search, or LLM)
    │      ├─ Execute Tools (via Host Bridge)
    │      ├─ Call LLM Provider (OpenAI/Anthropic/Grok)
    │      └─ Stream Tokens via onToken()
    ├─ 6. WasmBridge.cleanup()
    └─ 7. Release Mutex Lock
```

### Security Layers

**Layer 1: Fresh WASM Instance**
- New instance per request (no state leakage)
- Memory isolation via WASM sandbox
- Automatic cleanup after execution

**Layer 2: Controlled Host Bridge**
- Guest can only call approved functions:
  - `executeShell(cmd, args)` → Validated shell execution
  - `webSearch(query)` → Web search (not yet implemented)
  - `onToken(token)` → Token streaming to Host
- No direct filesystem, network, or process access

**Layer 3: Command Validation (Executor)**
- **Allowlist**: Only pre-approved commands (`git`, `ls`, `npm`, `pnpm`, `node`, `python3`, etc.)
- **Blocklist**: Regex patterns block dangerous arguments:
  - `../` - Directory traversal
  - `^/` - Absolute paths
  - `|`, `&`, `;`, `$`, `` ` `` - Shell operators
  - `>`, `<`, `>>` - Redirects
- **No Shell**: Commands run without shell expansion
- **CWD Isolation**: Locked to project directory
- **Minimal Env**: Only PATH and HOME exposed

**Layer 4: VFS Mounting**
- Project directory mounted as `/data` in WASM guest
- No access to Host filesystem outside mount
- Automatic cleanup on instance disposal

**Layer 5: Mutex Locking**
- Prevents concurrent modifications per projectId
- Serial execution ensures no race conditions
- Automatic queue management

## Component Details

### 1. TSAgent (Host Entry Point)

**File**: `src/tsagent.ts` (122 lines)

**Purpose**: Main API exported from package

**Constructor Options**:
```typescript
type TTSAgentOpts = {
  tempDir?: string         // Temp directory for project files (default: os.tmpdir())
  mutex?: TMutexOpts       // Mutex configuration
  exec?: TExecutorOpts     // Executor configuration
  bridge?: TWasmBridgeOpts // WASM bridge configuration
}
```

**Main Method**: `run(opts: TInitOpts): Promise<void>`

**Parameters**:
```typescript
type TInitOpts = {
  prompt: string                        // User request
  config: TAgentConfig                  // LLM provider config
  projectId: string                     // Unique project identifier
  onTokenCallback: (token: string) => void // Token streaming callback
}

type TAgentConfig = {
  provider: 'openai' | 'anthropic' | 'grok' | 'gemini' | 'zai'
  apiKey: string
  model: string
  url: string
  path?: string           // API endpoint path
  maxTokens?: number      // Context window size
}
```

**Usage Example**:
```typescript
import { TSAgent } from '@tdsk/agent'

const agent = new TSAgent({
  tempDir: '/tmp/agents',
  mutex: { maxLocks: 100 },
  exec: { timeout: 10000 }
})

await agent.run({
  prompt: 'Create a new React component',
  projectId: 'my-project',
  config: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o',
    url: 'https://api.openai.com'
  },
  onTokenCallback: (token) => console.log(token)
})
```

### 2. WasmBridge (WASM Instantiation)

**File**: `src/services/wasm.ts` (156 lines)

**Purpose**: Bridge between Node.js Host and WASM Guest

**Key Methods**:

#### `initialize(imports: TWasmImports): Promise<TWasmInstance>`

Creates fresh WASM instance with:

1. **VFS Mount Points** - Tracks mount configuration (actual mounting via WASI runtime)
2. **Import Object** - Structures imports matching compiled WASM expectations
3. **Dynamic Import** - Loads compiled WASM agent from `dist/wasm/agent.js`
4. **Return Instance** - Provides `processRequest()` function wrapper

**Import Structure**:
```typescript
type TWasmImports = {
  onToken: (token: string) => void                   // Token streaming callback
  executeShell: (cmd: string, args: string[]) => string // Shell execution
  webSearch: (query: string) => string               // Web search (TODO)
  vfsMounts?: Record<string, string>                 // guestPath -> hostPath
  config?: Record<string, string | number>           // Environment variables
}
```

#### `cleanup(): Promise<void>`

Clears mount points and nullifies instance reference.

#### `processRequest(prompt: string): Promise<void>`

Direct wrapper for WASM `processRequest()` function with validation.

### 3. Executor (Secure Shell Execution)

**File**: `src/services/executor.ts`

**Purpose**: Multi-layer shell command validation and execution

**Configuration**:
```typescript
type TExecutorOpts = {
  timeout?: number                // Command timeout (default: 30000ms)
  allowedCommands?: Set<string>   // Command allowlist
  blockedPatterns?: RegExp[]      // Argument blocklist patterns
}
```

**Default Allowlist**:
```typescript
['git', 'ls', 'cat', 'mkdir', 'touch', 'rm', 'mv', 'cp',
 'npm', 'pnpm', 'node', 'python3', 'pip3', 'grep', 'find']
```

**Default Blocklist Patterns**:
```typescript
[
  /\.\.\//,         // Directory traversal
  /^\//,            // Absolute paths
  /[|&;$`]/,        // Shell operators
  /[><]/,           // Redirects
]
```

**Execution Method**: `exec(cmd: string, args: string[], projectDir: string): Promise<string>`

**Security Checks**:
1. Command must be in allowlist
2. Arguments must not match blocklist patterns
3. Shell expansion disabled (`shell: false`)
4. CWD locked to `projectDir`
5. Minimal environment (PATH, HOME only)

### 4. Mutex (Concurrency Control)

**File**: `src/services/mutex.ts`

**Purpose**: Promise-based locking for serial execution per projectId

**Implementation**:
```typescript
class Mutex {
  private locks = new Map<string, Promise<void>>()

  acquire = async (projectId: string): Promise<() => void> => {
    const currentLock = this.locks.get(projectId) || Promise.resolve()
    const newLock = currentLock.then(() =>
      new Promise<void>(resolve => releaseLock = resolve)
    )
    this.locks.set(projectId, newLock)
    await currentLock // Wait for turn
    return releaseLock
  }
}
```

**Usage**:
```typescript
const releaseLock = await mutex.acquire(projectId)
try {
  // Critical section - serial execution guaranteed
} finally {
  releaseLock() // Always release
}
```

### 5. Context (Token Management)

**File**: `src/agent/context.ts`

**Purpose**: Token budget management with "Middle-Out" truncation

**Strategy**: Keep system prompt + recent messages, drop middle when over budget

**Implementation**:
```typescript
class Context {
  constructor(max: number = 100000) // Token budget

  compose(sys: string, history: TMessage[]): { system: string, messages: TMessage[] } {
    let budget = this.max - estimateTokens(sys)
    const keep: TMessage[] = []

    // Start from most recent, work backwards
    for (let i = history.length - 1; i >= 0; i--) {
      const len = estimateTokens(history[i])
      if (budget - len < 0) break
      budget -= len
      keep.unshift(history[i])
    }

    return { system: sys, messages: keep }
  }
}
```

### 6. Provider (LLM Abstraction)

**File**: `src/agent/provider.ts`

**Purpose**: Factory pattern for multiple LLM APIs

**Interface**:
```typescript
interface ILLMProvider {
  key: string
  url: string
  model: string
  path?: string
  type: 'openai' | 'anthropic' | 'grok' | 'gemini' | 'zai'

  complete(system: string, user: string): Promise<string>
}
```

**Implementations**:

1. **OpenAI** (and compatible APIs like Grok, Gemini)
```typescript
async complete(system: string, user: string): Promise<string> {
  const response = await fetch(`${this.url}${this.path}`, {
    headers: { Authorization: `Bearer ${this.key}` },
    body: JSON.stringify({
      model: this.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  })
  return response.json().choices[0].message.content
}
```

2. **Anthropic** (different API format)
```typescript
async complete(system: string, user: string): Promise<string> {
  const response = await fetch(`${this.url}${this.path}`, {
    headers: { 'x-api-key': this.key },
    body: JSON.stringify({
      system,
      max_tokens: 4096,
      model: this.model,
      messages: [{ role: 'user', content: user }]
    })
  })
  return response.json().content[0].text
}
```

**Factory**:
```typescript
export const getProvider = (opts: TLLMBaseOpts): ILLMProvider => {
  switch (opts.type) {
    case 'openai': return new OpenAI(opts)
    case 'anthropic': return new Anthropic(opts)
    case 'grok': return new Grok(opts)
    default: throw new Error(`Unknown provider: ${opts.type}`)
  }
}
```

### 7. Agent (ReAct Loop)

**File**: `src/agent/agent.ts`

**Purpose**: WASM guest entry point with tool execution and LLM chat

**Main Export**: `processRequest(prompt: string): void`

**Flow**:

1. **Tool Commands** - Direct tool invocation
```typescript
if (prompt.startsWith('/run ')) {
  const [cmd, ...args] = prompt.slice(5).split(' ')
  onToken(`[Tool] Running ${cmd}...\n`)
  const output = executeShell(cmd, args)
  onToken(`[Output]\n${output}\n`)
  return
}
```

2. **Web Search** - Placeholder
```typescript
if (prompt.startsWith('/search ')) {
  const query = prompt.slice(8).trim()
  const results = webSearch(query)
  onToken(`[Results]\n${results}\n`)
  return
}
```

3. **LLM Chat** - Standard conversation
```typescript
const provider = getProvider({
  url: process.env.AGENT_URL,
  key: process.env.AGENT_API_KEY,
  type: process.env.AGENT_PROVIDER as TLLMProvider,
  model: process.env.AGENT_MODEL
})

history.push({ role: 'user', content: prompt })
const { system, messages } = ctx.compose(systemPrompt, history)
const response = await provider.complete(system, userMessage)
onToken(response)
history.push({ role: 'assistant', content: response })
```

## Build Pipeline

### 3-Step Compilation Process

**Step 1: Compile TypeScript** (`pnpm build:app`)
```bash
tsup-node --config configs/tsup.config.ts
# Output: dist/index.cjs (11.45 KB)
```

**Step 2: Compile Agent Code** (`pnpm build:agent`)
```bash
tsup-node --config configs/tsup.agent.config.ts
# Output: dist/agent/agent.js (6.75 KB)
```

**Step 3: Componentize to WASM** (`pnpm build:wasm`)
```typescript
// scripts/wasm/build.ts
const { component } = await componentize(agentJs, {
  witPath: join(rootDir, 'world.wit'),
  worldName: 'agent-service',
  disableFeatures: []
})

const { files } = await jco.transpile(component, {
  name: 'agent',
  map: { 'wasi:*': '@bytecodealliance/preview2-shim/*' },
  optimize: true
})
```

**Outputs**:
- `dist/wasm/agent.core.wasm` - Core WASM binary (13.5 MiB)
- `dist/wasm/agent.js` - JS bindings with WASI polyfills (702 KB)
- `dist/wasm/agent.d.ts` - TypeScript definitions
- `dist/wasm/interfaces/` - 36 WASI interface definition files

### WIT Interface Definition

**File**: `world.wit`

```wit
package local:agent;

interface tools {
  execute-shell: func(command: string, args: list<string>) -> result<string, string>;
  web-search: func(query: string) -> string;
}

interface imports {
  on-token: func(token: string);
}

world agent-service {
  include wasi:http/imports@0.2.0;
  include wasi:filesystem/imports@0.2.0;
  include wasi:cli/imports@0.2.0;
  import tools;
  import imports;
  export process-request: func(prompt: string);
}
```

## Logic Flow

### Typical Request Execution

```
1. User calls agent.run({ prompt, config, projectId, onTokenCallback })
2. Mutex.acquire(projectId) → Wait for turn in queue
3. fs.mkdir(projectDir) → Ensure project directory exists
4. WasmBridge.initialize(imports)
   a. Store VFS mount points ({ '/data': projectDir })
   b. Build import object:
      - local:agent/host-callback → { onToken: callback }
      - local:agent/tools → { executeShell: executor.exec, webSearch: stub }
      - wasi:cli/environment → { getEnvironment: () => config as env vars }
      - wasi:filesystem/preopens → { getDirectories: () => mount points }
   c. Dynamic import: const wasmModule = await import('dist/wasm/agent.js')
   d. Return { processRequest: wasmModule.processRequest, exports: wasmModule }
5. instance.processRequest(prompt)
   a. Parse intent: /run, /search, or LLM chat
   b. If /run: Call executeShell(cmd, args) via Host Bridge
      - Executor validates command (allowlist + blocklist)
      - Executor runs spawnSync() with locked CWD
      - Return stdout/stderr to WASM
   c. If LLM: Call provider.complete(system, user)
      - Create provider from env vars (OpenAI/Anthropic/Grok)
      - Compose context (token truncation)
      - Fetch LLM API
      - Stream tokens via onToken()
6. WasmBridge.cleanup() → Clear mount points, nullify instance
7. Mutex release → Allow next request for this projectId
```

### Error Handling Flow

```
1. Error occurs in WASM guest or Host Bridge
2. Caught by try-catch in TSAgent.run()
3. Error message sent via onTokenCallback(`[Error] ${message}`)
4. Error re-thrown to caller
5. Finally block ensures mutex release (critical!)
```

## Key Patterns

### 1. Host-Guest Isolation

**Principle**: Guest has no direct access to Host resources

**Implementation**:
- Guest only has imports provided by Host Bridge
- All filesystem/network/process access mediated by Host
- Fresh instance per request (no shared state)

### 2. Promise-Chaining Mutex

**Principle**: Serial execution without blocking Node.js event loop

**Implementation**:
```typescript
const currentLock = this.locks.get(projectId) || Promise.resolve()
const newLock = currentLock.then(() => new Promise(resolve => releaseLock = resolve))
this.locks.set(projectId, newLock)
await currentLock // Wait for turn
```

### 3. Multi-Layer Security

**Principle**: Defense in depth with multiple validation layers

**Layers**:
1. WASM sandbox (memory isolation)
2. Host Bridge (controlled API)
3. Command allowlist (only approved commands)
4. Argument blocklist (pattern-based blocking)
5. Mutex locking (prevent race conditions)

### 4. Factory Pattern for Providers

**Principle**: Single interface, multiple implementations

**Implementation**:
```typescript
const provider = getProvider({ type: 'openai', ... })
const response = await provider.complete(system, user)
```

### 5. Token Streaming

**Principle**: Real-time feedback to user during LLM generation

**Implementation**:
```typescript
onToken('[Agent] Processing request...\n')
const response = await provider.complete(system, user)
onToken(response) // Stream full response
```

### 6. Configuration-Driven Build

**Principle**: Declarative build pipeline configuration

**Implementation**:
- `tsup.config.ts` - Host package build
- `tsup.agent.config.ts` - Guest code build
- `world.wit` - WASM interface definition
- `scripts/wasm/build.ts` - Componentization script

## Dependencies

### Core Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `@bytecodealliance/componentize-js` | TS → WASM componentization | 0.12.1 |
| `@bytecodealliance/jco` | WASM → JS transpilation | 1.7.3 |
| `@bytecodealliance/preview2-shim` | WASI polyfills | 0.21.0 |

### Build Tools

- `tsup@8.3.11` - TypeScript bundler
- `typescript@5.7.3` - Type checking
- `tsx@4.19.2` - TS execution for build scripts

### Development Tools

- `@biomejs/biome@1.9.4` - Linting/formatting
- `vitest@2.1.8` - Testing framework

### Workspace Dependencies

- `@tdsk/domain` - Shared types (not actively used yet)

## Commands

### Development

```bash
pnpm start           # Build and run (tsup watch mode)
```

### Building

```bash
pnpm build           # Full 3-step build pipeline
                     # 1. build:app (tsup Host)
                     # 2. build:agent (tsup Guest)
                     # 3. build:wasm (componentize + transpile)

pnpm build:app       # Build Host package only
pnpm build:agent     # Build Guest code only
pnpm build:wasm      # Componentize + transpile only
```

### Testing

```bash
pnpm test            # Run vitest tests — 150 tests, 11 files
```

### Maintenance

```bash
pnpm clean           # Remove node_modules
```

### Commands Notes

* Linting and formatting are automatically, so `pnpm lint` and `pnpm format` commands should be ignored.

## Integration Points

### 1. LLM Provider APIs

**OpenAI Compatible** (OpenAI, Grok, Gemini, custom):
- Endpoint: `POST ${url}${path}` (e.g., `https://api.openai.com/v1/chat/completions`)
- Auth: `Authorization: Bearer ${apiKey}`
- Format: ChatGPT API format

**Anthropic**:
- Endpoint: `POST ${url}${path}` (e.g., `https://api.anthropic.com/v1/messages`)
- Auth: `x-api-key: ${apiKey}`
- Format: Claude API format (separate system parameter)

### 2. Host Filesystem

**VFS Mounting**:
- Host creates project directory at `${tempDir}/${projectId}`
- Mounted as `/data` in WASM guest
- Guest sees only its own project files
- Automatic cleanup after execution

### 3. Shell Commands

**Executor Interface**:
- Guest calls `executeShell(cmd, args)`
- Host validates and executes via `spawnSync()`
- Results returned as string (stdout/stderr)
- Errors thrown on validation failure

### 4. WASM Runtime

**WASI Integration**:
- Uses `@bytecodealliance/preview2-shim` for WASI polyfills
- Imports include:
  - `wasi:http/imports@0.2.0` - HTTP client
  - `wasi:filesystem/imports@0.2.0` - Filesystem access
  - `wasi:cli/imports@0.2.0` - CLI environment
- Polyfills provide Node.js-compatible implementations

## Path Aliases

**Configured in**: `tsconfig.json` + `configs/aliases.ts`

```typescript
@TAG/*  → repos/agent/src/*      # Agent internal imports
```

**Example Usage**:
```typescript
import { Mutex } from '@TAG/services/mutex'
import type { TInitOpts } from '@TAG/types'
```

## Environment Variables

**WASM Guest Environment** (injected via `getEnvironment()`):

| Variable | Purpose |
|----------|---------|
| `AGENT_URL` | LLM API base URL |
| `AGENT_PATH` | LLM API endpoint path |
| `AGENT_MODEL` | LLM model name |
| `AGENT_API_KEY` | LLM API key |
| `AGENT_PROVIDER` | Provider type (openai/anthropic/grok) |
| `AGENT_MAX_TOKENS` | Context window size |

## Development Guidelines

### 1. Adding a New Tool

```typescript
// 1. Define WIT interface
// world.wit
interface tools {
  execute-shell: func(...) -> result<string, string>;
  web-search: func(...) -> string;
  my-new-tool: func(...) -> string;  // Add here
}

// 2. Implement Host Bridge
// src/tsagent.ts - in run() method
const wasmImports = {
  ...
  myNewTool: (param: string) => {
    // Implementation
    return result
  }
}

// 3. Use in Agent
// src/agent/agent.ts
import { myNewTool } from 'local:agent/tools'

if (prompt.startsWith('/mytool ')) {
  const result = myNewTool(prompt.slice(8))
  onToken(result)
}
```

### 2. Adding a New LLM Provider

```typescript
// 1. Add to type union
// src/types/agent.types.ts
export type TLLMProvider = 'openai'|'anthropic'|'grok'|'myProvider'

// 2. Create provider class
// src/agent/provider.ts
class MyProvider extends BaseProvider {
  constructor(opts: TLLMProviderOpts) {
    super({ ...opts, type: 'myProvider', url: 'https://api.myprovider.com' })
  }

  async complete(system: string, user: string): Promise<string> {
    // Custom API format
  }
}

// 3. Add to factory
export const getProvider = (opts: TLLMBaseOpts): ILLMProvider => {
  switch (opts.type) {
    case 'myProvider': return new MyProvider(opts)
    // ... existing
  }
}
```

### 3. Modifying Security Rules

```typescript
// Executor allowlist/blocklist
// src/constants/executor.ts

// Add allowed command
export const defAllowedCommands = new Set([
  'git', 'npm', 'my-safe-command'  // Add here
])

// Add blocked pattern
export const defBlockedPatterns = [
  /\.\.\//,    // Existing patterns
  /my-regex/   // New pattern
]
```

### 4. Debugging WASM Issues

```bash
# 1. Check WASM build output
pnpm build:wasm

# 2. Inspect compiled JS bindings
cat dist/wasm/agent.js | head -n 100

# 3. Enable logging in WasmBridge
const agent = new TSAgent({
  bridge: { enableLogging: true }
})

# 4. Check import object structure
console.log('[WasmBridge] Import object:', wasmImports)
```

## Common Issues & Solutions

### 1. WASM Module Not Found

**Problem**: `Error: Cannot find module 'dist/wasm/agent.js'`

**Solution**:
- Run `pnpm build:wasm` to compile WASM agent
- Verify `dist/wasm/agent.js` exists
- Check WasmBridge `wasmPath` configuration

### 2. Command Denied by Executor

**Problem**: `SECURITY: Command 'xyz' denied. Not in allowlist.`

**Solution**:
- Add command to `defAllowedCommands` in `src/constants/executor.ts`
- Or override via `new TSAgent({ exec: { allowedCommands: new Set(['xyz']) } })`

### 3. Argument Blocked by Pattern

**Problem**: `SECURITY: Arg '../file' matches blocked pattern`

**Solution**:
- Use relative paths within project directory
- Avoid `../`, absolute paths, shell operators
- Override blocklist if needed (not recommended)

### 4. Mutex Deadlock

**Problem**: Request hangs indefinitely

**Solution**:
- Ensure mutex is always released in `finally` block
- Check for thrown errors before release
- Verify `projectId` is consistent

### 5. Token Truncation Too Aggressive

**Problem**: Context always truncated, losing important messages

**Solution**:
- Increase `maxTokens` in config
- Adjust `Context` budget in `src/agent/context.ts`
- Use more concise system prompts

## Best Practices

1. **Always release mutex** - Use `finally` block to guarantee release
2. **Validate input** - Never trust user input for commands
3. **Fresh instances** - Don't reuse WASM instances across requests
4. **Stream tokens** - Provide real-time feedback via `onToken()`
5. **Error messages** - Send errors via `onToken()` for user visibility
6. **Security first** - Add to blocklist before adding to allowlist
7. **Test builds** - Run `pnpm build` after changes to verify compilation
8. **Document WIT** - Keep `world.wit` in sync with actual interface
9. **Type safety** - Leverage TypeScript for Host Bridge interfaces
10. **Isolate projects** - Use unique `projectId` per isolated workspace

## Future Enhancements

### Short-Term

- [ ] Implement web search tool via MCP or external API
- [ ] Support streaming LLM responses (SSE)
- [ ] Add retry logic for failed LLM calls
- [ ] Better error recovery and user feedback

### Medium-Term

- [ ] Multi-turn conversation persistence
- [ ] Tool result parsing and structured outputs
- [ ] Rate limiting per project/user
- [ ] Telemetry and observability

### Long-Term

- [ ] Multi-agent coordination (spawn sub-agents)
- [ ] Git integration (auto-commit, branch management)
- [ ] Browser automation via WASM Puppeteer
- [ ] Plugin system for custom tools

---

**Last Updated**: 2026-02-14
**Version**: 1.1.0
**Maintainer**: ThreadedStack Team

## Changelog

### v1.1.0 (2026-02-14)
- **New**: `ProxyAdapter` — ILLMAdapter that routes LLM calls through backend SSE proxy (7 tests)
- **New**: `AgentRunner` — Multi-step conversation loop with streaming, tool execution, mutex locking (21 tests)
- **New**: LLM adapter layer with factory pattern: Anthropic (18), OpenAI (17), Google (25), factory (6) tests
- **New**: Tool definitions for shell, file ops, directory ops (21 tests)
- **New**: Optional `adapter` parameter in `TAgentRunOpts` — allows injecting ProxyAdapter (or any ILLMAdapter)
- **New**: `IAgentRunnerDB` interface for pluggable message persistence (HTTP or direct DB)
- **Testing**: 150/150 tests passing across 11 test files

### v1.0.0 (2026-01-22)
- **Initial Release**: Complete WASM AI agent implementation
- **New**: TSAgent Host wrapper with mutex-protected execution
- **New**: WasmBridge with VFS mounting and import object creation
- **New**: Executor with multi-layer security validation
- **New**: Context with "Middle-Out" token truncation
- **New**: Provider abstraction (OpenAI, Anthropic, Grok support)
- **New**: Agent ReAct loop with tool execution and LLM chat
- **New**: 3-step build pipeline (TS → WASM → JS bindings)
- **New**: Comprehensive documentation (README + IMPLEMENTATION.md)
- **Security**: Command allowlist + blocklist patterns
- **Security**: Fresh WASM instance per request
- **Security**: VFS isolation per projectId
