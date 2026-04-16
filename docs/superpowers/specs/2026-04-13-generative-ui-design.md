# Generative UI System — Design Spec

**Date**: 2026-04-13
**Status**: Draft
**Prerequisite**: Markdown rendering improvements in ChatView

---

## Overview

The Generative UI system adds an async interpretation layer to the existing sandbox shell pipeline. It converts raw terminal output from AI tools (Claude Code, Codex, Gemini CLI, etc.) into interactive React component trees — without modifying how sandboxes run, without per-tool adapters, and without SDK dependencies.

The system is **runtime-agnostic**: any tool that writes to stdout works. The AI interpreter handles the semantic understanding; the component registry handles the rendering; and the existing terminal parser + WebSocket infrastructure remains untouched.

### Problem

The current terminal parser (`repos/domain/src/parser/`) reduces rich terminal output to plain text lines via regex matching. Interactive elements (theme pickers, selection menus, confirmation prompts) appear as individual text lines in the chat view with no interactivity. The parser is fundamentally line-oriented — it strips all ANSI formatting and has no semantic understanding of terminal UI widgets.

### Solution

Instead of improving the parser's regex matching (a fundamentally limited approach), the system pipes buffered terminal output through an AI interpreter that returns a structured JSON component tree matching the `React.createElement` API. This tree is rendered through a recursive component renderer in the Threads Chat view. User interactions (clicking a selection, confirming a prompt) are translated to terminal-native keystrokes and sent back to the running process via stdin.

### Key Properties

- **Additive only**: The raw event pipeline is completely untouched. If the interpreter is disabled, fails, or skips a chunk, the experience is identical to today.
- **Two-phase delivery**: Raw events arrive instantly (zero latency). Interactive UI upgrades arrive async and replace the raw text with a fade-swap animation.
- **Runtime-agnostic**: Works with any AI tool that writes to stdout. No per-tool adapters, no special CLI flags, no SDK integration.
- **Configurable**: Org admins can enable/disable, choose provider/model, set retry limits, and override the system prompt. Per-sandbox overrides allow fine-grained control.

---

## Architecture

### Data Flow

```
Pod stdout → SSH stream → parser.write() → TerminalParser → TParsedEvent
  ↓ (unchanged, immediate)
  ├── broadcastEvent({ sessionId, event, chunkId?, timestamp }) → all clients
  └── queueEventForPersistence({ event, chunkId?, timestamp }) → batched DB insert

  ↓ (new, parallel async path)
  TParsedEvent → ChunkBuffer (accumulates events, assigns chunkId)
                    ↓ flush trigger (prompt-ready OR 200ms debounce)
                 SkipHeuristic — does this chunk need interpretation?
                    ↓ no: discard (raw events already delivered)
                    ↓ yes:
                 InterpreterService.interpret(chunk, guiConfig)
                    ↓
                 TGenerativeUIEvent { chunkId, tree, timestamp }
                    ↓
                 broadcastEvent() → all clients (upgrade event)
                 queueEventForPersistence() → DB
```

### Client Behavior

1. Raw events arrive with optional `chunkId` and `timestamp` → rendered as today (AiBubble, ToolCallCard, etc.)
2. Upgrade event arrives with matching `chunkId` → client finds all raw events with that chunkId, replaces them with the component tree (fade-swap animation)
3. No upgrade event arrives → raw events stay as-is. Graceful degradation.
4. "Show Raw" toggle lets users see original text for any upgraded chunk

### Event Framing

All outbound events include a timestamp for ordering. Buffered events also include a chunkId for upgrade matching.

```typescript
// Buffered events (text, tool-call, permission, diff, error, unknown):
{ sessionId: string, chunkId: string, event: TParsedEvent, timestamp: number }

// Bypass events (activity, prompt-ready, input):
{ sessionId: string, event: TParsedEvent, timestamp: number }

// Upgrade events:
{ sessionId: string, chunkId: string, type: 'generative-ui', tree: TJsonComponentTree, timestamp: number }
```

The upgrade event's `timestamp` is set to the timestamp of the first raw event in the chunk — so it sorts into the correct position in chat history.

---

## Chunk Buffer

The `ChunkBuffer` is a stateful accumulator that lives per-session in the `onShellConnect` handler. It collects raw events, assigns chunk IDs, and flushes on two triggers.

### Lifecycle

1. Parser emits a `TParsedEvent`
2. If the event type is in the bypass list (`activity`, `prompt-ready`, `input`), it passes through without entering the buffer. No chunkId stamped. A timestamp is still assigned.
3. Otherwise, the event enters the buffer and gets the current chunkId stamped.
4. The buffer flushes when:
   - **Primary trigger**: A `prompt-ready` event fires (the AI tool is waiting for input — output is complete)
   - **Fallback trigger**: 200ms passes since the last event entered the buffer (output stopped but no prompt detected)
5. On flush, the buffer emits `{ chunkId, events[] }`, generates a new chunkId for the next chunk, and hands the flushed chunk to the skip heuristic.

### Event Classification

**Bypass (no chunkId, timestamp only):**
- `activity` — cursor movement, no content
- `prompt-ready` — signals flush, not content itself
- `input` — user's own text, rendered as UserBubble

**Buffered (chunkId + timestamp):**
- `text` — AI output prose
- `tool-call` — tool invocation lines
- `permission` — permission prompts
- `diff` — diff content
- `error` — error messages
- `unknown` — unrecognized output

---

## Skip Heuristic

The skip heuristic receives a flushed chunk and decides whether to send it to the interpreter. Its purpose is to avoid expensive LLM calls for chunks that are clearly non-interactive.

```typescript
function shouldInterpret(events: TParsedEvent[]): boolean {
  const text = events
    .filter(e => e.type === 'text' || e.type === 'unknown')
    .map(e => e.content ?? e.raw ?? '')
    .join('\n')

  if (!text.trim()) return false

  return InteractivePatterns.some(pattern => pattern.test(text))
}
```

### InteractivePatterns (v1)

```typescript
const InteractivePatterns = [
  /^\s*\d+[.)]\s+/m,                              // Numbered lists: "1. Option", "2) Choice"
  /^\s*[-*]\s+/m,                                  // Bulleted lists
  /[❯›>→]\s+/m,                                   // Cursor/selection markers
  /\(y\/n\)|\[Y\/n\]|\(yes\/no\)/i,               // Confirmation prompts
  /\b(Allow|Do you want to|Choose|Select|Pick)\b/i // Action prompts
]
```

### Skip Rules

- **Code fences**: Detected chunks that are entirely within code fences are skipped — rendered as markdown by AiBubble.
- **Plain prose**: Chunks where no interactive pattern matches are skipped.
- **Empty chunks**: Chunks with no meaningful text content are discarded.

The heuristic is intentionally loose for v1 — better to send a few false positives to the interpreter (which can return `null` for "no upgrade needed") than miss real interactive elements. The heuristic is tightened based on observed data over time.

---

## Interpreter Service

The `InterpreterService` is a backend service that takes a flushed chunk and the org's GUI config, calls the configured LLM via pi-ai, and returns a JSON component tree.

### Interface

```typescript
class InterpreterService {
  async interpret(
    chunk: { chunkId: string; events: TParsedEvent[] },
    config: TGuiConfig
  ): Promise<TGenerativeUIResult | null>
}
```

Returns `null` if interpretation fails after retries or if the interpreter determines the content is non-interactive.

### Implementation

1. Resolve the provider from `config.providerId` — get the brand, API base URL, and decrypted API key
2. Get the model object via pi-ai's `getModel(brand, config.model)`
3. Extract raw text from the chunk's events
4. Call `streamSimple()` with the system prompt (`config.systemPrompt ?? InterpreterSystem`) and raw text
5. Collect the full response, JSON parse it
6. Validate the tree against the component registry
7. Return `TGenerativeUIResult` or `null`

### pi-ai Integration

The service uses pi-ai's `streamSimple()` for provider-agnostic LLM calls. pi-ai is already in the backend (used for model registry in `repos/backend/src/services/providers/modelRegistry.ts`). No new dependencies needed.

```typescript
import { getModel, streamSimple } from '@mariozechner/pi-ai'

const model = getModel(brand, config.model)
const stream = await streamSimple(model, {
  systemPrompt: config.systemPrompt ?? InterpreterSystem,
  messages: [{ role: 'user', content: rawText, timestamp: Date.now() }],
}, { maxTokens: 2048, temperature: 0 })

let response = ''
for await (const event of stream) {
  if (event.type === 'text_delta') response += event.delta
}
```

### Retry Strategy

- Up to `config.maxRetries` attempts (configurable from Admin, default 2)
- Retries on: JSON parse failure, tree validation failure, API rate limit/timeout
- Backoff: 500ms * attempt number
- After exhaustion: returns `null` (graceful degradation — raw text stays)

### File Structure

```
repos/backend/src/services/interpreter/
  interpreter.ts    — Main service class (~100 lines)
  prompt.ts         — Prompt construction, references InterpreterSystem from domain
  validator.ts      — JSON tree validation against component registry
```

---

## Interpreter System Prompt

The system prompt lives as an `InterpreterSystem` constant in `repos/domain/src/constants/`. It can be overridden per-org or per-sandbox via the `systemPrompt` field in `TGuiConfig`.

### Prompt Design

The prompt instructs the LLM to:

1. **Output format**: Strict JSON only. No markdown fences, no explanation text. A single `TJsonComponentNode` object.
2. **Null response**: Return the string `null` if the content is just prose with no interactive elements.
3. **Component vocabulary**: Only v1 registry components (Select, Confirm, TextInput, Alert, ProgressBar) + allowed HTML elements.
4. **Interaction classification**: For Select, classify as `ArrowSelect` (cursor markers present) or `NumberSelect` (numbered list). Include `currentIndex` for ArrowSelect.
5. **Conservative behavior**: When unsure, return `null`. False negatives (raw text stays) are better than false positives (broken interaction).
6. **Examples**: 2-3 input/output pairs showing real terminal output → JSON tree. These anchor behavior on the exact patterns we care about.

### Resolution

```
config.guiConfig.systemPrompt ?? InterpreterSystem (domain constant)
```

The full prompt text will be developed during implementation. The spec defines the contract (what the prompt must achieve), not the exact wording.

---

## Component Registry & JSON Component Tree

### TJsonComponentTree

Defined in domain, shared by backend and frontend:

```typescript
type TJsonComponentNode = {
  type: string                                    // Registry component or HTML element
  props?: Record<string, unknown>                 // Component-specific props
  children?: (TJsonComponentNode | string)[]      // Nested nodes or text
}

type TJsonComponentTree = TJsonComponentNode      // Root node (always a div)
```

### V1 Components

| Component | Props | Interactive | Interaction Type |
|-----------|-------|-------------|-----------------|
| `Select` | `options: { label, value, description? }[]`, `interactionType: 'ArrowSelect' \| 'NumberSelect'`, `currentIndex?: number` | Yes | ArrowSelect or NumberSelect (explicit in props) |
| `Confirm` | `prompt: string`, `yesLabel?: string`, `noLabel?: string` | Yes | YesNo (implicit from component type) |
| `TextInput` | `placeholder?: string`, `label?: string` | Yes | TextInput (implicit from component type) |
| `Alert` | `variant: 'info' \| 'warning' \| 'error' \| 'success'`, `title?: string` | No | — |
| `ProgressBar` | `value: number`, `max?: number`, `label?: string` | No | — |

### Allowed HTML Elements

Passthrough, no registry entry needed: `div`, `p`, `span`, `strong`, `em`, `ul`, `li`, `ol`, `code`, `pre`, `hr`, `br`

### Validation Rules

Applied in `validator.ts` before returning the tree:

- Root node must have `type: 'div'`
- Every `type` must be either a registry component or an allowed HTML element
- Registry components must have their required props present
- `Select` must have at least 2 options
- `Confirm` must have a non-empty `prompt`
- `children` entries must be strings or valid `TJsonComponentNode`s
- Max tree depth of 10

### Interaction Types

Interaction types are **implicit from the component type** or **explicit in props**. No separate interaction map — the component tree is the single source of truth.

| Component | Interaction Type | How Determined |
|-----------|-----------------|----------------|
| `Select` | `ArrowSelect` or `NumberSelect` | Explicit `interactionType` prop |
| `Confirm` | `YesNo` | Always — implicit from component type |
| `TextInput` | `TextInput` | Always — implicit from component type |
| `Alert` | None | Not interactive |
| `ProgressBar` | None | Not interactive |

---

## Client-Side Rendering

### State Additions (Jotai atoms)

```typescript
// Existing — unchanged:
sessionEventsAtom        // Map<sessionId, { chunkId?, event, timestamp }[]>

// New:
sessionUpgradesAtom      // Map<sessionId, Map<chunkId, TJsonComponentTree>>
```

### WebSocket Event Handling

The `openSession.ts` WebSocket handler adds one new case: when a message has `type: 'generative-ui'`, store the tree in `sessionUpgradesAtom` keyed by chunkId.

### ChatView Rendering Logic

The `ChatView` component's `EventRenderer` adds chunkId-aware grouping:

1. Group consecutive events by chunkId
2. For each group, check if `sessionUpgradesAtom` has an upgrade for that chunkId
3. If yes → render `GenerativeUIRenderer` with the component tree (fade-swap animation)
4. If no → render raw events through existing components (AiBubble, ToolCallCard, etc.)
5. Events without chunkId (bypass events) always render through the existing path

### GenerativeUIRenderer

A recursive renderer that walks the `TJsonComponentTree`:

- Registry components → resolved from a local component registry to React components
- HTML elements → rendered as JSX intrinsics
- Strings → rendered as text nodes
- Interactive components receive an `onAction` callback

### Interactive Component Behavior

When a user interacts with a component (clicks a Select option, submits a Confirm), the component calls `onAction` with the interaction details. A deterministic translation utility converts the interaction to stdin bytes:

| Interaction | Translation |
|-------------|-------------|
| Select (ArrowSelect) | Arrow key sequences to navigate from `currentIndex` to selected index, then `\r` |
| Select (NumberSelect) | Number character + `\r` |
| Confirm (YesNo) | `y\r` or `n\r` |
| TextInput | Typed text + `\r` |
| Keystroke | The specified key character |

The translated bytes are sent via the existing `sendInput(sessionId, bytes)` function.

### Progressive Rendering UX

- Raw events with chunkId render normally on arrival
- When upgrade arrives: raw events fade out, component tree fades in (CSS transition)
- A small "Interactive" indicator appears on upgraded chunks
- "Show Raw" toggle lets users see original text
- If no upgrade arrives: raw events stay as-is, no visual indication

### History Replay

When a client reconnects or joins a shared session, persisted messages include both raw events and upgrade events. The client applies chunkId matching and renders the final state immediately (no animation on replay).

---

## Configuration

### Data Model

```typescript
type TGuiConfig = {
  enabled: boolean
  providerId: string      // FK to org's providers table
  model: string           // e.g., 'claude-haiku-4-5-20251001'
  maxRetries: number      // Default 2, range 0-5
  systemPrompt?: string   // Overrides InterpreterSystem default when set
}

// On organizations table:
type TOrgConfig = {
  guiConfig?: TGuiConfig
}

// On sandboxProjects junction table (existing config JSONB column):
type TSandboxProjectConfig = {
  // ... existing sandbox override fields
  guiConfig?: TGuiConfig
}
```

### Resolution Order

1. `sandboxProjects.config.guiConfig` exists → use it
2. Otherwise → fall back to `organizations.config.guiConfig`
3. Org has `enabled: false` → disabled regardless of sandbox override
4. No config at either level → disabled (default)

### Database Changes

1. **`organizations` table**: Add `config` JSONB column (nullable, default null)
2. **`sandboxProjects` table**: No migration — `config` JSONB column already exists, `guiConfig` is a new property within it
3. **`messages` table**: No migration — `content` JSONB column already stores full event payloads; enriched events have additional `chunkId` and `type: 'generative-ui'` fields

### API Endpoints

No new endpoints. Extends existing:

- `PUT /orgs/:orgId` — accepts `config.guiConfig` field
- `PUT /sandboxes/:sandboxId/config` — accepts `guiConfig` field within config

### Backend Config Resolution

When `onShellConnect` initializes, it resolves the effective `TGuiConfig`:

1. Load sandbox's project config (`sandboxProjects.config.guiConfig`)
2. If null, load org config (`organizations.config.guiConfig`)
3. If null or `enabled: false`, skip the entire generative UI pipeline (no ChunkBuffer, no interpreter)

---

## Admin UI

### Org-Level Configuration

New section in `OrgSettings.tsx` using the established `SettingsFormCard` pattern:

- **Enable/disable toggle** — switches generative UI on/off for the org
- **Provider dropdown** — populated from the org's existing linked providers
- **Model autocomplete** — filters available models based on selected provider (reuses existing model selection component)
- **Max retries** — number input, default 2, range 0-5
- **System prompt** — Monaco editor, collapsed by default, labeled "Custom System Prompt (optional)". Empty means use the `InterpreterSystem` default.

When disabled, all other fields are grayed out.

### Per-Sandbox Override

New accordion section in `SandboxDrawer.tsx`:

- **Override toggle** — "Use org default" vs "Custom config"
- When custom: same fields as org config (provider, model, retries, system prompt)
- When org default: fields disabled, showing inherited values
- **Disable override** — sandbox can explicitly disable generative UI even if org has it enabled

---

## File Changes By Repo

| Repo | Files | What |
|------|-------|------|
| **domain** | `src/types/gui.types.ts` | `TGuiConfig`, `TJsonComponentNode`, `TJsonComponentTree`, `TGenerativeUIResult` |
| **domain** | `src/constants/gui.ts` | `InterpreterSystem` prompt constant, `ComponentRegistry` list, `InteractivePatterns` regex array, `AllowedHtmlElements` list |
| **domain** | `src/types/parser.types.ts` | Update outbound event framing type to include optional `chunkId` and `timestamp` |
| **database** | `src/schemas/orgs.ts` | Add `config` JSONB column to organizations table |
| **database** | Migration | Add `config` column migration |
| **backend** | `src/services/interpreter/interpreter.ts` | InterpreterService using pi-ai `streamSimple()` |
| **backend** | `src/services/interpreter/prompt.ts` | Prompt construction |
| **backend** | `src/services/interpreter/validator.ts` | JSON tree validation |
| **backend** | `src/services/interpreter/chunkBuffer.ts` | ChunkBuffer with prompt-detection + debounce |
| **backend** | `src/services/interpreter/skipHeuristic.ts` | SkipHeuristic with InteractivePatterns |
| **backend** | `src/endpoints/sandboxes/onShellConnect.ts` | Wire ChunkBuffer + InterpreterService into event pipeline |
| **backend** | `src/endpoints/orgs/updateOrg.ts` | Accept `config.guiConfig` field |
| **backend** | `src/endpoints/sandboxes/sandboxProjectConfig.ts` | Accept `guiConfig` in config |
| **admin** | `src/pages/Orgs/OrgSettings.tsx` | GuiConfig settings section |
| **admin** | `src/components/Sandboxes/SandboxDrawer.tsx` | GuiConfig accordion section |
| **threads** | `src/state/sessions.ts` | `sessionUpgradesAtom` |
| **threads** | `src/state/accessors.ts` | Upgrade accessors |
| **threads** | `src/actions/sessions/openSession.ts` | Handle `generative-ui` upgrade events |
| **threads** | `src/components/ChatView/ChatView.tsx` | ChunkId-based grouping and upgrade rendering |
| **threads** | `src/components/ChatView/GenerativeUIRenderer.tsx` | Recursive component tree renderer |
| **threads** | `src/components/ChatView/registry/` | Select, Confirm, TextInput, Alert, ProgressBar components |
| **threads** | `src/utils/stdinTranslation.ts` | Interaction type → stdin bytes translation |

---

## Prerequisites

1. **Markdown rendering improvements in ChatView** — The `AiBubble` component must handle code blocks with syntax highlighting, tables, and nested formatting. More content flows through the markdown path since code fences and plain prose skip the interpreter.

2. **`config` JSONB column on `organizations` table** — New column, requires database migration.

## Non-Goals

1. **Cost/token tracking** — Deferred to future iteration
2. **Streaming interpreter output** — v1 waits for full response before sending upgrade event
3. **Multi-tool adapters / SDK integration** — Separate effort from the research report; complements this system
4. **Custom component authoring** — v1 has fixed registry
5. **Interpreter prompt tuning UI** — System prompt is overridable via config field, not a dedicated tuning interface
