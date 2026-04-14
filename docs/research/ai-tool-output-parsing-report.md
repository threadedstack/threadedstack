# AI Tool Output Parsing for Interactive UI — Research Report

**Date**: 2026-04-13
**Context**: ThreadedStack Threads Sandbox UI needs to transform AI tool terminal output into an interactive chat UI. This report analyzes 4 open-source repos that have solved this problem, compares them to our current parser, and provides integration recommendations.

---

## Executive Summary

**The single most important finding**: None of the 4 researched repos parse terminal output. They all bypass the terminal entirely by using **structured APIs/SDKs** provided by the AI tools themselves.

| Repo | Capture Method | Terminal Parsing? | Interactive UI? |
|------|---------------|-------------------|-----------------|
| **Happy** | Claude Code SDK (`@anthropic-ai/claude-agent-sdk`) + JSONL file scanning | No | Yes — full permissions, tool rendering, subagent nesting |
| **Remodex** | Codex `app-server` JSON-RPC protocol | No | Yes — approvals, plan mode, structured input forms |
| **CloudCLI** | Claude Code SDK + node-pty (separate tabs, not unified) | No (terminal tab is raw passthrough) | Yes — permissions, tool configs, file browser |
| **HAPI** | Claude Code CLI `--output-format stream-json` + stdin/stdout | No | Yes — permissions, plan mode, remote terminal |
| **ThreadedStack** | ghostty-web WASM VT parser → regex line matching | Yes (the only one) | Minimal — basic permission detection |

**The fundamental insight**: Interactive chat UIs for AI tools are **not a parsing problem** — they are a **structured event consumption problem**. Every successful implementation gets structured data directly from the AI tool, either via an SDK, a JSON-RPC API, or CLI flags that output structured JSON.

---

## Per-Repo Analysis

### 1. Happy (slopus/happy)

**Architecture**: Monorepo with 6 packages: `happy-cli` → `happy-wire` → `happy-server` → `happy-app` (Expo/React Native)

**Output Capture — Two Paths**:

- **Remote Mode (Primary)**: Uses the official `@anthropic-ai/claude-agent-sdk`. The SDK's `query()` returns an `AsyncIterable<SDKMessage>` with typed messages (`user`, `assistant`, `system`, `result`). Each message contains structured content blocks (`text`, `thinking`, `tool_use`, `tool_result`).

- **Local Mode**: Spawns Claude Code as a child process with TTY passthrough (user sees native UI). Captures output by **watching JSONL session log files** that Claude Code writes to `~/.claude/projects/<path>/<session>.jsonl`. Uses file watchers + 3-second polling.

**Message Protocol — Three Layers**:

1. **RawJSONLines** (Claude Code's native format): `{ type: 'user'|'assistant'|'summary'|'system', uuid, message: { content: [...blocks] } }`
2. **SessionEnvelope** (wire format, 9 event types): `text`, `tool-call-start`, `tool-call-end`, `turn-start`, `turn-end`, `start`, `stop`, `service`, `file`
3. **Message** (UI format, 4 kinds): `user-text`, `agent-text`, `tool-call`, `agent-event`

**Interactivity**: SDK's `canUseTool` callback is intercepted by `PermissionHandler`. Creates a Promise that blocks execution until the mobile user responds via Socket.IO RPC. Permission requests stored in `agentState.requests`, synced to the app. App shows tool-specific approval buttons (e.g., "Yes, Allow All Edits" for file tools).

**Subagent Handling**: The session protocol mapper tracks Task/Agent tool calls, assigns `cuid2` subagent IDs, buffers sidechain messages, and hides parent tool calls. The app renders subagent content nested inside their parent.

**Key Strength**: The dual capture path (SDK for headless, JSONL scanning for local) + the 9-event flat protocol that works across Claude, Codex, and Gemini.

**Key Limitation**: Local mode has 0-3 second latency from file polling. Remote mode has no raw terminal output (interactive Claude Code features like theme selection are not captured).

---

### 2. Remodex (Emanuele-web04/remodex)

**Architecture**: Three-tier — iPhone (SwiftUI) ←→ Relay Server (Node.js) ←→ Bridge (Node.js) ←→ `codex app-server`

**Output Capture**: Uses Codex's built-in `app-server` mode which exposes a **JSON-RPC 2.0 protocol** over stdin/stdout. The bridge spawns `codex app-server`, pipes JSON-RPC bidirectionally, and acts as an encrypted relay to the iOS app. The bridge does almost zero message transformation — Codex's structured API provides everything natively.

**JSON-RPC Notifications from Codex** (subset):
- `agent/response/delta` — streaming assistant text
- `agent/reasoning/delta` — thinking/reasoning content
- `item/fileChange/delta` / `item/fileChange/completed` — file modifications
- `item/commandExecution/started` / `output/delta` / `completed` — shell commands
- `item/toolCall/started` / `completed` — tool invocations
- `item/diff/delta` / `completed` — code diffs
- `turn/plan/updated` — plan progress

**Message Model** (iOS):
```
CodexMessageKind: chat | thinking | toolActivity | fileChange | 
                  commandExecution | subagentAction | plan | userInputPrompt
```

**Interactivity**: Command approval uses JSON-RPC request/response — Codex sends `item/commandExecution/requestApproval`, iOS renders an approval card, user taps Accept/Decline, response flows back. Structured user input (plan mode) uses `item/tool/requestUserInput` with typed question schemas including multi-select options.

**Key Strength**: Codex provides the richest structured API of any AI tool — diffs, file changes, command output, plans are all first-class event types. Zero parsing needed.

**Key Limitation**: Codex-only. The `app-server` JSON-RPC API is unique to Codex. Cannot work with Claude Code, Gemini, or other tools.

---

### 3. CloudCLI (siteboon/claudecodeui)

**Architecture**: Full-stack Node.js + React SPA with **two completely separate WebSocket paths**:
- `/ws` — Chat mode via Claude Agent SDK (structured JSON)
- `/shell` — Terminal mode via node-pty (raw ANSI output)

**These are NOT unified**. Chat and terminal are independent interaction modes in separate tabs. The SDK provides structured messages for chat; the PTY provides raw terminal output for the terminal tab. They operate on the same Claude Code session but don't share state in real-time.

**Output Capture (Chat Mode)**: Same SDK pattern as Happy — `query()` returns async iterable of typed messages. A `ClaudeAdapter` normalizes SDK events into a flat `NormalizedMessage` schema:
```
MessageKind: text | tool_use | tool_result | thinking | stream_delta | stream_end |
             error | complete | status | permission_request | permission_cancelled |
             session_created | interactive_prompt | task_notification
```

**Provider Adapter Pattern**: All AI tools abstracted behind `ProviderAdapter` interface with `fetchHistory()` and `normalizeMessage()`. Currently supports Claude, Cursor, Codex, and Gemini. Each provider has its own adapter.

**Tool Rendering**: Config-driven `TOOL_CONFIGS` registry maps tool names to display configurations:
```javascript
Bash:  { input: { type: 'one-line', icon: 'terminal' }, result: { hideOnSuccess: true } }
Edit:  { input: { type: 'collapsible', contentType: 'diff' }, result: { hideOnSuccess: true } }
Grep:  { input: { type: 'one-line' }, result: { type: 'collapsible', contentType: 'file-list' } }
```

**Interactivity**: Same `canUseTool` callback pattern. Permission requests sent as `permission_request` messages, responses flow back as `claude-permission-response`. Supports "remember" rules (e.g., "Yes, for all Bash(git:*) commands").

**Key Strength**: Multi-provider adapter pattern, config-driven tool rendering, session store with server/realtime merge and deduplication.

**Key Limitation**: Chat and terminal are disconnected. No real-time file browser sync with Claude operations. Single-server architecture.

---

### 4. HAPI (tiann/hapi)

**Architecture**: Three components — CLI (agent wrapper) ←Socket.IO→ Hub (server) ←SSE/REST→ Web (PWA)

**Output Capture**: Spawns Claude Code CLI with `--output-format stream-json --input-format stream-json --permission-prompt-tool stdio`. This creates a **bidirectional NDJSON protocol** over stdin/stdout:

```typescript
// Spawn Claude Code with structured JSON I/O
const args = ['--output-format', 'stream-json', '--verbose',
              '--input-format', 'stream-json',
              '--permission-prompt-tool', 'stdio']
const child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'] })
```

Each line from stdout is a complete JSON message (SDKMessage). Input is injected by writing JSON to stdin. Permissions are handled via `control_request`/`control_response` messages on the same stdout/stdin channel.

**Local/Remote Duality**: Like Happy, HAPI supports local mode (TTY passthrough, user sees native UI) and remote mode (headless SDK, all I/O through the Hub). Can switch modes mid-session.

**Normalization Pipeline**: 
```
SDKMessage → SDKToLogConverter → RawJSONLines → Hub (SQLite) → SSE → Web
Web: DecryptedMessage → normalizeDecryptedMessage() → NormalizedMessage → reducer → ChatBlock[]
```

The web reducer is a multi-phase state machine:
- Phase 0: AgentState permissions → tool messages
- Phase 1: User/agent text messages
- Phase 2: Tool calls (match to permissions)
- Phase 3: Tool results (update tool state)
- Phase 4: Sidechains (subagent nesting)
- Phase 5: Mode switch events

**Remote Terminal**: Separate PTY feature (NOT for Claude output) using Bun's built-in terminal support. Terminal events flow over Socket.IO (`terminal:open/write/resize/close/output/exit`).

**Key Strength**: The CLI spawn flags (`--output-format stream-json` etc.) are the simplest integration path — no SDK dependency, just spawn the claude binary with the right flags and read NDJSON. Works with any shell/container environment.

**Key Limitation**: Single-machine Hub (needs tunneling for remote access). Claude Code-specific CLI flags don't work with other tools.

---

## Current ThreadedStack Parser

**Architecture**: `repos/domain/src/parser/` — 7 source files implementing a pipeline:

```
Raw SSH bytes → GhosttyVT (WASM terminal emulator) → ChangeDetector (sealed line detection)
    → PatternMatcherPipeline (regex classification) → TParsedEvent
```

**How it works**:
1. `GhosttyVT` loads `ghostty-vt.wasm` to create a headless virtual terminal
2. Raw PTY bytes are fed into the WASM terminal via `write()`
3. `ChangeDetector` extracts plain text from rows the cursor has passed (sealed lines)
4. `PatternMatcherPipeline` applies regex matchers in priority order
5. Currently 5 Claude Code matchers: `tool-call` (⏺ prefix), `permission` (y/n), `error`, `prompt-ready`, `diff`

**Event Types**: `input`, `text`, `tool-call`, `permission`, `diff`, `error`, `activity`, `prompt-ready`, `unknown`

**Why it fails for interactive UI**:

1. **Line-oriented**: Each terminal line becomes one event. No grouping (multi-line diffs, code blocks, menus).
2. **Text-only extraction**: `getLineText()` strips ALL ANSI formatting — colors, bold, hyperlinks, selection cursors gone.
3. **No state tracking**: Each line matched independently. No "I'm inside a diff block" or "I'm in a selection menu."
4. **Active row underutilized**: Interactive elements (menus, spinners) happen on the cursor row, which only emits `activity`.
5. **No semantic understanding**: Can't detect terminal UI widgets (inquirer.js menus, progress bars, bordered panels).
6. **Input echo duplication**: User input echoes through PTY and appears as both `UserBubble` and `AiBubble`.

**The fundamental problem**: The parser was designed as a regex classifier on top of a VT emulator. The VT emulator correctly models the terminal's 2D grid, but the parser only extracts 1D text strings. The spatial/temporal information needed for interactive widgets is available in the WASM viewport but is not used.

---

## Cross-Repo Comparison

### Capture Method Comparison

| Approach | Used By | Structured? | Real-time? | Multi-tool? | Requires |
|----------|---------|-------------|------------|-------------|----------|
| SDK library import | Happy, CloudCLI | Full | Yes | Per-SDK | `@anthropic-ai/claude-agent-sdk` npm package |
| CLI `--output-format stream-json` | HAPI | Full | Yes | Claude only | `claude` binary with right flags |
| `app-server` JSON-RPC | Remodex | Full | Yes | Codex only | `codex` binary in app-server mode |
| JSONL file scanning | Happy (local) | Full | 0-3s delay | Claude only | Access to `~/.claude/projects/` filesystem |
| PTY + VT parser + regex | ThreadedStack | Partial | Yes | Any tool | SSH/PTY access to the process |

### Message Schema Comparison

| Repo | Schema Style | Event Types | Subagent Support | Permission Model |
|------|-------------|-------------|------------------|------------------|
| Happy | 3-layer (raw → wire → UI) | 9 wire events | UUID-tracked sidechains | agentState.requests + RPC |
| Remodex | JSON-RPC notifications | ~25 notification types | Thread-scoped | request/response JSON-RPC |
| CloudCLI | Flat NormalizedMessage | 12 kinds | parentToolUseId grouping | permission_request/response |
| HAPI | Multi-phase reducer | ~20 notification types | UUID parent chains | agentState + RPC |
| ThreadedStack | Flat TParsedEvent | 8 types | None | Regex-detected prompt |

### Interactivity Comparison

| Feature | Happy | Remodex | CloudCLI | HAPI | ThreadedStack |
|---------|-------|---------|----------|------|---------------|
| Tool approval (y/n) | ✅ SDK callback | ✅ JSON-RPC | ✅ SDK callback | ✅ SDK callback | ⚠️ Regex detection |
| Multi-choice menus | ❌ | ✅ Structured input | ❌ | ❌ | ❌ |
| Plan mode | ✅ | ✅ | ✅ | ✅ | ❌ |
| File diffs | ✅ Tool result | ✅ item/fileChange | ✅ LCS diff | ✅ Tool result | ⚠️ +/- regex |
| Streaming text | ✅ | ✅ Deltas | ✅ stream_delta | ✅ | ⚠️ Sealed lines only |
| Subagent nesting | ✅ | ✅ Thread-scoped | ✅ | ✅ | ❌ |
| AskUserQuestion | ✅ Never auto-approve | ✅ | ✅ | ✅ | ❌ |
| Progress indicators | ❌ | ✅ | ❌ | ❌ | ⚠️ Activity event |

---

## Integration Recommendations for ThreadedStack

### The Core Problem

ThreadedStack's architecture differs fundamentally from all 4 repos: AI tools run inside **remote K8s pods**, accessed via **SSH/WebSocket tunnels**. The other repos all run the AI tool **locally** (same machine as the server) and can use direct SDK imports, spawn subprocesses with special flags, or read filesystem artifacts.

This means ThreadedStack can't simply import the Claude Code SDK on the backend — it needs to run structured capture **inside the pod** and relay the structured events through the existing WebSocket tunnel.

### Recommended Architecture: Dual-Stream with SDK-in-Pod

```
K8s Pod
  ├── AI Tool (claude/codex/gemini) spawned with structured JSON flags
  ├── Capture Agent (sidecar/wrapper) — runs SDK or reads structured output
  │     ├── Structured events → JSON text frames → WebSocket tunnel
  │     └── Raw PTY bytes → binary frames → WebSocket tunnel (for terminal view)
  └── SSH server (existing)

Backend (existing WebSocket tunnel handler)
  ├── JSON text frames → parse as NormalizedEvent → broadcast to clients + persist to DB
  └── Binary frames → forward to terminal view subscribers (existing behavior)

Threads SPA
  ├── Chat View: renders NormalizedEvents as interactive components
  └── Terminal View: renders raw PTY bytes via ghostty-web (existing behavior)
```

### Specific Recommendations

#### 1. Adopt the CLI-flags approach (HAPI pattern) as the primary capture method

For Claude Code, spawn with:
```bash
claude --output-format stream-json --input-format stream-json --permission-prompt-tool stdio
```

For Codex, spawn with:
```bash
codex app-server
```

This runs **inside the pod** as part of the sandbox's init script or entrypoint. The structured JSON output is captured by a thin wrapper process that forwards it through the WebSocket tunnel.

**Why this over the SDK**: The SDK requires importing `@anthropic-ai/claude-agent-sdk` as a Node.js dependency, which adds complexity to the pod image. The CLI flags approach works with any language/runtime — just spawn the binary and read stdout.

#### 2. Define a unified NormalizedEvent schema (inspired by Happy's wire protocol + CloudCLI's flat schema)

```typescript
type NormalizedEvent = {
  id: string
  sessionId: string
  timestamp: number
  provider: 'claude-code' | 'codex' | 'gemini-cli' | 'open-code'
  turn?: string              // groups events in a single AI turn
  subagent?: string          // for nested Task/Agent content
  ev: EventPayload
}

type EventPayload =
  | { t: 'text'; role: 'user' | 'assistant'; content: string; thinking?: boolean }
  | { t: 'tool-call-start'; callId: string; name: string; input: unknown; title?: string }
  | { t: 'tool-call-end'; callId: string; result?: unknown; isError?: boolean }
  | { t: 'permission-request'; requestId: string; tool: string; input: unknown }
  | { t: 'permission-response'; requestId: string; allow: boolean; updatedInput?: unknown }
  | { t: 'turn-start' }
  | { t: 'turn-end'; status: 'completed' | 'failed' | 'cancelled' }
  | { t: 'error'; message: string }
  | { t: 'status'; text: string }
  | { t: 'stream-delta'; content: string }
  | { t: 'stream-end' }
```

#### 3. Build per-runtime adapters (CloudCLI pattern)

Each sandbox runtime gets an adapter that converts its native output to `NormalizedEvent`:

```typescript
interface RuntimeAdapter {
  // Convert a single line/message from the AI tool to NormalizedEvent(s)
  normalize(raw: unknown, sessionId: string): NormalizedEvent[]
}
```

- `ClaudeCodeAdapter`: Handles `--output-format stream-json` NDJSON
- `CodexAdapter`: Handles `app-server` JSON-RPC notifications
- `GeminiAdapter`: Handles Gemini CLI output format
- `FallbackAdapter`: For unknown runtimes, falls back to the existing VT parser (text events only)

#### 4. Implement config-driven tool rendering (CloudCLI pattern)

```typescript
const TOOL_CONFIGS: Record<string, ToolDisplayConfig> = {
  Bash: { input: { type: 'one-line', icon: 'terminal', getValue: i => i.command } },
  Read: { input: { type: 'one-line', getValue: i => i.file_path }, result: { hidden: true } },
  Edit: { input: { type: 'collapsible', contentType: 'diff' }, result: { hideOnSuccess: true } },
  Write: { input: { type: 'collapsible', contentType: 'code' }, result: { hideOnSuccess: true } },
  Grep: { input: { type: 'one-line', getValue: i => i.pattern }, result: { contentType: 'file-list' } },
  // ...
}
```

#### 5. Implement the permission flow (Happy/HAPI pattern)

```
Pod: AI tool sends control_request (permission needed)
  → Capture agent creates permission-request NormalizedEvent
  → WebSocket tunnel → Backend
  → Backend persists permission request, broadcasts to Threads SPA
  → Threads SPA renders approval card with tool-specific buttons
  → User clicks Approve/Deny
  → permission-response flows back: Threads → Backend → WebSocket tunnel → Pod
  → Capture agent writes control_response to AI tool's stdin
  → AI tool continues execution
```

#### 6. Keep the existing VT parser as a fallback

The current ghostty-web parser remains valuable for:
- Runtimes that don't expose structured APIs (custom tools, arbitrary CLIs)
- The terminal view (raw PTY rendering, already working)
- Graceful degradation when structured capture fails

But it should NOT be the primary path for known AI tools.

#### 7. Where the work happens

| Component | Location | What Changes |
|-----------|----------|-------------|
| Runtime adapters | `repos/domain/src/adapters/` | New — per-runtime normalization |
| NormalizedEvent types | `repos/domain/src/types/` | New — unified event schema |
| Capture agent / wrapper | `repos/sandbox/` | New — runs inside pod, wraps AI tool spawn |
| WebSocket tunnel handler | `repos/backend/src/` | Modified — parse JSON text frames as NormalizedEvents |
| Chat view components | `repos/threads/src/` | Modified — render NormalizedEvents with tool configs |
| Permission flow | Backend + Threads | New — permission-request/response through tunnel |
| Tool renderer configs | `repos/threads/src/` or `repos/components/` | New — config-driven tool display |

### What NOT to Do

1. **Don't try to improve the regex parser** to handle interactive elements. Terminal parsing is fundamentally the wrong abstraction — even a perfect VT parser can't reconstruct the semantic intent behind ANSI escape sequences (is this a menu? a progress bar? a code block?). The AI tools know what they're rendering; use their structured output.

2. **Don't import the SDK on the backend server**. The SDK needs to run co-located with the AI tool process (same machine, shared filesystem). In our architecture, that means inside the pod.

3. **Don't try to build a universal terminal-to-chat converter**. This is an unsolvable problem in the general case. Each AI tool has its own terminal UI patterns. Instead, use each tool's structured output format and fall back to raw terminal for unknown tools.

---

## Key Files for Reference Implementation

| File (in external repo) | What to Study | Why |
|--------------------------|---------------|-----|
| Happy `packages/happy-wire/src/sessionProtocol.ts` | Wire protocol schema | Clean 9-event flat stream design |
| Happy `packages/happy-cli/src/claude/utils/sessionProtocolMapper.ts` | SDK → protocol conversion | Turn management, subagent tracking |
| Happy `packages/happy-cli/src/claude/utils/permissionHandler.ts` | Permission flow | Promise-based blocking + push notifications |
| Happy `packages/happy-app/sources/sync/reducer/reducer.ts` | Client-side reducer | Multi-phase state machine for message processing |
| HAPI `cli/src/claude/sdk/query.ts` | CLI spawn with JSON flags | Simplest integration path — just spawn + read NDJSON |
| HAPI `cli/src/claude/utils/sdkToLogConverter.ts` | SDK → log conversion | UUID parent chain tracking for sidechains |
| HAPI `hub/src/sync/rpcGateway.ts` | Permission RPC relay | Web → Hub → CLI permission routing |
| CloudCLI `server/providers/types.js` | NormalizedMessage schema | Flat discriminated union design |
| CloudCLI `server/providers/claude/adapter.js` | Provider adapter | SDK event normalization + history loading |
| CloudCLI `src/components/chat/tools/ToolRenderer.tsx` | Config-driven rendering | Tool display configs |
| Remodex `CodexMobile/CodexMobile/Models/CodexMessage.swift` | Message taxonomy | `CodexMessageKind` enum for UI rendering |
