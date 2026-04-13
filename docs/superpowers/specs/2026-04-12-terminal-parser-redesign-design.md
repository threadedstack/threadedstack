# Terminal Parser Redesign — Design Spec

**Date:** 2026-04-12
**Status:** Draft
**Scope:** Replace the brittle regex-based terminal parser with ghostty-web's WASM VT parser running headlessly on the server.

## Problem

The current terminal parser in `repos/domain/src/parser/` uses a stateless regex (`AnsiRegEx`) to strip ANSI escape sequences, then splits on newlines and runs pattern matchers. This approach is fundamentally brittle:

- **Split sequences across network chunks** — SSH/WebSocket streams split escape sequences across `write()` calls. The regex sees partial sequences, leaves garbage in output.
- **Carriage return blindness** — Progress bars and spinners use `\r` to overwrite lines. The parser doesn't interpret `\r`, producing garbled blocks like `Loading...\rDone!`.
- **Whitespace destruction** — `BlockSegmenter.trim()` strips all leading/trailing whitespace, destroying indentation in code output.
- **Incomplete sequence corruption** — OSC sequences without terminators consume all subsequent text.
- **No cursor awareness** — Cursor movement (CSI A/B/C/D/H), screen clears, and alternate screen are invisible to the regex.

These are not fixable with better regexes. Terminal output is a stateful byte stream that mutates a 2D cell grid — it requires a terminal emulator to interpret correctly.

## Solution

Replace the ANSI stripping layer with ghostty-web's WASM VT parser (`ghostty-vt.wasm`, 413KB). This is the same parser that powers the Ghostty native terminal and is already a dependency for frontend terminal rendering in the threads SPA. Running it headlessly on the server via `WebAssembly.compile/instantiate` gives us a battle-tested VT state machine with zero new dependencies.

A prototype (`scripts/ghostty-headless-prototype.mjs`) validated this approach: 36/36 tests passing across split sequences, CR overwrites, cursor movement, dirty-row tracking, Unicode/CJK, OSC handling, alternate screen detection, and 100 concurrent terminal instances at negligible memory cost.

## Architecture

```
Raw PTY bytes (from SSH/WebSocket)
         │
         ▼
┌─────────────────────────┐
│  GhosttyVT (WASM)       │  Layer 1: Virtual Terminal
│  - Full VT state machine │
│  - 80x24 cell grid       │
│  - Zero scrollback        │
│  - Dirty-row tracking     │
└────────┬────────────────┘
         │ Changed rows (clean text)
         ▼
┌─────────────────────────┐
│  ChangeDetector          │  Layer 2: Change Detection
│  - Extracts dirty rows   │
│  - Tracks cursor/newline  │
│  - Emits sealed lines     │
│  - Filters CR overwrites  │
└────────┬────────────────┘
         │ Completed text lines
         ▼
┌─────────────────────────┐
│  PatternMatcher          │  Layer 3: Event Classification
│  - Plugin matcher sets    │
│  - Runtime-specific       │
│  - Claude Code first      │
│  - Extensible registry    │
└────────┬────────────────┘
         │ Typed events (TParsedEvent)
         ▼
   ┌─────┴─────┐
   │           │
Persist    WebSocket
(DB)       (raw + events → client)
```

### Layer 1: GhosttyVT (WASM Virtual Terminal)

The WASM module is loaded once at process startup via `WebAssembly.compile` + `instantiate`. Each SSH session creates a lightweight terminal handle (~50KB with zero scrollback). Raw PTY bytes are fed via `write()`, and the full Paul Williams VT state machine processes them — maintaining cursor position, cell attributes, scroll regions, alternate screen, and all VT100/VT220/xterm sequences.

**Initialization:** Each new terminal receives a screen-clear sequence (`\x1b[2J\x1b[H`) immediately after creation. This fills all cells with spaces, preventing stale data from the WASM allocator reusing freed memory (validated in prototype).

**Memory at scale:** 80x24 grid × 16 bytes/cell = ~30KB per terminal. With WASM overhead and zero scrollback, ~50KB per session. At 200+ concurrent sessions: ~10MB total.

**Resize:** When the client resizes, `terminal.resize(cols, rows)` updates the grid. The WASM handles reflow.

### Layer 2: ChangeDetector

Replaces `BlockSegmenter`. Uses ghostty's dirty-row API to detect what changed after each `write()`, and decides when to emit lines to the pattern matcher.

**Line states:**

- **Clean** — row unchanged since last `markClean()`
- **Active** — row is dirty, cursor is currently on it. May still be overwritten by CR. Not emitted.
- **Sealed** — cursor has moved to a different row. Final content extracted and emitted.

**Algorithm per write():**

1. `terminal.update()` — sync render state
2. `terminal.getCursor()` — get current cursor position
3. For each dirty row:
   - Row is NOT cursor's current row → **seal it** (extract text, emit to pattern matcher)
   - Row IS cursor's current row → **mark active** (emit `activity` event instead)
4. `terminal.markClean()` — reset dirty flags

**Key behaviors:**

- **Progress bars / spinners:** CR overwrites keep updating the active row. Only when `\n` moves the cursor does the final content get sealed. Intermediate frames are never emitted.
- **Normal output:** Each `\n` seals the previous line immediately. No delay.
- **Activity detection:** When dirty rows exist but no lines are sealed (spinner updating), a single `activity` event is emitted per `write()` call. Rapid spinner frames may produce multiple `activity` events, but each is lightweight (no content payload) and the client treats them idempotently — any `activity` event means "show loading." This replaces the timer-based `thinking` detection — it's driven by actual terminal output, not arbitrary delays.
- **Flush on disconnect:** `flush()` seals the active row regardless of cursor position.

### Layer 3: PatternMatcher (Registry)

The existing `PatternMatcherPipeline` is preserved. The change is a plugin-style registry instead of a hardcoded map:

```typescript
const matcherRegistry = new Map<string, TPatternMatcher[]>()
matcherRegistry.set('claude-code', claudeCodeMatchers)
// Future: matcherRegistry.set('codex', codexMatchers)
```

The `TPatternMatcher` interface is unchanged. First match wins, fallback to `text` event. Claude Code matchers are the initial implementation; other runtimes added incrementally.

## Server → Client Protocol

Parsing happens **server-side only**. The client drops its parser. The existing WebSocket carries two frame types:

| Frame Type | Format | Purpose |
|-----------|--------|---------|
| Binary | Raw PTY bytes | Fed to ghostty-web `Terminal.write()` for rendering |
| Text (JSON) | `{ sessionId, event: TParsedEvent }` | Parsed events for chat UI state |

Raw bytes are forwarded immediately (no latency). Parsed events follow sub-millisecond later. If a write produces no sealed lines (spinner frame), no text frame is sent — only `activity` events.

The client receives:
- Binary frames → ghostty-web terminal rendering (unchanged)
- Text frames → Jotai state atoms → chat UI components

## State Management

Tool state tracking (`TToolState`) and tool-call completion detection move from the parser to the backend session handler (`onShellConnect.ts`). The session handler is the only component that sees both user input (forwarded to the pod) and parsed output events.

**Responsibilities:**

| Concern | Owner |
|---------|-------|
| VT parsing + change detection | `TerminalParser` (domain) |
| Pattern matching → events | `TerminalParser` (domain) |
| Tool state machine (`TToolState`) | Session handler (backend) |
| Tool-call completion tracking | Session handler (backend) |
| Raw byte forwarding | Session handler (backend) |
| Event → WebSocket text frames | Session handler (backend) |
| Event buffering → DB persistence | Session handler (backend) |

## Persistence

Both raw PTY bytes and parsed events are persisted per session.

| Data | Storage | Purpose |
|------|---------|---------|
| Raw PTY buffer | Session/thread record (blob) | ghostty-web replay on reconnect |
| Parsed events | Thread messages (structured JSON) | Chat UI history, search, RAG |

**Event grouping for messages:** Events accumulate in a buffer. On natural boundaries (`prompt-ready`, `permission`, session disconnect), the buffer is flushed as a single thread message:
- `role: 'assistant'`
- `content`: Clean text (concatenated `text` events)
- `metadata`: Structured event data (tool calls, diffs, errors) as JSON

**Raw PTY buffer** is stored as a `bytea` column (`pty_buffer`) on the `threads` table. Each shell session creates a thread (with `shellSessionId` in `meta`), and on SSH stream close the backend calls `parser.getRawBuffer()` and persists the raw bytes to the thread record. On reconnect, if the in-memory ring buffer is empty (session was cleaned up), the PTY buffer is loaded from the thread record and sent to the client as a binary frame for ghostty-web replay.

**Replay on reconnect:**
1. Load raw PTY buffer → feed to ghostty-web for terminal state restoration
2. Load structured messages → render chat history
3. Resume live streaming

## Module Layout

```
repos/domain/src/parser/
├── ghosttyVT.ts            # NEW — WASM singleton, terminal handle wrapper
├── changeDetector.ts        # NEW — replaces blockSegmenter.ts
├── terminalParser.ts        # REWRITTEN — orchestrator (no timers, no state)
├── patternMatcher.ts        # KEPT — minor refactor for registry
├── matchers/
│   ├── claudeCode.ts        # KEPT — existing regexes work on clean text
│   └── index.ts             # NEW — matcher registry
├── ansiProcessor.ts         # DELETED
└── blockSegmenter.ts        # DELETED
```

**`ghosttyVT.ts`** exports:
- `GhosttyVT.init()` — load WASM, return singleton
- `GhosttyVT.createTerminal(cols, rows)` — return `VTerminal` handle
- `VTerminal.write(data)` / `getDirtyRows()` / `getLineText(row)` / `getCursor()` / `isAlternateScreen()` / `markClean()` / `free()`

**`changeDetector.ts`** exports:
- `ChangeDetector` class — tracks active row, seals completed lines, emits `activity` for unsealed dirty rows

**`terminalParser.ts`** exports:
- `TerminalParser` class — owns VTerminal + ChangeDetector + PatternMatcherPipeline. `write()` / `flush()` / `getRawBuffer()`

## Type Changes

In `repos/domain/src/types/parser.types.ts`:

**Added:**
- `{ type: 'activity'; timestamp: number }` to `TParsedEvent` union

**Modified:**
- `{ type: 'input'; content: string; userId: string; timestamp: number }` — input events are now **server-generated** (not client-side). The `userId` field is required and always set by the backend session handler, enabling attribution when multiple users share a session.
- `TTerminalParserOpts` — remove `debounceMs`, `thinkingDelayMs` (no timers in parser)

**Removed:**
- `TBlock` — no longer needed
- `TSegmenterState` — no longer needed

## Input Events & Control Messages

Input events are generated **server-side** in `onShellConnect.ts`, not by the client. This was a design change during implementation to support multi-session sharing — the server is the only component that knows which user sent which input.

**Input buffering** (`wireWebSocket`):
- Raw binary frames from the client are buffered per-WebSocket
- On newline (`\n`), each non-empty line becomes an `input` event with `userId` set to the WebSocket's authenticated user
- Control characters (`\x03` Ctrl+C, `\x1a` Ctrl+Z, `\x1b` ESC) reset the buffer (abandoned line)
- Buffer caps at 4KB; `\r\n` is normalized to `\n`

**Permission-response control message** (`TShellControlMsg`):
- `{ type: 'permission-response', response: 'y' | 'n' }` — client sends this when approving/denying a tool permission prompt
- The backend writes the response character + newline to the SSH stream: `session.sshStream.write(\`${msg.response}\\n\`)`
- This replaces direct stdin input for permission prompts, giving the UI explicit control

## Migration (Per Repo)

**repos/domain:**
- Delete `ansiProcessor.ts`, `blockSegmenter.ts`
- Add `ghosttyVT.ts`, `changeDetector.ts`
- Rewrite `terminalParser.ts`
- Refactor `matchers/` for registry pattern
- Update types, constants
- Add `ghostty-web` as dependency (currently only threads has it)
- Rewrite parser tests

**repos/backend:**
- `onShellConnect.ts` gains: tool state machine, tool-call completion tracking, text frame emission, event buffering for persistence, raw PTY buffer persistence
- Remove debounce/thinking timer config from parser construction

**repos/threads:**
- Remove `TerminalParser` from `openSession.ts`
- Add text-frame handler dispatching `TParsedEvent` to Jotai state
- Chat UI reads events from atoms
- ghostty-web rendering unchanged

**repos/database:**
- Add `ptyBuffer` column (`bytea`, nullable) to `threads` table schema
- Add `ptyBuffer` property to Thread domain model

## No Backwards Compatibility Needed

The parser is internal — no external consumers. All consuming repos are in this monorepo and updated together.
