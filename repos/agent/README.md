# @tdsk/agent - Secure WASM AI Coding Agent

A headless AI coding agent backend built with WebAssembly for maximum isolation and security.

> **Status**: 🚧 Implementation complete - WASM compilation pending
>
> The TypeScript implementation is complete. To enable full WASM functionality, run `pnpm build:wasm` after compiling the main project.

## Architecture

```
Node.js Host (TSAgent)
  ├─ Mutex (Serial execution per projectId)
  ├─ Executor (Secure shell bridge)
  └─ WasmBridge
      └─ WASM Guest (Agent)
          ├─ Context (Token management)
          ├─ Provider (LLM abstraction)
          └─ ReAct Loop (Tool execution)
```

## Features

- **🔒 Isolation**: Fresh WASM instance per request
- **🔐 Security**: Strict command allowlist + blocklist patterns
- **⚡ Concurrency**: Mutex ensures serial execution per project
- **🌐 Provider Agnostic**: OpenAI, Anthropic, Grok, or custom LLMs
- **📁 VFS Mounting**: Safe filesystem access via WASI

## Building

### 1. Compile TypeScript
```bash
pnpm build
```

### 2. Build WASM Component (Full Pipeline)
```bash
pnpm build:wasm
```

This runs three steps:
- Compile TS to JS via tsup
- Componentize JS to WASM via componentize-js
- Transpile WASM to JS bindings via jco

## Usage

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

## Security Model

### Executor Security
- **Allowlist**: Only pre-approved commands (`git`, `ls`, `npm`, etc.)
- **Blocklist**: Regex patterns block directory traversal (`../`), absolute paths (`/`), and shell injection (`|`, `&`, `;`)
- **No Shell**: Commands run without shell expansion
- **Isolated CWD**: Each project runs in its own directory
- **Minimal Env**: Only PATH and HOME exposed

### Mutex Locking
- Prevents concurrent modifications to project files
- Promise-based queue ensures serial execution
- Automatic cleanup on completion

## WIT Interface

See `world.wit` for the WASM Component Model interface definition.

## Development Status

- ✅ Type definitions complete
- ✅ Mutex implementation
- ✅ Executor with security validation
- ✅ Context management
- ✅ LLM provider abstractions (OpenAI, Anthropic, Grok)
- ✅ Agent ReAct loop
- ✅ TSAgent host wrapper
- ✅ Build scripts
- ✅ WIT interface definition
- 🚧 WASM compilation (requires `pnpm build:wasm`)
- 🚧 VFS mounting in WasmBridge (preview2-shim integration)
- 🚧 Web search tool implementation

## File Structure

```
repos/agent/
├── src/
│   ├── agent/           # WASM Guest code
│   │   ├── agent.ts     # Main ReAct loop
│   │   ├── context.ts   # Token management
│   │   └── provider.ts  # LLM providers
│   ├── services/        # Host services
│   │   ├── mutex.ts     # Concurrency control
│   │   ├── executor.ts  # Secure command execution
│   │   └── wasm.ts      # WASM bridge
│   ├── types/           # TypeScript definitions
│   ├── constants/       # Security constants
│   ├── tsagent.ts       # Main export
│   └── index.ts
├── scripts/
│   ├── build.ts         # TS -> WASM build
│   └── transpile.ts     # WASM -> JS bindings
└── world.wit            # WASM interface definition
```

## License

MIT
