# REPL Production Design: Concept to Product

**Date**: 2026-02-17
**Status**: Approved
**Scope**: Full vision — complete rewrite of `repos/repl` from concept to production-grade terminal agent interface

---

## 1. Problem Statement

The REPL (`@tdsk/repl`) is a terminal-based interface for interacting with pre-configured ThreadedStack AI agents. Its current state is functional but rough — a working concept, not a product.

**Target users**: Non-technical end users who find tools like Claude Code intimidating but want to leverage AI agents for specific tasks. These users need hand-holding, friendly errors, and a simple interface. They don't understand providers, models, tokens, or sessions — they just want to talk to their agent.

**How agents work**: Admins configure agents in the admin dashboard (`repos/admin`), assigning them to projects with specific tools, custom functions, secrets, and providers. Users log in with an API key and interact with whichever agents are available to their org/project.

**Key requirements**:
- Polished, friendly UX for non-technical users
- Multi-provider support with per-message switching
- Tool execution transparency without technical overwhelm
- Auto-detection and manual loading of local context files
- Configurable lifecycle hooks
- Production-grade error handling and resilience

---

## 2. Architectural Approach

### Decision: Ink (React) Rewrite

Replace the raw readline-based REPL with React + Ink components. This is the same foundational approach used by Claude Code.

**Why**:
- Declarative UI makes complex states (streaming + tool calls + spinner + prompt) manageable
- Component reuse — spinner, markdown viewer, prompt, tool activity become composable
- Proven at scale by Claude Code for AI CLI interfaces
- The existing codebase is small (~2,300 LOC source) — rewrite is lower risk than incremental patching
- Bundle size is irrelevant — the Bun-compiled binary is already 67MB

**What's kept**: The task-based CLI dispatch layer (`@keg-hub/args-parse`), `ApiClient`, `AuthManager` (refactored), `LocalAgentExecutor` (refactored), `HttpMessageAdapter`, and the compile script all survive. The outer CLI commands (`login`, `logout`, `status`, `agents`, `threads`, `chat`, `help`) remain the same — the `chat` command now renders an Ink `<App />` instead of entering a readline loop.

---

## 3. User Experience

### 3.1 Mental Model

The REPL is a friendly terminal chatbot. Think iMessage in the terminal. Users don't need to understand providers, models, tokens, or tools — they talk, the agent responds, and tool execution is shown as simple activity summaries.

### 3.2 First-Run Experience

```
$ tdsk-agent login
┌─────────────────────────────────────────────────┐
│                                                 │
│  Welcome to ThreadedStack Agent                 │
│                                                 │
│  Enter your API key to get started.             │
│  (Your admin should have provided this to you)  │
│                                                 │
│  API Key: tdsk_••••••••••••                     │
│                                                 │
│  ✓ Connected to ThreadedStack                   │
│  ✓ Found 3 agents available to you              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 3.3 Daily Use Flow

```
$ tdsk-agent

  Welcome back! You have 3 agents available.

  1. Research Assistant — Finds and summarizes information
  2. Code Helper — Helps write and review code
  3. Data Analyst — Analyzes spreadsheets and data

  Select an agent (1-3): 2

  ┌─────────────────────────────────────────────┐
  │                                             │
  │  Code Helper                                │
  │  Helps write and review code                │
  │                                             │
  │  Tools: file access, shell commands         │
  │  Provider: Anthropic (claude-sonnet)        │
  │                                             │
  │  Resuming thread: "API refactor discussion" │
  │  Type /help for commands, /new to start     │
  │  fresh.                                     │
  │                                             │
  └─────────────────────────────────────────────┘

  > Can you help me understand this error message?

  ⠙ Thinking...

  Sure! Paste the error message and I'll break it down for you.
```

### 3.4 Tool Execution Display

When an agent uses tools, activity is shown as a compact summary — not raw JSON:

```
  > Can you check what's in the reports folder?

  ⠙ Looking at the reports folder...

  ── Agent is working ─────────────────────────
  ✓ Listed directory: /reports (12 files)
  ✓ Read file: quarterly-summary.csv
  ──────────────────────────────────────────────

  I found 12 files in the reports folder. Here's a summary:

  • quarterly-summary.csv — Q4 2025 revenue data
  • budget-2026.xlsx — Annual budget projections
  • ...
```

Principles:
- Human-readable tool descriptions — "Listed directory: /reports" not `{"name":"listDir","args":{"path":"/reports"}}`
- Collapsed by default — tool activity is a compact summary block
- Expandable via `/verbose` — power users can see full tool call details
- Errors are gentle — "The agent ran into a problem while working. It will try a different approach."

### 3.5 Provider Switching (Per-Message)

Agents can have multiple providers. Users switch between them at any time:

```
  > /provider

  Available providers for Code Helper:
  1. Anthropic (claude-sonnet) ← current
  2. OpenAI (gpt-4o)
  3. Internal LLM (custom-v2)

  Select a provider (1-3): 3

  ✓ Now using: Internal LLM (custom-v2)
```

Provider switching is per-message — the selected `providerId` is passed with each request. No session regeneration needed. The backend resolves the correct API key server-side. The status bar always shows the current provider.

### 3.6 Context Loading

The REPL auto-detects and loads context files from the user's current directory:

```
  ── Code Helper · Anthropic · "API discussion" ──
  Loaded context from current directory:
  • AGENTS.md (project instructions)
  • .tdsk/config.yaml (project settings)
  • 3 files from .tdsk/context/

  Type /context to see loaded files, /add <file> to add more.
```

Auto-detection scans for:
- `.tdsk/` directory (project-level REPL config)
- `AGENTS.md` (agent instructions file)
- `.tdsk/context/` directory (files auto-included in agent context)
- `.tdsk/hooks/` directory (lifecycle hook scripts)
- `.tdsk/config.yaml` (project-level configuration)

Users can manually add/remove context:
- `/add <path>` — add a file to agent context
- `/remove <n>` — remove a context file by number
- `/context` — list all loaded context files

### 3.7 UX Principles

1. **No jargon** — Never show "provider", "model", "tokens", "SSE", "session" in normal mode. Users see agent names, conversation threads, and responses.
2. **Numbered selections** — Users pick items by number, not by typing IDs.
3. **Auto-resume** — Remembers last agent and thread, offers to continue where they left off.
4. **Friendly errors** — "We couldn't reach the server. Check your internet connection and try again." not "ECONNREFUSED".
5. **Progressive disclosure** — Basic users see the chat. Power users discover slash commands. Admins configure hooks and context.

---

## 4. Configuration System

### 4.1 Config Hierarchy

Configuration loads in layers (later overrides earlier), matching the `@keg-hub/parse-config` pattern used across ThreadedStack:

```
1. Built-in defaults                          (hardcoded sensible defaults)
2. ~/.config/tdsk/repl/config.yaml            (user global config)
3. .tdsk/config.yaml                          (project-level config)
4. Environment variables (TDSK_*)             (env overrides)
5. CLI flags (--org, --agent, etc.)           (per-invocation overrides)
```

### 4.2 User Global Config (`~/.config/tdsk/repl/config.yaml`)

```yaml
# Authentication
auth:
  apiKey: tdsk_sk_live_abc123...
  proxyUrl: https://px.local.threadedstack.app
  insecure: false

# Defaults
org: org_abc123
agent: agent_xyz789

# Display
theme: dark          # dark | light | auto
verbose: false       # show full tool call details
markdown: true       # render markdown in responses
timestamps: false    # show timestamps on messages

# Behavior
autoResume: true     # resume last thread on startup
maxHistory: 50       # messages to load when resuming
confirmTools: false  # prompt before tool execution (safety mode)

# Sandbox
sandbox:
  provider: local    # local | e2b
  timeout: 300000    # 5 minutes
  envVars:
    NODE_ENV: development
```

File permissions enforced at `0o600` (contains API key). Config directory `~/.config/tdsk/repl/` at `0o700`.

### 4.3 Project Config (`.tdsk/config.yaml`)

```yaml
# Project-specific agent settings
agent: agent_project_default
org: org_myteam

# Context files to auto-load
context:
  - AGENTS.md
  - docs/runbook.md
  - .tdsk/context/*.md

# Hooks (shell commands run at lifecycle events)
hooks:
  onSessionStart: "echo 'Agent session started' >> .tdsk/logs/sessions.log"
  onToolCall: null
  onError: "notify-send 'Agent error'"
  onSessionEnd: null

# Tool permissions (override agent defaults for this project)
tools:
  confirm:
    - shellExec          # always confirm before shell execution
    - deleteFile         # always confirm before file deletion
  block:
    - webSearch          # disable web search in this project
```

### 4.4 Context Directory (`.tdsk/context/`)

Files placed here are automatically included in the agent's context window:

```
.tdsk/
├── config.yaml           # project config
├── context/              # auto-loaded context files
│   ├── architecture.md   # project architecture docs
│   ├── api-reference.md  # API docs the agent should know
│   └── guidelines.md     # coding/process guidelines
└── hooks/                # lifecycle hook scripts
    ├── on-session-start.sh
    └── on-error.sh
```

---

## 5. Component Architecture

### 5.1 Component Tree

```
<App>                                    # Root — state management, routing
├── <LoginFlow />                        # First-run: API key entry + validation
├── <AgentPicker />                      # Agent selection (numbered list)
│   └── <SelectPrompt />                 # Numbered selector
├── <ChatSession>                        # Main chat interface
│   ├── <StatusBar />                    # Top: agent · provider · thread · connection
│   ├── <MessageList />                  # Scrollable message history
│   │   ├── <UserMessage />             # User input (dimmed, prefixed)
│   │   ├── <AssistantMessage />        # Markdown-rendered response
│   │   └── <ToolActivity />            # Collapsed tool execution summary
│   │       ├── <ToolSuccess />         # ✓ Tool name + summary
│   │       └── <ToolError />           # ✗ Tool name + friendly error
│   ├── <StreamingResponse />           # Active response being streamed
│   │   ├── <Spinner />                 # ⠙ Thinking... / Working...
│   │   ├── <MarkdownRenderer />        # Incremental markdown rendering
│   │   └── <ToolActivity />            # Live tool calls
│   └── <Prompt />                      # Bottom: input line with history
└── <ErrorBoundary />                    # Graceful crash recovery
```

### 5.2 State Management

React hooks + context (no external state library):

```
AppContext
├── auth: { apiKey, proxyUrl, isLoggedIn }
├── config: { merged global + project config }
├── connection: { status: connected | disconnected | reconnecting }

SessionContext
├── orgId, agentId, threadId
├── agent: { name, description, tools, functions }
├── provider: { id, name, model }
├── messages: Message[]
├── isStreaming: boolean
├── streamBuffer: { text, toolCalls, events }
└── context: { loadedFiles, autoDetected }
```

### 5.3 Key Components

**`<Prompt />`** — The input component:
- Text input with cursor
- Up/down arrow for input history (persisted to `~/.config/tdsk/repl/history`)
- Slash command detection and tab-completion
- Disabled state while agent is responding
- Multi-line input via `\` continuation

**`<StreamingResponse />`** — Active response area:
- Spinner while waiting for first token
- Incremental markdown rendering via `marked-terminal`
- Tool call activity blocks appearing inline
- Smooth transition from streaming to completed message

**`<ToolActivity />`** — Tool execution visualization:
- Compact mode (default): `✓ Read file: /reports/summary.csv`
- Verbose mode: full tool call args + result
- Error mode: `✗ Shell command failed: permission denied`
- Animated spinner while tool is executing

**`<AgentPicker />`** — Agent selection on startup:
- Numbered list with name + description
- Auto-selects if only one agent
- Remembers last selection (via config `agent` field)
- Skipped entirely if `--agent` flag or config default is set

**`<StatusBar />`** — Persistent top-of-chat info:
```
── Research Assistant · Anthropic (claude-sonnet) · "Q4 Analysis" · ● ──
```
- Agent name, provider name + model, thread name, connection indicator
- `●` green (connected), `●` yellow (reconnecting), `●` red (disconnected)

### 5.4 Slash Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `/help` | `/h` | Show available commands |
| `/new` | `/n` | Start a new conversation thread |
| `/threads` | `/t` | List recent threads |
| `/switch <n>` | `/s` | Switch to thread by number |
| `/history` | — | Show current thread's message history |
| `/agent` | `/a` | Switch to a different agent |
| `/provider` | `/p` | List and switch between available providers |
| `/info` | `/i` | Show session info (agent, thread, org, provider) |
| `/context` | `/ctx` | List loaded context files |
| `/add <path>` | — | Add a file to agent context |
| `/remove <n>` | `/rm` | Remove a context file by number |
| `/verbose` | `/v` | Toggle verbose tool output |
| `/clear` | `/c` | Clear the screen |
| `/exit` | `/quit`, `/q` | Exit the REPL |

### 5.5 Lifecycle Hooks

Shell commands defined in `.tdsk/config.yaml` that run at specific lifecycle points:

| Hook | When | Use Case |
|------|------|----------|
| `onSessionStart` | REPL connects and selects agent | Logging, notifications |
| `onSessionEnd` | REPL exits | Cleanup, logging |
| `onToolCall` | Before a tool executes | Audit logging, approval gates |
| `onToolResult` | After a tool completes | Result processing |
| `onError` | Any error occurs | Alerting, crash reporting |
| `onMessage` | User sends a message | Input logging |

Hooks receive context as environment variables: `TDSK_AGENT_ID`, `TDSK_THREAD_ID`, `TDSK_TOOL_NAME`, `TDSK_ORG_ID`, etc.

---

## 6. Rendering & Visual Design

### 6.1 Markdown Rendering

Using `marked` + `marked-terminal` (already in dependencies, currently unused):
- Headers — bold + colored
- Code blocks — syntax highlighted via `cli-highlight`, boxed
- Inline code — backtick-wrapped with dim background
- Lists — proper indentation with bullet/number rendering
- Tables — unicode box-drawing characters
- Links — clickable in supported terminals, fallback to `[text](url)` display

### 6.2 Streaming Markdown

Markdown arrives in token chunks. Rendering strategy:
- Buffer text tokens until a complete markdown block boundary is detected
- Render completed blocks immediately
- Show a blinking cursor at the end of the current partial block
- On `done` event, flush and render any remaining buffer

### 6.3 Color/Theme System

Replace hardcoded ANSI escapes with a theme-aware system using `picocolors`:

```
Theme: dark (default)
├── primary:    cyan       # agent responses, headers
├── secondary:  dim white  # user messages (echo)
├── success:    green      # ✓ tool success, connection status
├── warning:    yellow     # ⚠ warnings, retry notices
├── error:      red        # ✗ errors
├── muted:      gray       # timestamps, metadata
├── accent:     magenta    # slash commands, agent names
└── border:     dim gray   # ── separators, boxes
```

Respects `NO_COLOR` environment variable. Configurable via `theme` in config (`dark`, `light`, `auto`).

---

## 7. Error Handling & Resilience

### 7.1 Friendly Error Messages

Every error the user sees is actionable and jargon-free:

| Error | Technical Cause | User Sees |
|-------|----------------|-----------|
| Network down | `ECONNREFUSED` / `ETIMEDOUT` | "Can't reach the server. Check your internet connection and try again." |
| Auth expired | 401 response | "Your session has expired. Run `tdsk-agent login` to reconnect." |
| Agent unavailable | 404 on agent | "This agent isn't available right now. Try `/agent` to pick a different one." |
| Tool failure | Tool returns `isError: true` | "The agent ran into a problem while working. It will try a different approach." |
| Rate limited | 429 response | "The service is busy. Waiting a moment before trying again..." (auto-retry) |
| Stream interrupted | SSE connection drops | "Connection interrupted. Reconnecting..." (auto-reconnect) |
| Provider error | LLM API error | "The AI provider returned an error. Try `/provider` to switch to a different one." |
| Unknown | Unhandled exception | "Something unexpected happened. Your conversation is saved — just restart the REPL." |

### 7.2 Resilience Features

- **Auto-retry with backoff**: Network errors and 429s retry 3 times with exponential backoff (1s, 3s, 9s)
- **Connection status indicator**: Status bar shows `●` green/yellow/red
- **Graceful degradation**: Provider fails → suggest switching. Server down → save unsent message, retry on reconnect
- **Signal handling**: Ctrl+C during streaming cancels current response (doesn't kill REPL). Ctrl+C at prompt exits. Ctrl+D exits.
- **Crash recovery**: Unhandled exceptions caught at top level, conversation state preserved

### 7.3 Input Validation

All validation happens before hitting the network:
- Empty messages ignored (no API call)
- Slash commands validated locally
- File paths validated before `/add` (exists? readable?)
- Provider number validated against available list

---

## 8. File Structure

```
repos/repl/
├── configs/
│   ├── biome.json
│   └── vitest.config.ts
├── scripts/
│   └── compile.ts
├── src/
│   ├── index.ts                    # Entry point (#!/usr/bin/env bun)
│   ├── app.tsx                     # Root <App /> Ink component
│   │
│   ├── components/                 # React/Ink UI components
│   │   ├── App.tsx                 # Top-level router (login vs chat)
│   │   ├── LoginFlow.tsx           # First-run auth flow
│   │   ├── AgentPicker.tsx         # Numbered agent selector
│   │   ├── ChatSession.tsx         # Main chat container
│   │   ├── StatusBar.tsx           # Agent/provider/thread/connection
│   │   ├── MessageList.tsx         # Message history display
│   │   ├── UserMessage.tsx         # Rendered user message
│   │   ├── AssistantMessage.tsx    # Markdown-rendered response
│   │   ├── StreamingResponse.tsx   # Active streaming + spinner
│   │   ├── ToolActivity.tsx        # Tool call visualization
│   │   ├── Prompt.tsx              # Input with history/completion
│   │   ├── Spinner.tsx             # Animated spinner
│   │   ├── MarkdownRenderer.tsx    # marked-terminal wrapper
│   │   ├── ErrorMessage.tsx        # Friendly error display
│   │   ├── WelcomeBox.tsx          # Agent welcome card
│   │   └── SelectPrompt.tsx        # Numbered selection prompt
│   │
│   ├── hooks/                      # React hooks
│   │   ├── useAuth.ts              # Auth state + login/logout
│   │   ├── useConfig.ts            # Merged config loading
│   │   ├── useSession.ts           # Session + provider state
│   │   ├── useMessages.ts          # Message history + streaming
│   │   ├── useAgent.ts             # Agent data + tool info
│   │   ├── useContext.ts           # Local context file loading
│   │   ├── useInputHistory.ts      # Prompt history (up/down)
│   │   ├── useConnection.ts        # Connection status + retry
│   │   └── useLifecycleHooks.ts    # .tdsk/hooks execution
│   │
│   ├── services/                   # Non-UI logic
│   │   ├── api.ts                  # ApiClient (refactored)
│   │   ├── auth.ts                 # AuthManager (refactored)
│   │   ├── executor.ts             # LocalAgentExecutor (refactored)
│   │   ├── httpAdapter.ts          # HttpMessageAdapter (kept)
│   │   ├── config.ts               # YAML config loader
│   │   ├── context.ts              # Local context scanner + loader
│   │   └── hooks.ts                # Lifecycle hook runner
│   │
│   ├── theme/                      # Visual theming
│   │   ├── colors.ts               # Theme-aware color functions
│   │   ├── themes.ts               # dark/light/auto definitions
│   │   └── index.ts
│   │
│   ├── commands/                   # Slash command handlers
│   │   ├── index.ts                # Command registry + dispatcher
│   │   ├── help.ts
│   │   ├── newThread.ts
│   │   ├── switchThread.ts
│   │   ├── listThreads.ts
│   │   ├── history.ts
│   │   ├── switchAgent.ts
│   │   ├── switchProvider.ts
│   │   ├── info.ts
│   │   ├── context.ts
│   │   ├── addContext.ts
│   │   ├── removeContext.ts
│   │   ├── verbose.ts
│   │   ├── clear.ts
│   │   └── exit.ts
│   │
│   ├── tasks/                      # CLI task definitions (kept)
│   │   ├── index.ts
│   │   ├── login.ts
│   │   ├── logout.ts
│   │   ├── status.ts
│   │   ├── agents.ts
│   │   ├── threads.ts
│   │   ├── chat.ts                 # Renders <App /> via Ink
│   │   └── help.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── config.types.ts         # TReplConfig, TProjectConfig
│   │   ├── session.types.ts        # TSessionInfo, TProviderInfo
│   │   ├── commands.types.ts       # TSlashCommand
│   │   ├── context.types.ts        # TContextFile, TContextSource
│   │   └── tasks.types.ts          # TTask, TTaskAction (kept)
│   │
│   ├── constants/
│   │   ├── index.ts
│   │   ├── values.ts               # Version, default paths, defaults
│   │   ├── tools.ts                # Human-readable tool name map
│   │   └── errors.ts               # Friendly error message map
│   │
│   └── utils/
│       ├── tasks/                  # CLI task utilities (kept)
│       │   ├── find.ts
│       │   ├── addDefaults.ts
│       │   ├── requireAuth.ts
│       │   └── error.ts
│       ├── friendly-errors.ts      # Error → user message mapping
│       ├── markdown.ts             # Streaming markdown helpers
│       └── paths.ts                # XDG path resolution
│
├── package.json
└── tsconfig.json
```

### What's Kept vs Changed vs New

| Category | Details |
|----------|---------|
| **Kept (refactored)** | Task system, ApiClient, AuthManager, HttpMessageAdapter, LocalAgentExecutor, compile script |
| **Replaced** | `repl.ts` → Ink components, `renderer.ts` → component tree, `colors.ts` → theme system, JSON config → YAML config |
| **New** | React components, hooks, slash command registry, context loader, lifecycle hooks, theme system, friendly errors, YAML config, provider switching |

---

## 9. Dependencies

### New Dependencies

| Package | Purpose | Replaces |
|---------|---------|----------|
| `ink` | React terminal rendering framework | Raw readline |
| `react` | Component model | — |
| `picocolors` | Terminal colors (fast, small) | Custom ANSI in `colors.ts` |
| `js-yaml` | YAML config parsing | JSON config |
| `ora` | Spinner animations | Custom spinner in renderer |
| `ink-text-input` | Text input component for Ink | Raw readline |

### Already in Dependencies (Now Actually Used)

| Package | Purpose |
|---------|---------|
| `marked` + `marked-terminal` | Markdown rendering (currently imported but unused) |
| `cli-highlight` | Syntax highlighting (currently unused) |

### Kept

| Package | Purpose |
|---------|---------|
| `@keg-hub/args-parse` | CLI task dispatch layer |
| `@keg-hub/jsutils` | Utility functions |
| `@tdsk/agent` | AgentRunner, ProxyAdapter |
| `@tdsk/domain` | Shared types (TStreamEvent, models) |
| `@tdsk/sandbox` | Sandbox provider abstraction |

---

## 10. Testing Strategy

### Test Structure

Every component, hook, service, and command gets a co-located `.test.ts` file:

| Layer | ~Count | What's Tested | Tool |
|-------|--------|---------------|------|
| Components | 15 | Render output, interaction, state | `ink-testing-library` |
| Hooks | 9 | State transitions, API calls, errors | `vitest` + `@testing-library/react-hooks` |
| Services | 7 | API client, auth, executor, config, context | `vitest` + mocked fetch/fs |
| Commands | 14 | Each slash command's behavior | `vitest` |
| Integration | 3 | Full flows: login → pick → chat → tool → exit | `ink-testing-library` |

### Testing Tools

- `vitest` (already used)
- `ink-testing-library` — renders Ink components, captures output, simulates input
- Mocking: same pattern as current (`vi.stubGlobal` for fetch, `vi.mock` for fs)

### Coverage Targets

- Happy paths: 100%
- Error paths: 100% (critical for non-technical users)
- Edge cases: network failures, empty states, signal handling, config corruption

---

## 11. Current State Assessment

### What Works Today (149 tests passing)

- CLI dispatch (login/logout/status/agents/threads/chat/help)
- API key auth with persistent storage
- Agent listing, thread management, message persistence
- Session-based LLM proxy (API keys never leave server)
- Event-driven streaming (text, tool calls, results)
- Basic spinner and output formatting

### What's Broken or Missing

- `marked-terminal` and `cli-highlight` imported but **never used**
- Recursive readline (creates new interface per prompt — inefficient)
- No loading indicators during AI responses (spinner exists but not wired to message flow)
- Hardcoded values: `maxSteps=10`, prompt=`>`, userId=`"repl-user"`, truncation lengths
- No session persistence across invocations
- No context file loading
- No plugin/hook system
- Plaintext credentials without file permissions (`0o600`)
- No pagination for long lists
- No retry/timeout logic on API calls
- No signal handling (Ctrl+C during execution)
- Colors don't respect `NO_COLOR` environment variable
- No provider switching
- Errors show technical messages, not friendly ones

---

## 12. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI framework | Ink (React) | Declarative, composable, proven by Claude Code |
| Config format | YAML | Consistent with ThreadedStack ecosystem (`deploy/values.yaml`) |
| Config location | `~/.config/tdsk/repl/config.yaml` | XDG-compliant, single file with auth embedded |
| State management | React hooks + context | Right-sized for this scope, no external dep needed |
| Provider switching | Per-message, no session regen | Provider is a parameter on the request, not a session property |
| Error handling | Friendly messages + auto-retry | Non-technical users need actionable guidance, not stack traces |
| Tool display | Compact by default, verbose opt-in | Don't overwhelm users; power users toggle `/verbose` |
| Context loading | Auto-detect `.tdsk/` + manual `/add` | Balance convenience with control |
| Colors | `picocolors` with `NO_COLOR` support | 14x smaller than chalk, respects standards |
| Markdown | `marked-terminal` with streaming buffer | Already a dependency, just needs to be wired up |
