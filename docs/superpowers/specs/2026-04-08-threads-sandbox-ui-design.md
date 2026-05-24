# Threads Sandbox UI — Design Spec

**Date**: 2026-04-08
**Status**: Draft
**Author**: Claude (brainstorming session with Lance)

## Overview

The Threads app (`repos/threads`) provides a mobile-first web UI for non-developers to interact with AI tools (Claude Code, Codex, OpenCode, Antigravity, OpenClaw) running in Threaded Stack sandboxes. It replaces the terminal-centric `tsa` CLI workflow with an intuitive chat interface, while retaining a terminal tab for power users.

### Problem

Threaded Stack sandboxes run AI coding tools in K8s pods. Today, interaction requires the `tsa` CLI (SSH, terminal). Many users — especially non-developers — want to leverage sandboxed AI tools but aren't comfortable with terminals. These users would benefit most from the safety of sandboxes but are locked out by the CLI-only interface.

### Solution

A hybrid UI: **chat view** (primary) with parsed, structured rendering of AI tool output + **terminal view** (secondary) with full PTY access via ghostty-web. The app connects to running sandbox pods through a new WebSocket shell endpoint that bridges to SSH inside the pod.

### Referenced Projects

The design is informed by five open-source projects solving similar problems:
- **Happy** (slopus/happy) — Relay server + Claude Code SDK, structured chat
- **Remodex** (Emanuele-web04/remodex) — WebSocket relay + Codex JSON-RPC, native iOS
- **CloudCLI** (siteboon/claudecodeui) — Co-located server, SDK + node-pty, chat + terminal + file browser
- **HAPI** (tiann/hapi) — Hub + CLI + PWA, Claude Code SDK + PTY, chat + terminal
- **Claude Conduit** (A-Somniatore/claude-conduit) — Local daemon, tmux + node-pty, terminal mirror

All referenced projects run AI tools on the user's local machine. ThreadedStack's key difference is running tools in managed K8s pods — the Threads app bridges this gap.

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Threads SPA)                                   │
│                                                           │
│  SandboxList ──→ SessionManager ──→ SessionView          │
│  (REST poll)         │ (Jotai)       ├─ ChatView         │
│                  WebSocket(s)        ├─ TerminalView     │
│                      │               └─ SmartInput       │
│           ┌──────────┴──────────┐                        │
│           │                     │                        │
│      ghostty-web          TerminalParser                 │
│     (Terminal tab)    (Chat tab — from @tdsk/domain)     │
└───────────┼─────────────────────────────────────────────┘
            │
        WebSocket
            │
┌───────────┼─────────────────────────────────────────────┐
│  Backend  │                                              │
│           │                                              │
│  /_/sandboxes/:id/shell (WebSocket endpoint)            │
│           │                                              │
│     Session Broker                                       │
│     ┌─────────────┐                                     │
│     │ ShellSession │                                     │
│     │  ssh2.Client ──→ pod:2222 (sshd)                  │
│     │  RingBuffer (1MB, for detached replay)            │
│     │  Set<WebSocket> (multi-tab fan-out)               │
│     │  TerminalParser (from @tdsk/domain)               │
│     │  TTL timer (5min detach timeout)                  │
│     └─────────────┘                                     │
│           │                                              │
│     Thread/Message persistence                           │
│     (parsed events → existing threads/messages tables)   │
│                                                           │
│  Existing: connectSandbox, findRunningPod,               │
│  session tracking, idle timeout — all reused             │
└──────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| UI approach | Hybrid (chat + terminal) | Chat for non-developers, terminal for power users |
| AI tool integration | Terminal parsing | Preserves existing sandbox model, works with all tools |
| Enrichment level | Moderate | Parse known patterns (Claude Code first), fallback to text |
| Input model | Smart (adaptive per tool state) | Message box, approve/deny buttons, or inline input |
| Parser location | Shared in @tdsk/domain | Used by both client (real-time) and backend (persistence) |
| Session persistence | Backend session broker + DB history | SSH survives WS disconnect; parsed events in threads/messages |
| Terminal emulator | ghostty-web | Ghostty VT parser via WASM, xterm.js-compatible API |
| Mobile strategy | Mobile-first | Target audience is non-developers, often on phones |
| Notifications | In-app (badges, toasts) | No push infrastructure for v1 |

## Connection Layer

### New Endpoint: `/_/sandboxes/:id/shell`

**Protocol**: WebSocket upgrade over HTTP

**Authentication**: Same as existing tunnel — `Authorization: Bearer <token>` header on upgrade. Supports JWT and API key (`tdsk_*`).

**Query params**:
- `cols` / `rows` — Initial terminal dimensions (default: 80×24)
- `run` — If `true`, execute `runtimeCommand` after shell is established (maps to `tsa run` vs `tsa ssh`)
- `sessionId` — If provided, reattach to an existing detached session instead of creating a new one

**Wire protocol**:
- Binary WebSocket frames: raw PTY bytes (stdin from browser, stdout/stderr from pod)
- Text WebSocket frames: JSON control messages

```typescript
// Browser → Backend (text frames)
{ type: 'resize', cols: number, rows: number }
{ type: 'signal', signal: 'SIGINT' | 'SIGTSTP' }
{ type: 'reconnect', sessionId: string }

// Backend → Browser (text frames)
{ type: 'connected', sessionId: string, sandboxId: string, runtime: string, threadId: string }
{ type: 'reconnected', sessionId: string, bufferedBytes: number }
{ type: 'disconnected', reason: string }
{ type: 'error', message: string }
```

### Session Broker

The backend maintains persistent SSH connections independently of browser WebSocket lifecycles.

```typescript
interface ShellSession {
  sessionId: string
  sshClient: ssh2.Client
  sshStream: ssh2.ClientChannel
  buffer: RingBuffer          // 1MB circular buffer for detached replay
  attachments: Set<WebSocket> // multiple tabs can attach simultaneously
  parser: TerminalParser      // shared parser from @tdsk/domain
  threadId: string            // associated thread for persistence
  userId: string
  orgId: string
  sandboxId: string
  ttlTimer: NodeJS.Timeout | null
}
```

**Lifecycle states**:

```
[no session] → attached → detached → [destroyed]
                  ↑            │
                  └────────────┘ (reconnect within TTL)
```

- **attached**: One or more WebSockets connected. SSH stream output fans out to all attached WebSockets. Input from any WebSocket goes to SSH stdin.
- **detached**: All WebSockets disconnected. SSH stays alive. PTY output buffered to ring buffer. TTL countdown starts (5 minutes).
- **destroyed**: TTL expired or pod terminated. SSH client closed, session removed from map.

**Multi-tab behavior**:
- Multiple browser tabs can attach to the same session via `?sessionId=<id>`
- SSH output fans out to all attached WebSockets (all tabs see the same stream)
- Input from any tab goes to SSH stdin (last-writer-wins, same as shared tmux)
- Ring buffer only activates when attachment count drops to zero
- TTL only starts when attachment count drops to zero

**Reconnection flow**:
1. Browser stores `sessionId` in sessionStorage on first connect
2. On page reload, sends `{ type: 'reconnect', sessionId }` as first message
3. Backend finds detached session, validates user, cancels TTL timer
4. Flushes ring buffer contents to WebSocket (everything missed during disconnect)
5. Reattaches WebSocket to session, resumes normal bridging
6. If session expired: responds with `{ type: 'error', reason: 'session_expired' }`, client creates new session

### SSH Bridge Details

- **Library**: `ssh2` (pure JS, no native addons)
- **Connection**: `podIP:2222`, username `sandbox`, password from `SandboxService.passwords` map
- **PTY**: `xterm-256color`, initial dimensions from query params
- **Resize**: `sshStream.setWindow(rows, cols)` on `resize` control message
- **Keepalive**: SSH keepalive every 15s, WebSocket ping every 30s
- **Backpressure**: Same pattern as existing tunnel — pause SSH stream when WS buffered amount > 64KB, resume when drained. Applied per-attachment for multi-tab.

## Terminal Parser

### Location: `@tdsk/domain`

The parser is pure TypeScript with zero browser dependencies. It lives in `repos/domain/src/parser/` and is imported by both the Threads frontend (real-time chat rendering) and the backend (session history persistence).

### Pipeline (4 stages)

```
Raw PTY bytes → AnsiProcessor → BlockSegmenter → PatternMatcher → EventEmitter
```

**Stage 1: AnsiProcessor**
- Strips ANSI escape sequences (SGR, cursor movement, screen clears) to get plain text
- Lightweight inline state machine (no external dependency — avoids ESM-only `strip-ansi` compatibility issues across domain consumers)
- Preserves line boundaries

**Stage 2: BlockSegmenter**
- Splits continuous text into discrete blocks: user input vs AI output
- Detects input echo by matching sent stdin against stdout
- Detects prompt readiness (tool waiting for input)
- Maintains state machine: `outputting` | `waiting` | `interactive`

**Stage 3: PatternMatcher**
- Runs tool-specific matchers against output blocks
- Registered per runtime (`ESandboxRuntime`). First match wins.
- Unmatched text becomes `{ type: 'text' }` or `{ type: 'unknown' }` — never lost

**Stage 4: EventEmitter**
- Outputs typed `ParsedEvent` objects
- Derives `ToolState` from event stream (drives SmartInput UI)

### ParsedEvent Type

```typescript
type ParsedEvent =
  | { type: 'text', content: string, timestamp: number }
  | { type: 'input', content: string, timestamp: number }
  | { type: 'tool-call', tool: string, target: string, status: 'running' | 'done', detail?: string, timestamp: number }
  | { type: 'permission', prompt: string, command?: string, timestamp: number }
  | { type: 'diff', file: string, additions: string[], removals: string[], timestamp: number }
  | { type: 'error', message: string, timestamp: number }
  | { type: 'thinking', timestamp: number }
  | { type: 'prompt-ready', timestamp: number }
  | { type: 'unknown', raw: string, timestamp: number }
```

### ToolState (derived)

```typescript
type ToolState =
  | 'idle'           // pod running, no AI tool active
  | 'prompt'         // AI tool waiting for input
  | 'working'        // AI tool processing/outputting
  | 'permission'     // AI tool waiting for y/n approval
  | 'interactive'    // subprocess expecting arbitrary input
```

### V1 Pattern Matchers (Claude Code)

| Pattern | Detection | Event Type |
|---|---|---|
| Tool call start | `⏺ ` prefix lines (Read, Edit, Write, Bash, Glob, Grep, etc.) | `tool-call` (status: running) |
| Tool call end | Completion markers after tool output | `tool-call` (status: done) |
| Permission prompt | `Allow ...?`, `Do you want to ...?`, `(y/n)` patterns | `permission` |
| Thinking state | >2s silence after user input before output starts | `thinking` |
| Error output | `Error:`, `✗`, stderr patterns | `error` |
| Diff content | `+`/`-` lines in tool call context | `diff` |
| Prompt ready | `> ` at line start after output, `$ ` shell prompt | `prompt-ready` |

Other runtimes get `unknown` fallback — all output renders as monospace text. Runtime-specific matchers added incrementally.

### Processing Behavior

- **Debounced**: Buffers output and processes in chunks (100ms intervals or on newline) to avoid thrashing
- **Never loses data**: Unclassified output becomes `unknown` with raw text preserved
- **Per-runtime extensible**: New matchers registered by runtime ID without changing pipeline

## Session History Persistence

### Data Model

Uses existing `threads` and `messages` tables. One schema addition:

**threads table**: Add `sandboxId` column (nullable FK to sandboxes):
```sql
ALTER TABLE threads ADD COLUMN sandbox_id VARCHAR(10) REFERENCES sandboxes(id) ON DELETE SET NULL;
CREATE INDEX threads_sandbox_id_idx ON threads(sandbox_id);
```

**Thread creation**: When a shell session is created, the backend creates a thread record:
```typescript
{
  name: `${sandbox.name} — ${new Date().toISOString()}`,
  sandboxId: sandbox.id,
  orgId: sandbox.orgId,
  userId: session.userId,
  projectId: sandbox.projectId,  // if project-scoped
  meta: { runtime: sandbox.config.runtime, shellSessionId: session.sessionId }
}
```

**Message persistence**: As the backend-side parser emits ParsedEvents, they are batched and inserted as message records:
```typescript
{
  threadId: session.threadId,
  orgId: session.orgId,
  type: event.type,                    // 'text', 'tool-call', 'permission', etc.
  content: event,                      // full ParsedEvent as JSONB
  projectId: sandbox.projectId,
}
```

Batching: events are buffered and flushed every 2 seconds or 20 events (whichever comes first) to avoid excessive DB writes. On session destroy (TTL expiry or pod termination), remaining buffer is flushed before cleanup.

**History retrieval**: `GET /_/threads/:threadId/messages` — existing endpoint. Returns messages in order. Client renders ParsedEvents from `content` JSONB directly — no re-parsing needed.

**Thread listing**: `GET /_/threads?sandboxId=:id` — lists all session threads for a sandbox. Enables "session history" view in the UI.

### Thread History UI

**Sidebar — expandable per sandbox**:
Each sandbox in the sidebar/home list is expandable. Tapping the expand chevron reveals past session threads:

```
▼ Claude Code          ● Running
    Current session      (live)
    Apr 8, 2:30 PM       "Add dark mode toggle"
    Apr 7, 11:00 AM      "Fix auth bug"
    Apr 6, 4:15 PM       "Refactor API layer"
▶ Codex                ○ Stopped
▶ OpenCode             ○ Stopped
```

- Thread names come from the thread `name` field (auto-generated from sandbox name + timestamp; could be enhanced with a summary of the first user message)
- Threads are listed newest-first, paginated (load more on scroll)
- Tapping a thread opens it in a **read-only chat view** — same ChatView component, SmartInput hidden
- On mobile: history list appears inline under the sandbox card, same expand/collapse pattern

**Fetching**: `GET /_/threads?sandboxId=:id` via TanStack Query. Loaded on expand (not eagerly for every sandbox). Cached with 60s stale time.

### What this enables

- Session history survives browser refresh, tab close, and pod restart
- Users can review past AI tool sessions (what was asked, what was done)
- Multiple tabs see the same history (backend is source of truth)
- Future: session resumption, branching, search, export — all built on existing thread infrastructure

## Frontend Architecture

### Tech Stack

Reuses existing threads repo scaffold:
- **Vite 5** + React 18 + TypeScript
- **MUI 6** + Emotion (theming from `@tdsk/components`)
- **Jotai** (3-layer state: atoms → accessors → selectors)
- **TanStack Query** (API caching, polling)
- **React Router v7** (routes, loaders)
- **Neon Auth** (existing auth flow, unchanged)
- **ghostty-web** (terminal emulator, new dependency)

### State Architecture Pattern

**CRITICAL**: Follows the same patterns as the admin repo:

- **Data flow**: Loaders → Actions → Jotai → Components (read-only)
- **API calls ONLY through actions** — never from components, never in useEffect
- **Components call actions** — actions call ApiService
- **No useEffect for data fetching or state syncing**
- **Route loaders** for initial data, TanStack Query `refetchInterval` for polling
- **Jotai atoms** for reactive state, accessors for imperative (outside React) access

### Code Reuse Strategy

Before building any feature in Threads:

1. **Check @tdsk/components** — Use existing shared components/hooks first
2. **Check repos/admin** — If admin has the feature, extract to @tdsk/components or @tdsk/domain
3. **Build new in Threads** — Only if nothing exists to extract

Specific extraction candidates:
- Status indicator components (running/idle/stopped dots)
- Card/list layout patterns
- Loading/error state components
- WebSocket management utilities (if admin has any)
- API action patterns (pagination, polling)

**Rule**: Never duplicate code between admin and threads. Extract first, then import.

### Route Structure

```
/                    → Home (sandbox list on mobile, redirect on desktop)
/session/:sandboxId  → Session view (chat/terminal)
/settings            → User settings
/auth/:pathname      → Login (existing)
```

### Component Hierarchy

```
App
├── AuthProvider (existing)
├── QueryClientProvider (existing)
├── SessionManager (new — Jotai state, manages WS connections)
│
├── [Mobile: < 768px]
│   ├── SandboxList (home)
│   │   ├── OrgSelector
│   │   ├── OpenSessionStrip (horizontal scrollable pills)
│   │   └── SandboxCard[] (status, runtime icon, tap to open)
│   │       └── ThreadHistory (expandable — past session threads)
│   │           └── ThreadItem[] (name, date, tap to view)
│   └── SessionView (stack-pushed)
│       ├── SessionHeader (back, title, chat/term toggle)
│       ├── ChatView | TerminalView | ThreadHistoryView (read-only)
│       └── SmartInput
│
├── [Desktop: >= 768px]
│   ├── Sidebar
│   │   ├── OrgSelector
│   │   └── SandboxTree (list with status dots)
│   │       └── ThreadHistory (expandable per sandbox)
│   │           └── ThreadItem[] (name, date, click to view)
│   ├── SessionTabs (tab bar with status + badges)
│   └── SessionView (fills remaining space)
│       ├── ViewToggle (chat / terminal)
│       ├── ChatView | TerminalView | ThreadHistoryView (read-only)
│       └── SmartInput
```

### SessionManager (Jotai State)

```typescript
// Atoms
sessionConnectionsAtom    // Map<sandboxId, WebSocket>
sessionParsersAtom        // Map<sandboxId, TerminalParser>
sessionEventsAtom         // Map<sandboxId, ParsedEvent[]>
sessionToolStateAtom      // Map<sandboxId, ToolState>
sandboxStatusAtom         // Map<sandboxId, SandboxStatus>
openSessionsAtom          // Set<sandboxId> (drives tabs/pills)

// Actions (imperative — called by components via action functions)
openSession(sandboxId)        // POST /connect → open WS → create parser
closeSession(sandboxId)       // Tear down WS, remove from maps
sendInput(sandboxId, text)    // Binary write to WS (stdin)
sendControl(sandboxId, msg)   // JSON text frame (resize, signal)
approvePermission(sandboxId)  // sendInput('y\n')
denyPermission(sandboxId)     // sendInput('n\n')
loadThreadHistory(sandboxId)  // GET /threads?sandboxId → populate history atom
viewThread(threadId)          // GET /threads/:id/messages → open read-only view

// Selectors (hooks — used by components)
useSessionEvents(sandboxId)
useToolState(sandboxId)
useSandboxStatus(sandboxId)
useOpenSessions()
useThreadHistory(sandboxId)   // Past threads for a sandbox
useThreadMessages(threadId)   // Messages for a specific thread (read-only view)
```

### ChatView

Renders `ParsedEvent[]` from session events:

| Event Type | Render |
|---|---|
| `input` | Right-aligned user bubble |
| `text` | Left-aligned AI bubble with markdown (react-markdown) |
| `tool-call` | Collapsible card — icon, tool name, target, status badge |
| `permission` | Highlighted card with approve/deny buttons (if active) |
| `diff` | Expandable diff view with green/red lines |
| `error` | Red-bordered error card |
| `thinking` | Animated thinking indicator |
| `prompt-ready` | (implicit — drives SmartInput state change) |
| `unknown` | Monospace text block (graceful fallback) |

- Auto-scrolls to bottom on new events
- Virtualized list for long sessions (hundreds of events)
- On session open with history: fetches thread messages from API, renders immediately

### TerminalView

- **ghostty-web**: `init()` called once at app startup (WASM load during auth/splash)
- Terminal created lazily when user switches to terminal tab
- Shares WebSocket with ChatView — both read from same stream
- On first mount: replays buffered raw data from ring buffer flush
- Hidden (not unmounted) when switching to chat — preserves scrollback
- `FitAddon` from ghostty-web for auto-resize

### SmartInput

Adapts based on `useToolState(sandboxId)`:

| Tool State | Input UI |
|---|---|
| `idle` | Message box + "Start runtime" button |
| `prompt` | Message box + send button |
| `working` | Disabled input, "Working..." indicator, stop button (Ctrl+C) |
| `permission` | Approve/Deny buttons with command preview |
| `interactive` | Inline text input with monospace font, direct keystroke passthrough |

### Sandbox List & Status Polling

- `GET /_/sandboxes` (org-scoped) via TanStack Query, `refetchInterval: 30_000`
- Loaded via route loader (not useEffect)
- Drives sidebar (desktop) and home screen (mobile)
- Status dots: green (running), amber (needs permission), gray (idle), dark (stopped)
- For open sessions: real-time status from parser's ToolState (no polling needed)

### Smart Start Flow

**Running sandbox tapped**:
1. Immediately open WebSocket to `/_/sandboxes/:id/shell?run=true`
2. Session tab opens within 1-2s (SSH handshake)

**Stopped sandbox tapped**:
1. Show confirmation card: name, runtime, "Start" button
2. User taps Start → `POST /_/sandboxes/:id/connect`
3. "Starting..." indicator
4. Poll `GET /_/sandboxes/:id/status` every 2s
5. Pod Running → open WebSocket with `?run=true`
6. Session tab opens

### Responsive Layout

- **< 768px (mobile)**: Stack navigation. Home = sandbox list. Session = full-screen pushed view. Open sessions as horizontal pill strip on home. No sidebar.
- **>= 768px (desktop)**: Sidebar + tabs + session panel. IDE-style layout. Sidebar = sandbox tree. Tabs = open sessions. Session panel = chat/terminal + smart input.

Same components render in both layouts — only the container/navigation wrapper changes.

### Notifications (In-App)

- **Tab badges**: Status dot color + `!` badge when tool needs permission
- **Sidebar dots**: Match tab badge colors
- **Toasts**: via sonner (already in threads). Shown for: permission requests, errors, session disconnects
- **Open session pills** (mobile): amber + `!` badge for attention needed

## Backend Changes

### New Files

| File | Purpose | Est. Lines |
|---|---|---|
| `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` | WebSocket shell endpoint + session broker | ~250 |

### Modified Files

| File | Change | Est. Lines |
|---|---|---|
| `repos/backend/src/endpoints/sandboxes/sandboxes.ts` | Route registration for `/shell` | ~2 |
| `repos/backend/src/services/sandboxes/sandbox.ts` | ShellSession map, ring buffer, TTL management | ~100 |
| `repos/backend/package.json` | Add `ssh2` dependency | ~1 |

### Database Changes

| Change | Details |
|---|---|
| Add `sandbox_id` column to `threads` | `VARCHAR(10)`, nullable FK to `sandboxes(id)`, `ON DELETE SET NULL` |
| Add index | `threads_sandbox_id_idx` |

### New Shared Code (repos/domain)

| Path | Purpose | Est. Lines |
|---|---|---|
| `repos/domain/src/parser/ansiProcessor.ts` | ANSI escape stripping | ~60 |
| `repos/domain/src/parser/blockSegmenter.ts` | Input/output block splitting | ~80 |
| `repos/domain/src/parser/patternMatcher.ts` | Tool-specific pattern matching | ~120 |
| `repos/domain/src/parser/terminalParser.ts` | Pipeline orchestrator + event emitter | ~80 |
| `repos/domain/src/parser/matchers/claudeCode.ts` | Claude Code pattern matchers | ~100 |
| `repos/domain/src/parser/types.ts` | ParsedEvent, ToolState types | ~40 |
| `repos/domain/src/parser/index.ts` | Barrel export | ~10 |

### New Dependencies

| Package | Where | Purpose |
|---|---|---|
| `ssh2` | backend | Server-side SSH client |
| `ghostty-web` | threads | Terminal emulator (WASM) |
| *(none — inline ANSI state machine)* | domain | ANSI escape removal (no external dep) |

### Proxy Changes

None expected. The proxy already forwards WebSocket upgrades for `/_/*` paths to the backend. The `/shell` endpoint follows the same pattern as `/tunnel`.

### What Does NOT Change

- Container image / entrypoint — pod's sshd unchanged
- Sandbox domain model — no new types on Sandbox class
- K8s pod manifests — no new ports or RBAC
- Existing tunnel endpoint — still works for `tsa` CLI users
- Existing connect/status/exec endpoints — unchanged

## Scope

### V1 (This Spec)

- WebSocket shell endpoint with session broker (multi-tab, reconnect, ring buffer)
- Terminal parser in @tdsk/domain (Claude Code matchers, fallback for others)
- Session history via threads/messages tables (backend-side persistence)
- Thread history UI — expandable per sandbox in sidebar, read-only chat view for past threads
- Threads frontend: sandbox list, session tabs, chat view, terminal view, smart input
- Mobile-first responsive layout (< 768px stack nav, >= 768px IDE layout)
- Smart start (auto if running, confirm if stopped)
- In-app notifications (badges, toasts)
- ghostty-web terminal emulator
- Admin state patterns (loaders → actions → Jotai → components)
- Component extraction from admin → components/domain repos where applicable

### V2 (Future)

| Feature | Notes |
|---|---|
| File browser | New API to list/read pod filesystem |
| Push notifications | Service worker + web push backend |
| Pattern matchers for Codex/OpenCode/Antigravity/OpenClaw | Per-tool research needed |
| Voice input | Microphone → transcription |
| Sandbox creation/configuration | Currently admin-only |
| Chat export / sharing | Export thread as markdown/JSON |
| Native mobile app | React Native, if PWA is insufficient |
| Session search | Full-text search across thread messages |
| Thread resumption | Capture AI tool session ID, resume with `--resume` flag when pod alive |
| Persistent volumes | Session files survive pod restart — enables resume without live pod |

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Terminal parsing fragility | Fallback to `unknown` ensures nothing lost. Terminal tab is always available. Matchers are isolated — broken matcher degrades gracefully. |
| ghostty-web WASM loading on slow mobile | 400KB — load during auth/splash. Cache via service worker. |
| Ring buffer memory | 1MB cap per session, 5min TTL. Self-limiting. Monitor in production. |
| ssh2 stability | Mature library, widely used. 15s keepalive. Backend monitors close events. |
| AI tools changing output format | Matchers are versioned per runtime. Unknown output falls back to text. Parser pipeline is hot-swappable. |
| Multi-tab input conflicts | Last-writer-wins (same as shared tmux). Acceptable for v1 — users rarely type simultaneously from two tabs. |
