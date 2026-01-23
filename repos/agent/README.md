# @tdsk/agent - Secure WASM AI Coding Agent

A headless AI coding agent backend built with WebAssembly for maximum isolation and security.

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
- **💬 Conversation History**: Resume previous conversations seamlessly
- **🔧 Custom Tools**: Extend with user-supplied code in isolated WASM sandboxes

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

### Basic Usage

```typescript
import { TSAgent } from '@tdsk/agent'

const agent = new TSAgent({
  tempDir: `/tmp/agents`,
  mutex: { maxLocks: 100 },
  exec: { timeout: 10000 }
})

await agent.run({
  projectId: `my-project`,
  prompt: `Create a new React component`,
  onToken: (token) => console.log(token),
  config: {
    model: `gpt-4o`,
    provider: `openai`,
    url: `https://api.openai.com`
    apiKey: process.env.OPENAI_API_KEY,
  },
})
```

### Resuming Conversations

Pass previous conversation messages to continue where you left off:

```typescript
import type { TMessage } from '@tdsk/agent'

// Store your conversation history
const conversation: TMessage[] = [
  { role: `user`, content: `What is the capital of France?` },
  { role: `assistant`, content: `The capital of France is Paris.` }
]

// Resume the conversation with full context
await agent.run({
  projectId: `my-project`,
  // Pass previous messages
  history: conversation,
  prompt: `How many people live there?`,
  onToken: (token) => console.log(token),
  config: {
    model: `gpt-4o`,
    provider: `openai`,
    url: `https://api.openai.com`,
    apiKey: process.env.OPENAI_API_KEY,
  },
})
```

See [Conversation History Documentation](./docs/CONVERSATION_HISTORY.md) for detailed examples and best practices.

### Custom Tools

Extend the agent with your own user-supplied code that runs in isolated WASM sandboxes:

```typescript
import { TSAgent, type TSandboxMetadata } from '@tdsk/agent'

// Define a custom tool
const weatherTool: TSandboxMetadata = {
  name: 'getWeather',
  description: 'Get current weather for a city',
  language: 'javascript',
  code: `
    async function toolFunction(args) {
      const { city } = args;
      // Your custom logic here
      return JSON.stringify({ city, temp: 72, conditions: 'Sunny' });
    }
  `,
  parameters: {
    type: 'object',
    properties: {
      city: { type: 'string', description: 'City name' }
    },
    required: ['city']
  }
}

// Use the custom tool
await agent.run({
  prompt: `What is the weather in San Francisco?`,
  projectId: `my-project`,
  onToken: (token) => console.log(token),
  config: {
    model: `gpt-4o`,
    provider: `openai`,
    url: `https://api.openai.com`,
    apiKey: process.env.OPENAI_API_KEY!,
    tools: {
      custom: [weatherTool] // Register custom tools
    }
  },
})
```

See [Custom Tools Documentation](./docs/CUSTOM_TOOLS.md) for comprehensive guide and examples.

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

See `wit/world.wit` for the WASM Component Model interface definition.
