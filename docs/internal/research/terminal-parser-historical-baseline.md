# Terminal Output → AST → UI: Historical Baseline

**Purpose:** a complete, self-contained record of everything ThreadedStack built, tried, and learned while converting raw terminal (PTY) output into a parsed AST and then into a GUI. It is the input for a fresh implementation in a separate module. It records what was done and how it was intended to work, not a verdict on the outcome.

**Source of truth:** the ThreadedStack monorepo (`repos/domain`, `repos/backend`, `repos/threads`), git history from April 12 to July 12, 2026, and the deleted design docs recoverable with `git show <commit>:<path>` (see Appendix A).

---

## 0. One-page summary

Five successive approaches were built in roughly five weeks, each replacing the last:

| # | Date | Approach | Where it ran | Emulator | Semantic layer | Fate |
|---|---|---|---|---|---|---|
| 1 | pre 04-12 | Regex ANSI strip + line splitter + regex matchers | server (domain lib) | none | regex per line | replaced (unfixable failure modes) |
| 2 | 04-12 | Headless VT emulator + dirty-row change detector + regex matchers, server parses and multiplexes typed events over WS | server | ghostty-web WASM | regex per sealed line | replaced 3 days later |
| 3 | 04-13 | Same as 2 plus an LLM "interpreter" that upgrades text chunks into a JSON React component tree | server | ghostty-web WASM | LLM + skip heuristic | code still on disk, never wired to a caller |
| 4 | 04-15 | Fully deterministic client-side pipeline: cell grid → tokenizer → parser → 16-node AST → visitors → React; backend becomes a byte pipe | browser | ghostty-web WASM | geometric + scored pattern matchers on the 2D grid | the design that survived; unit tests pass, live rendering never produced visible output; slated for removal and reimplementation |
| 5 | 05-14 | Same pipeline, emulator swapped to @xterm/headless by re-packing xterm cells into the same 16-byte cell layout | browser | @xterm/headless 6.0.0 | unchanged | current state on disk |

The through-line: **terminal output is a stateful byte stream mutating a 2D cell grid, so a real VT emulator is mandatory**, and **the semantic information needed for interactive UI lives in the 2D grid (colors, highlight blocks, borders, cursor position), not in 1D text lines**. Approach 4 is the first one that acted on the second insight, and its geometry-based tokenizer and scored matchers are the most reusable pieces.

---

## 1. Problem statement (as originally framed)

ThreadedStack runs third-party AI coding tools (Claude Code, Codex, OpenCode, custom) inside remote K8s sandbox pods. A browser SPA ("threads") attaches to the pod's PTY over WebSocket. The goal was to show that session as an interactive, structured UI (chat feed, action cards, clickable prompts, diffs) rather than a raw terminal, for a target user described in the 04-15 spec as "non-technical: PMs, designers, executives who want oversight, collaboration, and review of sandbox sessions without touching a terminal."

Constraints that shaped every design:

- The tool runs in a **remote pod over SSH/WebSocket**, so approaches that spawn the tool locally with structured-output flags do not apply directly.
- Must be **runtime-agnostic**: build logs, TUI apps, plain shell commands, and any AI tool should all be first-class.
- The raw terminal view must always remain available and correct.
- Multiple users can attach to one session (shared sessions), so input attribution matters.

---

## 2. Generation 1: regex pipeline (baseline that failed)

Location at the time: `repos/domain/src/parser/` (recover with `git show 24661f85^:repos/domain/src/parser/<file>`).

### 2.1 Pipeline

```
raw chunk → stripAnsi (single regex) → BlockSegmenter (split on \n, trim) → PatternMatcherPipeline (first regex match wins) → TParsedEvent
```

- `ansiProcessor.ts`: `str.replace(AnsiRegEx, '')` with

  ```
  /[\u001B\u009B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><~]|\x1b\][^\x07]*\x07|\x1b[^[\]()#;?0-9A-ORZcf-nq-uy=><~]/g
  ```

  (CSI, BEL-terminated OSC, and single-char escapes only).
- `blockSegmenter.ts`: buffer, split on `\n`, keep the partial tail, `.trim()` every line, drop empties, classify `input` vs `output` by checking a `pendingSent` set of echoed user input, flip to `waiting` state when the tail matches `PromptRegEx = /^[>$#] $/`.
- `patternMatcher.ts`: ordered `TPatternMatcher[] = { name, match(text) → event | null }` per runtime, hardcoded map `{ 'claude-code': claudeCodeMatchers }`.
- `terminalParser.ts`: orchestrator with 100 ms debounce, a 2000 ms **timer-based "thinking" event**, input tracking, an unbounded raw buffer, and the tool-state machine.

### 2.2 Event and state types

```ts
TParsedEvent =
  | { type:'text'; content }        | { type:'input'; content }
  | { type:'tool-call'; tool; target; status:'running'|'done'; detail? }
  | { type:'permission'; prompt; command? }
  | { type:'diff'; file; additions[]; removals[] }
  | { type:'error'; message }       | { type:'thinking' }
  | { type:'prompt-ready' }         | { type:'unknown'; raw }
TToolState = 'idle' | 'prompt' | 'working' | 'permission' | 'interactive'
```

Tool state transitions: `tool-call → working`; `text|diff → interactive if lastRunningTool === 'Bash' else working`; `thinking → working`; `permission → permission`; `prompt-ready|error → prompt`. A running tool-call was marked `done` when the next `tool-call | prompt-ready | permission | error` arrived.

### 2.3 Claude Code matchers (carried through all generations)

```ts
CCToolCallRegEx          = /^⏺\s+(Read|Edit|Write|Bash|Glob|Grep|Agent|TodoWrite|WebFetch|WebSearch)\s+(.+)$/
CCPermissionYNRegEx      = /(?:Allow|Do you want to)\s+(.+?)\s*\?\s*\(y\/n\)/i
CCPermissionProceedRegEx = /Do you want to proceed\?\s*\(y\/n\)/i
CCErrorPrefixRegEx       = /^Error:\s+(.+)/
CCErrorCrossRegEx        = /^✗\s+(.+)/
CCPromptPatternRegEx     = /^[>$❯]\s*$/        // ❯ added in gen 2
CCDiffAddRegEx           = /^\+\s+(.+)/
CCDiffRemoveRegEx        = /^-\s+(.+)/
```

Matcher order: tool-call, permission, error, prompt-ready, diff. Diff matches emitted one event per line with `file: ''` (never aggregated into hunks).

### 2.4 Why it was abandoned (five named failure modes)

1. **Split sequences across network chunks**: an escape sequence cut between two `write()` calls never matches; garbage leaks into text.
2. **Carriage-return blindness**: `Loading...\rDone!` is treated as one line; spinner and progress-bar frames all leak.
3. **Whitespace destruction**: `.trim()` removed code indentation.
4. **Incomplete sequence corruption**: an unterminated OSC eats all following text.
5. **No cursor awareness**: CSI cursor moves, screen clears, and alternate screen are invisible.

Design-doc verdict: "These are not fixable with better regexes. Terminal output is a stateful byte stream that mutates a 2D cell grid, it requires a terminal emulator to interpret correctly."

---

## 3. Generation 2: headless VT emulator on the server (2026-04-12)

Commit `24661f85`. Spec and plan: `docs/superpowers/specs/2026-04-12-terminal-parser-redesign-design.md`, `docs/superpowers/plans/2026-04-12-terminal-parser-redesign.md` (both at that commit).

### 3.1 Prototype validation

A never-committed script `scripts/ghostty-headless-prototype.mjs` proved the approach first: 36/36 tests across split sequences, CR overwrites, cursor movement, dirty-row tracking, Unicode/CJK, OSC handling, alternate-screen detection, and 100 concurrent terminal instances at negligible memory. Two prototype findings became production rules:

- Write `\x1b[2J\x1b[H` immediately after creating a terminal, because the WASM allocator reuses freed memory and fresh terminals otherwise contain stale cells.
- Memory budget: 80×24 cells × 16 bytes ≈ 30 KB grid, ≈ 50 KB per terminal with overhead, ≈ 10 MB at 200 sessions. Zero scrollback so the viewport is the whole buffer.

### 3.2 Three-layer architecture

```
raw PTY bytes → GhosttyVT (WASM VT, 80×24, zero scrollback, dirty rows)
             → ChangeDetector (sealed lines, CR filtering, activity events)
             → PatternMatcherPipeline (per-runtime plugin registry)
             → TParsedEvent → { DB persistence, WebSocket text frames }
```

**Layer 1: `ghosttyVT.ts`** wrapped `ghostty-web@0.4.0`'s `ghostty-vt.wasm` (413 KB), loaded once per process as a singleton (`GhosttyVT.init()`), instantiated with one import `env.log`. Public handle:

```ts
type VTerminal = {
  readonly cols: number; readonly rows: number
  write(data: string | Uint8Array): void
  resize(cols, rows): void
  update(): void
  getDirtyRows(): number[]
  getLineText(row): string          // codepoint 0 → ' ', then trimEnd()
  getCursor(): { x; y; visible }
  isAlternateScreen(): boolean
  markClean(): void
  free(): void
}
```

WASM ABI used: `ghostty_terminal_new_with_config/free/write/resize/is_alternate_screen`, `ghostty_render_state_update/get_cursor_x/get_cursor_y/get_cursor_visible/is_row_dirty/mark_clean/get_viewport`, `ghostty_wasm_alloc_u8_array/free_u8_array`. Config struct: 80 bytes, zero-filled (`scrollback(4) + fg(4) + bg(4) + cursor(4) + palette(16×4)`). Cell struct: 16 bytes, `codepoint u32 @0, fg u32 @4, flags u32 @8, unused @12`; style flags at bit 16 (bold, `0x10000`) and bit 17 (italic, `0x20000`) of the flags word (verified by a probe test, `cellLayout.probe.test.ts`). Implementation details worth keeping: viewport copied once per process cycle and cached until the next `write`/`resize`; `DataView` rebuilt on every read against `memory.buffer` to survive WASM memory growth; a `_freed` flag makes every method a silent no-op after `free()`.

**Layer 2: `changeDetector.ts`** replaced the line splitter with a **line lifecycle** driven by dirty rows and cursor position:

- *Clean*: unchanged since `markClean()`.
- *Active*: dirty and the cursor is on it. May still be CR-overwritten. Never emitted as a line.
- *Sealed*: the cursor has moved off it. Final content read and emitted once.

```ts
process() {
  dirtyRows = terminal.getDirtyRows(); if (!dirtyRows.length) return
  cursor = terminal.getCursor()
  for row of dirtyRows:
    if row === cursor.y: cursorRowDirty = true; continue
    text = terminal.getLineText(row); if text: onSealedLine(text); sealedAny = true
  if cursorRowDirty:
    active = getLineText(cursor.y)
    active ? onActiveRow(active) : (!sealedAny && onActivity())
  else if !sealedAny && dirtyRows.length: onActivity()
  terminal.markClean()
}
flush() { seal the cursor row regardless (used on disconnect) }
```

Consequences: spinner and progress-bar frames never reach the matcher (only the final row content when the cursor leaves it); normal `\n` output seals immediately with no timer; "thinking" detection became an output-driven `activity` event with no payload ("any activity event means show loading").

The `onActiveRow` callback existed so `prompt-ready` and `permission` could be recognized on the **unsealed** cursor row (the prompt never gets a `\n`). The orchestrator ran `pipeline.tryMatch(activeText)` and emitted the match if it was anything other than `text`.

**Layer 3: `patternMatcher.ts`** kept the matcher contract and swapped the hardcoded map for a registry: `getMatchers(runtime)` / `registerMatchers(runtime, matchers)`.

**Orchestrator `terminalParser.ts`**: no timers, no input tracking, no tool state. `write()` appends to a 10 MB capped raw buffer, writes to the VT, runs `detector.process()` synchronously. API: `write, flush, getRawBuffer(): Uint8Array, resize, isAlternateScreen, destroy`.

**`deriveToolState.ts`**: the state machine extracted as a pure function `(event, { lastRunningTool }) → TToolState | null` (null = no transition), shared by backend and browser via a web-safe `parser/web.ts`. `input` deliberately returns `null` so user typing never changes tool state.

### 3.3 Server-side integration and wire protocol

Parsing ran **only on the server** in `onShellConnect.ts`. One WebSocket carried both:

| Direction | Frame | Payload |
|---|---|---|
| server → client | binary | raw PTY bytes, forwarded immediately (rendered by the client's terminal) |
| server → client | text | `{ sessionId, event: TParsedEvent }` (sub-millisecond after the bytes) |
| server → client | text | status: `connected`, `reconnected { bufferedBytes, visibility }`, `joined`, `user-joined`, `user-left`, `visibility`, `error`, `disconnected` |
| client → server | binary | stdin bytes |
| client → server | text | `TShellControlMsg`: `resize {cols,rows}` (also resizes the server VT), `signal SIGINT|SIGTSTP`, `visibility`, `permission-response { response: 'y'|'n' }` → writes `y\n`/`n\n` |

Session handler responsibilities (moved out of the parser because "the session handler is the only component that sees both user input and parsed output events"): tool-state machine, tool-call completion (synthetic `status:'done'` event when the next `tool-call | prompt-ready | permission | error` arrives), event batching for persistence, broadcast.

**Server-generated `input` events**: client keystrokes were buffered per socket (4 KB cap; `\x03`/`\x1a` clear the buffer as an abandoned line; CR/CRLF normalized) and on newline emitted as `{ type:'input', content, userId }` so shared sessions could attribute chat bubbles. This was a mid-implementation design change to support multi-user sessions.

**Persistence**: raw PTY buffer stored as a `bytea` column `threads.ptyBuffer` (written on stream close) for terminal replay; parsed events batched into thread messages on natural boundaries (`prompt-ready`, `permission`, disconnect). Reconnect replay: ring buffer drain → parser raw buffer → DB `ptyBuffer`, then persisted events re-sent as text frames, then `reconnected`.

### 3.4 Bugs found and fixed in this generation (useful edge cases)

- `getLineText` skipped codepoint 0 instead of emitting a space, producing `"Let'sgetstarted."`. Fix: `cp === 0 ? ' ' : String.fromCodePoint(cp)`.
- A chunk containing both finished output and a fresh prompt (`'Output line\r\n❯ '`) sealed the output line and then never inspected the cursor row, so `prompt-ready` was lost and the UI stuck in "Working…". Fix: track `cursorRowDirty` separately from `sealedAny` (commit `17a48c34`).
- `deriveToolState('input')` originally returned `working`, locking the input box after the user typed. Fix: return `null`.
- Page reload lost chat history until reconnect replayed persisted events.

### 3.5 Diagnosis that ended this generation

The research report (next section) listed why a line classifier on a VT emulator still cannot produce interactive UI:

1. Line-oriented: multi-line diffs and menus are never grouped.
2. Text-only: `getLineText()` throws away colors, bold, hyperlinks, selection cursors.
3. No state: "no 'I'm inside a diff block'".
4. Active row underused: interactive widgets live on the cursor row, which only emits `activity`.
5. No semantic notion of terminal widgets.
6. Input echo duplicated as both a user bubble and an assistant bubble.

"The VT emulator correctly models the terminal's 2D grid, but the parser only extracts 1D text strings. The spatial/temporal information needed for interactive widgets is available in the WASM viewport but is not used."

---

## 4. Research: how other projects solve this (2026-04-13)

`docs/research/ai-tool-output-parsing-report.md` at commit `17a48c34`. Four open-source projects studied.

| Project | Capture path | Protocol shape | Notes |
|---|---|---|---|
| **Happy** (`slopus/happy`) | Claude Agent SDK `query()` stream, or watching `~/.claude/projects/**/*.jsonl` with 3 s polling | 9 flat wire events: `text, tool-call-start, tool-call-end, turn-start, turn-end, start, stop, service, file` → 4 UI message kinds | Permissions via SDK `canUseTool` callback blocked on a promise answered over Socket.IO; subagents get IDs, sidechains nested |
| **Remodex** | `codex app-server` JSON-RPC 2.0 over stdio | `agent/response/delta`, `item/fileChange/*`, `item/commandExecution/*`, `item/diff/*`, `turn/plan/updated`; UI kinds `chat, thinking, toolActivity, fileChange, commandExecution, subagentAction, plan, userInputPrompt` | Richest structured API; typed user-input requests incl. multi-select; Codex only |
| **CloudCLI** (`siteboon/claudecodeui`) | Claude Agent SDK on `/ws`; separate node-pty `/shell` | 12-kind `NormalizedMessage`; `ProviderAdapter { fetchHistory, normalizeMessage }` for Claude/Cursor/Codex/Gemini; config-driven `TOOL_CONFIGS` (e.g. `Bash: { input: one-line, result: hideOnSuccess }`) | Chat and terminal deliberately NOT unified; "remember" permission rules |
| **HAPI** (`tiann/hapi`) | spawns `claude --output-format stream-json --input-format stream-json --permission-prompt-tool stdio` (bidirectional NDJSON) | `SDKMessage → converter → RawJSONLines → Hub (SQLite) → SSE → 6-phase client reducer` (permissions, text, tool calls, results, sidechains, mode switches) | Simplest integration; PTY feature exists but is not used for Claude output |

**Headline finding:** "None of the 4 researched repos parse terminal output. They all bypass the terminal entirely by using structured APIs/SDKs provided by the AI tools themselves." And: "Interactive chat UIs for AI tools are not a parsing problem, they are a structured event consumption problem."

**Recommendation at the time:** dual-stream. A capture agent inside the pod emits structured JSON text frames (HAPI-style CLI flags preferred over an SDK dependency in the image) alongside raw PTY binary frames; a unified `NormalizedEvent` schema (`text | tool-call-start | tool-call-end | permission-request | permission-response | turn-start | turn-end | error | status | stream-delta | stream-end`, with `turn` and `subagent` grouping); per-runtime adapters; keep the VT parser only as a fallback for unknown runtimes and the terminal view.

**"What NOT to do" (quoted):** don't improve the regex parser for interactive elements ("even a perfect VT parser can't reconstruct the semantic intent behind ANSI escape sequences"); don't import the SDK on the backend server (it must be co-located with the tool); "Don't try to build a universal terminal-to-chat converter. This is an unsolvable problem in the general case."

This recommendation was **not** followed. The next two generations chose runtime-agnostic terminal interpretation anyway, first with an LLM, then deterministically. The report remains the strongest argument for a hybrid (structured events where available, grid parsing as the universal fallback).

---

## 5. Generation 3: LLM generative UI (2026-04-13)

Commit `11b4853a`. Spec and plan: `docs/superpowers/specs/2026-04-13-generative-ui-design.md`, `docs/superpowers/plans/2026-04-13-generative-ui.md`. Code still on disk (unused): `repos/backend/src/services/interpreter/`, `repos/domain/src/{types/gui.types.ts, constants/gui.ts, types/shellEvent.types.ts, utils/stdinTranslation.ts}`, `repos/threads/src/components/ChatView/GenerativeUIRenderer.tsx` + `registry/`.

Pivot rationale (handoff doc): "Instead of the SDK/adapter approach (fragile CLI flags, per-tool maintenance burden), we designed a generative UI system that pipes raw terminal output through an AI interpreter to produce a JSON component tree matching `React.createElement`. This is runtime-agnostic."

### 5.1 Properties

Additive only (raw event path untouched; interpreter off/failing/skipping = identical to before); two-phase delivery (raw events instantly, an "upgrade" later, matched by `chunkId`, fade-swapped in); runtime-agnostic; org-configurable with per-sandbox override.

### 5.2 Pipeline

```
TParsedEvent → ChunkBuffer → shouldInterpret (regex gate) → InterpreterService (LLM) → validateTree → TGenerativeUIEvent { chunkId, tree }
```

**ChunkBuffer** (per session): bypass types `activity | prompt-ready | input` are emitted immediately with no `chunkId` (and `prompt-ready` triggers a flush); buffered types `text | tool-call | permission | diff | error | unknown` are stamped with the current `chunkId` and emitted immediately, then held. Flush on **`prompt-ready` (primary: "the tool is waiting for input, output is complete")** or a **200 ms debounce** since the last buffered event, or destroy. On flush: `onFlush(chunkId, events)` and rotate a new `nanoid()` chunkId.

**Skip heuristic** (`shouldInterpret`): join `text`/`unknown` content; empty → skip; else send if any `InteractivePatterns` matches:

```ts
/^\s*\d+[.)]\s+/m                       // numbered list
/^\s*[-*]\s+/m                          // bullets
/[❯›>→]\s+/m                            // cursor markers
/\(y\/n\)|\[Y\/n\]|\(yes\/no\)/i         // confirmations
/\b(Allow|Do you want to|Choose|Select|Pick)\b/i
```

Intentionally loose: "better to send a few false positives to the interpreter (which can return null) than miss real interactive elements."

**InterpreterService.interpret(chunk, config, providerBrand, apiKey)**: build a user message (text/unknown verbatim, `Error: …`, `⏺ tool target`, permission prompt, `+`/`-` diff lines), call `pi-ai streamSimple` with `temperature: 0, maxTokens: 2048`, strip fences, literal `null` → no upgrade, parse JSON, `validateTree`; retry `1 + maxRetries` times with `500ms × attempt` backoff; return `null` on exhaustion (graceful degradation).

**Tree contract**:

```ts
TJsonComponentNode = { type: string; props?: Record<string, unknown>; children?: (TJsonComponentNode | string)[] }
```

Registry: `Select { options[{label,value,description?}], interactionType:'ArrowSelect'|'NumberSelect', currentIndex }`, `Confirm { prompt, yesLabel?, noLabel? }`, `TextInput { placeholder?, label? }`, `Alert { variant, title? }`, `ProgressBar { value, max, label? }`. HTML passthrough: `div p span strong em ul li ol code pre hr br`. Validator: root must be `div`; every type in registry or allowlist; `Select` ≥ 2 options; `Confirm` non-empty prompt; children strings or nodes; max depth 10. The client renderer re-enforces the same allowlist.

**System prompt** (`InterpreterSystem`, full text in `repos/domain/src/constants/gui.ts`) key rules: strict JSON or the string `null`; `ArrowSelect` when a cursor marker (`❯ > → *`) is present with `currentIndex` = marked position, `NumberSelect` for numbered lists; no `className`/`style`; "When unsure whether something is interactive, return null. False negatives are better than broken interactions." Three anchoring examples (theme select, `Allow Edit to src/App.tsx? (y/n)` → Confirm with Allow/Deny, prose → null).

**Interaction → stdin** (`translateInteraction`, in `@tdsk/domain`):

| Interaction | Bytes |
|---|---|
| `ArrowSelect { selectedIndex, currentIndex }` | `\x1b[B` × delta (or `\x1b[A` × −delta) then `\r` |
| `NumberSelect { selectedIndex }` | `${index+1}\r` |
| `YesNo { approved }` | `y\r` / `n\r` |
| `TextInput { text }` | `${text}\r` |
| `Keystroke { key }` | key verbatim |

**Config**: `TGuiConfig { enabled, providerId, model, maxRetries, systemPrompt? }` at `organizations.config.guiConfig`, override at sandbox `config.guiConfig`; org `enabled:false` wins over any override. Admin form with provider/model pickers and a Monaco editor for the prompt. Gated by the compile-time feature flag `terminalGui` (still `false`).

**Non-goals recorded**: cost tracking, streaming interpreter output, SDK adapters, custom components, prompt-tuning UI.

### 5.3 Why it was dropped

The 04-15 planning prompt: "No LLM: fully deterministic. The existing InterpreterService and generative UI system are removed entirely." The design did not want per-chunk LLM latency and cost, nondeterminism, or a semantic layer that only worked on text after the grid's spatial information had already been discarded. The interpreter code was nonetheless left on disk and never wired to `onShellConnect`.

---

## 6. Generation 4: deterministic client-side AST GUI (2026-04-15)

Commits `c0e4dbbc`, `22573d52`, `2c68f8ca` (branch `lt/threads-gui-rethink`). Spec: `docs/superpowers/specs/2026-04-15-terminal-ast-gui-design.md` (594 lines, status Approved). Plan: `docs/superpowers/plans/2026-04-15-terminal-ast-gui.md` (4759 lines, 21 tasks). Visual mockups: `docs/superpowers/visuals/2026-04-15-terminal-ast-gui-{design-direction,activity-feed}.html`. Code on disk today: `repos/threads/src/services/gui/**`, `repos/threads/src/types/{ast,tokenizer,parser,engine,contexts}.types.ts`, `components/{ASTNodes,ActivityFeed,SessionGUIView}`, `state/gui.ts`, `actions/gui/*`, `hooks/session/useSessionEngine.ts`, `hooks/activity/useActivityFeed.ts`.

### 6.1 Thesis and architecture

"A Terminal AST Parser that replaces the ChatView. It reads cell data from a hidden WASM instance, parses it into a typed AST, and renders it as native web components in a dark-themed activity feed dashboard." Everything moves to the browser; the backend "becomes a dumb byte pipe + storage" (binary frames only, all server parsing deleted).

```
WebSocket binary bytes
 → L1 Terminal State   headless emulator, no canvas: cell grid, dirty rows, cursor, alt-screen
 → L2 Tokenizer        5-step grid scan → typed tokens with 2D bounds
 → L3 Parser           recursive descent scoped by border frames → Document AST (16 node types)
 → L4 Visitors         Render / Feed / Interaction / Accessibility
```

Design decision: one shared emulator instance per session feeds both the GUI projection and the visible terminal canvas, so toggling views is instant ("no re-processing, just changing which projection is active"). Both views stay hot; a single input box at the bottom is visible in both modes, and every interaction (click or typed text) funnels through one `sendKeystroke()` into the PTY. "Terminal is always source of truth."

### 6.2 Cell format (the contract between emulator and tokenizer)

16 bytes per cell, `offset = (row × cols + col) × 16`:

| Bytes | Field |
|---|---|
| 0–3 | codepoint u32 LE (0 = empty) |
| 4–6 | fg r,g,b |
| 7–9 | bg r,g,b |
| 10 | flags: `BOLD 0x01, ITALIC 0x02, UNDERLINE 0x04, STRIKETHROUGH 0x08, INVERSE 0x10, INVISIBLE 0x20, BLINK 0x40, FAINT 0x80` |
| 11 | width (1 normal, 2 wide, 0 combining) |
| 12–13 | hyperlink id u16 (OSC 8) |
| 14 | grapheme length |
| 15 | reserved |

This layout was originally ghostty-web 0.4.0's native viewport export and was later **synthesized in JS from @xterm/headless** (section 7) so the tokenizer never changed. `resolveColors()` swaps fg/bg when `INVERSE` is set, and that is the single place inverse video is materialized.

Emulator interface consumed by the pipeline:

```ts
type TBrowserVTerminal = {
  cols; rows
  write(data: string | Uint8Array): void
  resize(cols, rows): void
  getViewport(): DataView          // cols × rows × 16 bytes
  getDirtyRows(): number[]
  getCursor(): { x; y; visible }
  isAlternateScreen(): boolean
  markClean(): void
  free(): void
}
```

### 6.3 AST: 16 node types

"Finite, closed set. Strict parent-child typing. 1:1 mapping to React components." Geometry: `TRect = { top, left, bottom, right }`, `RGB = { r, g, b }`. Every node carries `bounds`.

```ts
Document     { bounds, cursor:{x,y,visible}, mode:'interactive'|'tui'|'streaming'|'idle', children: ContentNode[] }
// containers
Panel        { bounds, border:'single'|'double'|'heavy'|'rounded', title?, children: ContentNode[] }
Group        { bounds, children: ContentNode[] }
SelectList   { bounds, selectedIndex, style:'arrow'|'numbered'|'highlighted', children: SelectItem[] }
Table        { bounds, hasHeader, children: TableRow[] }
DiffBlock    { bounds, children: TextLine[] }
// leaf-ish
TextLine     { bounds, children: Span[] }
SelectItem   { bounds, index, selected, children: Span[] }
TableRow     { bounds, isHeader, cells: Span[][] }
StatusBar    { bounds, segments: Span[][] }
Confirm      { bounds, question, options:[string,string], focusedIndex:0|1 }
TextInput    { bounds, prompt, value, cursorOffset, suggestion? }
ActionTarget { bounds, label, hotkey?, focused, children: Span[] }
Link         { bounds, hyperlinkId, url?, children: Span[] }
Separator    { bounds, style:'blank'|'line'|'dashed' }
// terminal leaf
Span         { text, fg, bg, bold, italic, underline, strikethrough, faint, inverse }
```

Feed events (output of the diff visitor):

```ts
TFeedEvent =
  | { kind:'action'; id; status:'running'|'done'|'error'; action; target; detail?: Document }
  | { kind:'prompt'; id; status:'waiting'|'answered'; question; options?; answer? }
  | { kind:'output'; id; status:'streaming'|'complete'; lines: TextLine[]; summary?; collapsed }
  | { kind:'tui';    id; status:'active'|'exited'; regionTree: Document }
  | { kind:'input';  id; text; source:'user' }
  | { kind:'idle';   id; timestamp }
```

### 6.4 Tokenizer (five steps, all O(cols × rows))

Token types: `BorderFrame { bounds, interior, style, title? }`, `HighlightedBlock { bounds, color, shape:'full-width'|'small'|'multi-row' }`, `TextRun { bounds, spans: RawSpan[] }`, `WhitespaceGap { bounds, height }`, `LinkSpan { bounds, text, hyperlinkId }`, `CursorToken { position, visible }`.

**1. Palette detection** (`palette.ts`): frequency-count resolved bg over all initialized cells and resolved fg over non-space cells; most frequent wins → `{ defaultBg, defaultFg }`. Cells with codepoint 0, black fg/bg, flags 0 and width 0 are skipped as uninitialized. Re-detected only when `!prevPalette || dirtyRows.length > rows × 0.5` (theme change or full-screen switch).

**2. Cell classification** (`classify.ts`): per cell `isBoxDraw` (U+2500–257F, U+2580–259F), `isHighlighted` (bg ≠ defaultBg), `isFgStyled` (fg ≠ defaultFg), `isEmpty` (codepoint 0 or 0x20), `isBlank` (empty and not highlighted), `isWide` (width 2), `isWideRight` (left neighbour wide), `hasLink` (hyperlink id > 0).

**3. Border tracing** (`borders.ts`): corner-walk algorithm. Find a top-left corner (`┌ ╔ ┏ ╭`) → walk right through horizontal connectors **or any non-box-draw printable char (this is how embedded titles are tolerated)** to a top-right corner (`┐ ╗ ┓ ╮`) → walk down through vertical connectors (`│ ║ ┃ ├ ┤ ╠ ╣ ┣ ┫`) to a bottom-right corner → verify the bottom-left corner, the left column, and the bottom row (strict connectors only) → emit frame with `interior = bounds shrunk by 1`. Style from the top-left glyph (`╔ double`, `┏ heavy`, `╭ rounded`, else `single`). Title = printable chars on the top row between the corners. Recurse into interiors larger than 2×2 to find nested frames; output is a flat list, nesting is recovered geometrically by the parser.

**4. Block segmentation** (`blocks.ts`): iterative 4-connected flood fill over `isHighlighted` cells; bounding box per component; shape `multi-row` if height > 1, `full-width` if width ≥ scope width, else `small`. Color filled in afterwards from the top-left cell's resolved bg. Spec decision: "Multiple small blocks on the same row are emitted as separate tokens (the parser decides if they're a button group, tab bar, etc.)."

**5. Run extraction** (`runs.ts`): per row inside a scope, skipping child-frame areas and wide-right halves. Consecutive blank rows collapse into one `WhitespaceGap`. Cells accumulate into a span while fg, bg and the raw flags byte all match; a change starts a new span. Hyperlinked cells become separate `LinkSpan`s keyed by id. One `TextRun` per non-blank row containing all its spans.

**Orchestrator** (`tokenizer.ts`): palette → classify → trace borders over the full viewport → segment blocks → extract root runs excluding frames → extract runs per frame interior excluding nested frames → cursor token. Returns `{ tokens, palette, meta, cursor }`.

### 6.5 Parser

**Mode detection** (runs first, verbatim):

```ts
if (isAlternateScreen) return 'tui'
if (dirtyRowCount > 3 && consecutiveDirtyCycles > 3 && !hasInteractiveRegion) return 'streaming'
if (cursor.visible && dirtyRowCount === 0 && idleDurationMs > 2000) return 'idle'
return 'interactive'
```

**Scope parser** (`scopeParser.ts`): partition frames vs other tokens; sort frames by area descending; a frame fully inside another's interior is nested; for each top-level frame collect tokens inside its interior, recurse, then flat-parse the interior remainder → `Panel { border, title?, children: [...childPanels, ...flatNodes] }`. Unconsumed tokens go to the root flat parser.

**Flat parser** (`flatParser.ts`): split the scope's tokens into sections at `WhitespaceGap`s; per section try matchers in **specificity order, first match wins**; gaps become `Separator` (`blank` if height > 1 else `line`); anything unmatched becomes `TextLine + Span`, which the spec insists is "the correct parse, not a fallback."

| Order | Matcher | Rule |
|---|---|---|
| 1 | **SelectList** | ≥ 3 runs. Score: +3 same indent; +3 all numbered `/^\d+[.)]\s/`; +3 arrow (`/^[>❯›→]\s/`, needs ≥ 1 arrow, ≥ 2 non-arrow, same indent, decoration rows `/^[─━╌╍┄┈═╼╾\-=_]+$/` filtered, length ratio `max/min < 4` to reject mixed prompt + notification text); +2 sequential numbers; +3 exactly one highlighted block. **Accept at ≥ 5.** Style arrow > numbered > highlighted; `selectedIndex` from the highlight row, else first arrow row, else 0. |
| 2 | **Table** | ≥ 3 runs. Separator chars `│ ┃ \|`; a column counts if present in ≥ 60% of rows; need ≥ 2 such columns. Header if the first run has BOLD or UNDERLINE. Cells sliced between separator columns. |
| 3 | **DiffBlock** | ≥ 2 runs; a line counts if trimmed text starts `+`/`-` or any span fg is green (`g>150, r<100, b<100`) or red (`r>150, g<100, b<100`); need ≥ 50% diff lines. |
| 4 | **Confirm** | Regex `/[\[(](y(?:es)?)\s*[/\|]\s*(n(?:o)?)\s*[\])]\|[\[(](n(?:o)?)\s*[/\|]\s*(y(?:es)?)\s*[\])]/i` over the joined section text; uppercase option letter marks the default (`focusedIndex`); question = text before the match. Fallback: exactly 2 small highlighted blocks → `['yes','no']`. |
| 5 | **TextInput** | Cursor visible and on a run in the section; scan backwards from the cursor for a prompt char in `> $ % # : ? ❯ ›`; `prompt` = text through that char, `value` = rest, `cursorOffset = cursor.x − run.left − valueStart`. |
| 6 | **ActionTarget** | Per small highlighted block: +2 non-default bg; +1 width ≤ 20; +2 peer group (> 1 small block in section); +2 hotkey hint `/[\[(]([a-zA-Z0-9])[\])]/` in runs within 1 row and 3 cols. **Accept at ≥ 3.** Label = runs inside the block, default `"button"`. |
| 7 | **StatusBar** | A `full-width` highlight whose top row equals the scope's bottom row; segments from that row's runs. |
| 8 | **Link** | Every `LinkSpan` → `Link` (rendered underlined blue; `url` never populated from the grid). |
| 9 | **TextLine** | Everything else, sorted by top then left. |

**Document assembly** (`parser.ts`): `detectMode` → `parseScopes` → `parseFlatContent(remaining)` → `Document { mode, cursor, bounds: union of token bounds (fallback 80×24), children: [...panels, ...flat] }`.

### 6.6 Visitors

**Feed visitor** `diffToFeedEvents(prev, next)` compares consecutive documents:

1. Mode: entering `idle` → `idle` event; while `tui` → `tui/active` carrying the whole document (every cycle); leaving `tui` → `tui/exited` carrying the previous document.
2. `TextInput` count up → `prompt/waiting { question: prompt }`; count down → `prompt/answered`.
3. `SelectList` count up → `prompt/waiting { question:'Select an option', options }` (decoration-only items filtered by `/^[─━╌╍┄┈═╼╾\-=_·•●]+$/`).
4. `DiffBlock` count up → `action/running { action:'edit', target:'file' }`.
5. Text (only in `streaming`/`interactive`): more `TextLine`s than before → `output` with the appended lines (`streaming` status while streaming); otherwise, if > 3 index-aligned lines changed and the fingerprint differs → `output/complete` with the changed non-blank lines, `collapsed` when > 5 (handles TUI apps redrawing in place).

Feed UI rules from the spec: newest at bottom with auto-scroll; action cards with status dot + expandable detail; prompt cards collapse to the answer once answered; output cards collapse to a line-count summary; **TUI cards take over the full view and pause the feed**, inserting a summary card on exit; completed cards auto-collapse to one line. Status colors: green done, amber needs attention, purple working.

**Interaction visitor** `collectInteractions(doc, sendKeystroke)` computes keystrokes from the known cursor and target bounds ("the grid tells you everything in between"):

| Node | Keystrokes |
|---|---|
| SelectItem, numbered list | `${index+1}\n` |
| SelectItem, arrow/highlighted | `\x1b[B` or `\x1b[A` × \|index − selectedIndex\|, then `\n` |
| Confirm option | first lowercase char of the option (`y`/`n`), no Enter |
| ActionTarget with hotkey | the hotkey char |
| ActionTarget without | `\x1b[B` if not focused, then `\n` |
| Link with url | `window.open(url)`, no keystroke |

Note the two keystroke translators disagree on Enter: the visitor sends `\n`, the domain `translateInteraction` sends `\r`. A real PTY in canonical mode wants `\r`.

**Accessibility visitor** `getAriaProps(node)`: `SelectList → role=listbox + aria-activedescendant`, `SelectItem → role=option + aria-selected`, `TextInput → role=textbox`, `ActionTarget → role=button`, `Table → role=table`, `StatusBar → role=status aria-live=polite`, `Confirm → role=alertdialog`.

**Render visitor**: a `switch` on `node.type` returning the 1:1 `Node*` React component; `Panel` recurses; `Span`, `SelectItem`, `TableRow` are rendered by their parents.

### 6.7 Session engine and incremental processing

`SessionEngine` (one per session, `services/gui/engine/sessionEngine.ts`):

- `write(data)`: write to the emulator, stamp `lastDataTime`, mark dirty, schedule **one `requestAnimationFrame`** (many socket chunks coalesce into one parse per frame).
- `resize(cols, rows)`: resize and process synchronously.
- 1 s `setInterval` idle check: if dirty, not already `idle`, and `now − lastDataTime > 2000` → `process()` (so the `idle` mode transition fires after data stops).
- `process()`: `getDirtyRows / getCursor / getViewport` → `consecutiveDirtyCycles++` when `dirtyRows > 3` else reset → `tokenize(view, cols, rows, cursor, prevPalette, dirtyRows)` → `parse(tokens, modeCtx)` → `diffToFeedEvents(prevDoc, doc)` → commit `prevDoc`, `markClean()` **before** callbacks → `onFeedEvents` (if any) and `onAST`. Callback errors are isolated; 3 consecutive processing errors emit one synthetic `output` event with an error summary.
- `hasInteractiveRegion` was never wired back from the parser (always `false`); streaming detection worked without it.

The spec's intended incremental strategy (re-tokenize only dirty rows with a 1-row margin, re-parse only scopes touching dirty tokens, cache unchanged AST subtrees, `Map<row, Scope[]>` index for O(1) scope lookup) was **not implemented**; every cycle re-tokenizes the full viewport.

State: four Jotai `Map<sessionId, …>` atoms (`guiASTState`, `guiFeedState` capped at 2000 events, `guiModeState`, `guiEngineState`), imperative accessors, and `useSessionEngine` (creates/destroys per session id) plus `useActivityFeed`. `SessionGUIView` routes: `tui` mode → full AST render with overflow hidden; feed events → `ActivityFeed`; AST → render; else empty feed. An `InteractionContext { sendKeystroke }` gives node components a path to stdin.

### 6.8 Test coverage delivered

Roughly 218 unit tests at the time (tokenizer 90, parser 51, visitors 27, AST 38, pipeline integration 12), later more. `pipeline.integration.test.ts` drives synthetic viewports (`buildTestViewport` fixture) end-to-end through tokenize → parse → visitors for: plain text, bordered panel, numbered select with handlers, colored diff, status bar, TextInput → prompt event, idle transition, Confirm handlers, panel + status bar, panel containing a select list. A Playwright spec for the live GUI view was written but never run.

### 6.9 What happened live

All 21 tasks were written, type checks were clean, unit tests passed, but the GUI view "does NOT render AST output when connected to a real sandbox session." The debug checklist left behind (never executed): is the engine created; does binary data reach `engine.write()`; does tokenize/parse yield a non-empty document; is the AST atom updated; does the feed receive events; console errors during connect. On disk today the last mile is indeed missing: `sessionService.subscribeEngineData` exists and the socket fans raw bytes to engine writers, but nothing subscribes an engine to it, and `SessionGUIView` is not mounted by any page. On 2026-06-27 the client-side pipeline was marked scratched, "to be reimplemented at a future date when the design is reconsidered." The unit-tested modules are still present and green.

Two packaging problems were hit and fixed along the way, both relevant to a standalone module:

- The domain parser barrel imported `node:fs/promises` (to read the WASM file), which crashed the browser build; `web.ts` had to carve out type-only exports, and the browser got its own `wasmBridge`.
- The `@TDM/*` path alias resolved for TypeScript but not at Vite/vitest runtime, so the cell-size constants were duplicated into threads with a `constantDrift.test.ts` guard.

---

## 7. Generation 5: emulator swap to xterm.js (2026-05-14 → 07-12)

Commit `99f92b6e` (plan `docs/superpowers/plans/2026-05-14-xterm-migration.md`, added in `b7ea37d7`). Goal: "eliminate monkey-patched rendering hacks and raw buffer replay in favor of xterm.js's stable public API, keep-alive terminals, and headless cell-level buffer access."

- Visible terminal: `@xterm/xterm 6.0.0` + `@xterm/addon-fit 0.11.0`, keep-alive terminals (no destroy/recreate on tab switch), ring-buffer replay on mount.
- Headless engine: `@xterm/headless 6.0.0` in `xtermBridge.ts` (`createBrowserTerminal(cols, rows)` → `new Terminal({ cols, rows, scrollback: 0, allowProposedApi: true })`). `getViewport()` walks `buffer.active` line by line with `getNullCell()/getCell()` and **packs each cell into the same 16-byte layout** (codepoint u32; fg/bg resolved through a locally built ANSI-256 palette (`r*40+55` cube, `i*10+8` greys) or truecolor; flags byte from `isBold/isItalic/isUnderline/isStrikethrough/isInverse/isInvisible/isBlink/isDim`; width; hyperlink id always 0; grapheme length).
- The entire tokenizer/parser/AST/visitor stack was untouched; `GhosttyVTCellSize → VTCellSize`, `GhosttyVTConfigSize` removed; `ghostty-web` dependency and its `init()` removed; server-side `ghosttyVT.ts` and its probe test deleted.

Behavioural differences from ghostty-web that a new module must decide about:

| Concern | ghostty-web (gen 2–4) | @xterm/headless (gen 5) |
|---|---|---|
| Dirty rows | per-row bits from the render state | **all-or-nothing** flag set in the async `write` callback; `getDirtyRows()` is `[]` or every row |
| Cursor visibility | DECTCEM via `get_cursor_visible` | approximated as `buffer.type !== 'alternate'` |
| Hyperlinks | OSC 8 id in the cell | not exported (always 0) |
| Style flags | bits 16/17 of a u32 | packed byte at offset 10 |
| Use after free | silent neutral returns | throws `Terminal has been freed` |
| `write` completion | synchronous | asynchronous (tests poll with `vi.waitFor`) |

The coarse dirty tracking means the palette re-detection guard and the "dirty rows > 3 for > 3 cycles" streaming heuristic both behave differently under xterm than under ghostty (every write dirties every row).

---

## 8. Remaining server-side pieces still on disk (for reference)

- `repos/domain/src/parser/contentFilter.ts`: `classifyContent(text, runtime) → 'content' | 'chrome' | 'loading'`, designed to sit between change detection and matching to suppress TUI redraw noise. Generic chrome: 3+ pipe-separated segments, box-drawing-only lines, `/^[\s│|─\-=+]+$/`, 3+ modifier-key words (`ctrl|shift|alt|meta|cmd|esc|tab|enter|return`). Generic loading: braille/unicode spinner prefixes (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏⠾⠽⠻⢿⡿⣟⣯⣷✦◐◓◑◒…`), `/^(Loading|Hashing|Processing|Compiling|Building|Indexing|Searching|Analyzing|Scanning|Resolving|Fetching|Installing)\.\.\./i`, `to interrupt`, `press … to cancel`, `esc to cancel`. Claude Code classifier adds `? for shortcuts`, effort indicators, `Welcome back!`, `Tips for getting started`, tab-bar rows, and `⊕ word...` loading. Registry via `registerContentClassifier(runtime, { isChrome, isLoading })`.
- `repos/domain/src/parser/markdownFormatter.ts`: `segmentsToMarkdown(TTextSegment[])` (bold → `**`, italic → `_`, a lone bold line ≤ 80 chars → `## heading`, "since TUI apps commonly use ANSI bold for section headers").
- `repos/domain/src/types/parser.types.ts`: the full `TParsedEvent` union, `EParserEvtType`, `TToolName`, `TTextSegment`.
- `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` today: pure byte pipe. Binary stdout fan-out with backpressure (pause at 64 KB buffered, poll every 16 ms, 30 s max wait), 1 MB ring buffer while detached, S3 stdout/stderr capture, `permission-response` control message still writes `y\n`/`n\n`, 30 s ping keepalive, reconnect sends the drained ring buffer as one binary frame before the `reconnected` JSON.

---

## 9. Consolidated lessons

**What held up across every generation**

- A real VT emulator is non-negotiable. Regex on the byte stream fails on split sequences, CR overwrites, cursor movement, and alternate screen.
- Zero scrollback plus "the viewport is the document" keeps memory tiny (≈ 50 KB per session) and makes dirty-row tracking meaningful.
- Line sealing by cursor position (emit a row only after the cursor leaves it) collapses spinners and progress bars for free with no timers. Output-driven `activity` beats timer-based "thinking".
- The prompt row is special: it never gets a newline, so prompt-ready and permission prompts must be detected on the **active** (cursor) row, not only on sealed rows. Forgetting this caused the "stuck in Working" bug.
- `prompt-ready` is the best natural chunk boundary; a short debounce (200 ms) is the fallback.
- Keep raw bytes flowing to the visible terminal unconditionally; every semantic layer is additive on top.
- One keystroke path back into the PTY for both clicks and typed text, computed from cursor position and target geometry.
- Server-generated `input` events with `userId` are the only way to attribute input in shared sessions.
- A single fixed cell layout as the contract between emulator and tokenizer let the emulator be swapped without touching the semantic layers.

**What did not work, and why**

- 1D text extraction after emulation (gen 2) throws away the colors, highlight blocks, borders, and cursor geometry that identify widgets. Multi-line structures (menus, diffs, tables) cannot be recovered from line events.
- LLM interpretation of text chunks (gen 3) adds per-chunk latency, cost, and nondeterminism, and still operates after the spatial information is gone. It was designed conservatively (`null` on doubt) and never wired in.
- Per-runtime regex matchers (`⏺ Read …`, `(y/n)`) are brittle and tied to one tool's exact glyphs; they were kept as constants but are not a general solution.
- The client-side pipeline (gen 4) passed synthetic tests but never rendered live. The failure was in integration plumbing (engine never subscribed to socket bytes, view never mounted), not in the algorithms, and it was never debugged with real traffic. Synthetic `buildTestViewport` fixtures are not a substitute for recorded real PTY streams.
- Full-viewport re-tokenization every frame was accepted as a shortcut; the incremental (dirty-scope) design was specified but not built.
- Coarse dirty tracking in @xterm/headless (all rows or none) quietly changed the semantics of heuristics written against per-row dirty bits.
- Two independent keystroke translators drifted (`\n` vs `\r`).
- Packaging: a Node-only WASM loader in a shared barrel broke the browser build; path aliases that type-check but do not resolve at runtime forced constant duplication. A standalone module should be isomorphic from day one and ship its own emulator adapter interface.

**Open design questions the new module must answer**

1. Emulator choice and adapter contract: which of per-row dirty bits, DECTCEM cursor visibility, OSC 8 hyperlinks, and grapheme clusters are required, and which emulator provides them (ghostty-web exposed all four; xterm headless exposes none of the first three).
2. Hybrid input: whether to add a structured-event channel (HAPI-style NDJSON or SDK in the pod) for known runtimes and reserve grid parsing for the universal fallback, as the research report recommended.
3. Incrementality: dirty-scope re-tokenization with cached subtrees, or full re-parse per animation frame.
4. Temporal model: the gen 4 feed diff compares two snapshots and loses in-between states; a stream of sealed-row events (gen 2) captures history but loses geometry. Something must reconcile "document now" with "what happened."
5. Runtime plugins: content classifiers, matchers, and hotkey conventions per tool, registered by runtime id, generic first.

---

## Appendix A: recovering the original artifacts

All design docs were removed from the tree by `d6f21d7e` ("docs restructure"). Read them with `git show <commit>:<path>`.

| Artifact | Commit | Path |
|---|---|---|
| Parser redesign spec | `24661f85` | `docs/superpowers/specs/2026-04-12-terminal-parser-redesign-design.md` |
| Parser redesign plan (1747 lines) | `24661f85` | `docs/superpowers/plans/2026-04-12-terminal-parser-redesign.md` |
| Research report | `17a48c34` | `docs/research/ai-tool-output-parsing-report.md` |
| SmartInput stuck-working handoff | `17a48c34` | `docs/internal/handoff/2026-04-12-smartinput-stuck-working.md` |
| Generative UI spec / plan / handoff | `11b4853a` | `docs/superpowers/{specs/2026-04-13-generative-ui-design.md, plans/2026-04-13-generative-ui.md, handoff/2026-04-13-generative-ui-handoff.md}` |
| AST GUI spec (594 lines) | `c0e4dbbc` | `docs/superpowers/specs/2026-04-15-terminal-ast-gui-design.md` |
| AST GUI plan (4759 lines) | `c0e4dbbc` | `docs/superpowers/plans/2026-04-15-terminal-ast-gui.md` |
| AST GUI planning prompt + HTML mockups | `c0e4dbbc` | `docs/superpowers/prompts/2016-04-15-terminal-ast-gui-prompt.md`, `docs/superpowers/visuals/2026-04-15-terminal-ast-gui-*.html` |
| Terminal settings plan | `2c68f8ca` | `docs/superpowers/plans/2026-04-23-terminal-settings.md` |
| xterm migration plan | `b7ea37d7` | `docs/superpowers/plans/2026-05-14-xterm-migration.md` |
| Gen 1 parser source | `24661f85^` | `repos/domain/src/parser/{ansiProcessor,blockSegmenter,patternMatcher,terminalParser}.ts`, `matchers/claudeCode.ts` |
| Gen 2 parser source | `24661f85` and `99f92b6e^` | `repos/domain/src/parser/{ghosttyVT,changeDetector,patternMatcher,terminalParser,deriveToolState,contentFilter,markdownFormatter}.ts`, `cellLayout.probe.test.ts`; `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` |
| Gen 4/5 source (live) | `HEAD` | `repos/threads/src/services/gui/**`, `repos/threads/src/types/*.types.ts`, `repos/threads/src/components/{ASTNodes,ActivityFeed,SessionGUIView}` |
| Gen 3 source (live, unwired) | `HEAD` | `repos/backend/src/services/interpreter/**`, `repos/domain/src/{constants/gui.ts, types/gui.types.ts, types/shellEvent.types.ts, utils/stdinTranslation.ts}`, `repos/threads/src/components/ChatView/**` |

## Appendix B: library versions used

| Library | Version | Role | Period |
|---|---|---|---|
| `ghostty-web` | 0.4.0 | WASM VT (server headless + browser canvas/headless) | 2026-04-12 → 05-17 |
| `@xterm/headless` | 6.0.0 | browser headless VT for the GUI engine | 2026-05-17 → now |
| `@xterm/xterm` + `@xterm/addon-fit` | 6.0.0 / 0.11.0 | visible terminal | 2026-05-17 → now |
| `@earendil-works/pi-ai` (`streamSimple`) | (backend dep) | LLM calls for the gen 3 interpreter | 2026-04-15 |
| `nanoid` | (backend dep) | chunk ids | 2026-04-15 |
