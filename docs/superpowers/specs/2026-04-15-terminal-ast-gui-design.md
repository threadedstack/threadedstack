# Terminal AST GUI — Design Spec

**Date:** 2026-04-15
**Status:** Approved
**Repo:** repos/threads/

## Overview

A Terminal AST Parser that replaces the ChatView in the threads app. It reads cell data from a hidden ghostty-web WASM instance, parses it into a typed AST, and renders it as native web components in a dark-themed activity feed dashboard. Non-technical users see a clean, approachable interface. Technical users can toggle to the raw terminal (TerminalView, unchanged).

**Target user:** Non-technical — PMs, designers, executives who want oversight, collaboration, and review of sandbox sessions without touching a terminal.

**Scope:** Any terminal process. AI tools (Claude Code, Codex, OpenCode) are the primary focus, but the system handles build logs, TUI apps, simple commands, and any other terminal output as first-class content.

## Architecture

Four layers, all running in the browser:

```
WebSocket (raw bytes from backend)
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Layer 1: Terminal State (ghostty-web WASM)      │
│  - Hidden, no canvas rendering                   │
│  - Receives raw bytes via write()                │
│  - Exposes cell grid, dirty rows, cursor, alt    │
│  - Shared instance: GUI view reads cells,        │
│    TerminalView attaches canvas when toggled on   │
└──────────────────┬──────────────────────────────┘
                   │ GhosttyCell[] (16 bytes/cell)
                   ▼
┌─────────────────────────────────────────────────┐
│  Layer 2: Tokenizer                              │
│  - 5-step scan of cell grid                      │
│  - Emits typed tokens with 2D bounds             │
│  - Palette, classify, borders, blocks, runs      │
└──────────────────┬──────────────────────────────┘
                   │ Token[]
                   ▼
┌─────────────────────────────────────────────────┐
│  Layer 3: Parser                                 │
│  - Recursive descent scoped by frames            │
│  - Pattern matching in specificity order          │
│  - Produces typed AST with Document root          │
└──────────────────┬──────────────────────────────┘
                   │ Document (AST)
                   ▼
┌─────────────────────────────────────────────────┐
│  Layer 4: Visitors                               │
│  - RenderVisitor → React component tree          │
│  - FeedVisitor → Activity feed events            │
│  - InteractionVisitor → Keystroke handlers       │
│  - AccessibilityVisitor → ARIA annotations       │
└─────────────────────────────────────────────────┘
```

### Backend Simplification

The backend becomes a dumb byte pipe + storage:

- WebSocket handler: SSH bytes ↔ WebSocket binary frames
- Raw byte buffer: accumulates PTY output for replay
- Persistence: stores raw `ptyBuffer` to DB on session close
- On reconnect: replays stored bytes to client

**Removed entirely:**
- `TerminalParser`, `ChangeDetector`, `ContentFilter`, `PatternMatcher`
- `InterpreterService`, `ChunkBuffer`
- All event types, event batching, generative UI broadcasting
- JSON text frame protocol (events, upgrades) — binary frames only

### Shared WASM Instance

One `GhosttyVT` instance per session, shared between views:
- GUI view reads cells via `getViewport()`, `getDirtyRows()`, `getCursor()`
- TerminalView attaches/detaches the canvas renderer to the same instance
- Switching views is instant — no re-processing, just changing which projection is active

## Cell Data Format

From ghostty-web@0.4.0, each cell is exactly 16 bytes:

| Byte | Field | Type | Content |
|------|-------|------|---------|
| 0-3 | codepoint | u32 | Unicode character (0 = empty) |
| 4 | fg_r | u8 | Foreground red |
| 5 | fg_g | u8 | Foreground green |
| 6 | fg_b | u8 | Foreground blue |
| 7 | bg_r | u8 | Background red |
| 8 | bg_g | u8 | Background green |
| 9 | bg_b | u8 | Background blue |
| 10 | flags | u8 | Style bitfield |
| 11 | width | u8 | Cell width (1=normal, 2=wide/emoji, 0=combining) |
| 12-13 | hyperlink_id | u16 | OSC 8 hyperlink ID (0 = none) |
| 14 | grapheme_len | u8 | Codepoints in grapheme cluster |
| 15 | (reserved) | u8 | Padding |

**Flags byte:**

| Flag | Value | Meaning |
|------|-------|---------|
| BOLD | 0x01 | Bold text |
| ITALIC | 0x02 | Italic text |
| UNDERLINE | 0x04 | Underlined |
| STRIKETHROUGH | 0x08 | Strikethrough |
| INVERSE | 0x10 | Fg/bg swapped |
| INVISIBLE | 0x20 | Hidden |
| BLINK | 0x40 | Blinking |
| FAINT | 0x80 | Dimmed |

Additional WASM APIs: `getDirtyRows()`, `getCursor()`, `isAlternateScreen()`, `getViewport()`.

## AST Node Types

16 node types. Finite, closed set. Strict parent-child typing. 1:1 mapping to React components.

### Document (root)

```
Document
  bounds: TRect                       // full viewport
  cursor: { x: number, y: number, visible: boolean }
  mode: 'interactive' | 'tui' | 'streaming' | 'idle'
  children: TContentNode[]
```

`TContentNode` = `Panel | Group | TextLine | SelectList | Confirm | TextInput | ActionTarget | StatusBar | Table | DiffBlock | Link | Separator`

### Container Nodes

```
Panel
  bounds: TRect
  border: 'single' | 'double' | 'heavy' | 'rounded'
  title?: string
  children: TContentNode[]            // recursive — panels nest

Group
  bounds: TRect
  children: TContentNode[]            // logical grouping, no visual border

SelectList
  bounds: TRect
  selectedIndex: number
  style: 'arrow' | 'numbered' | 'highlighted'
  children: SelectItem[]              // only SelectItem

Table
  bounds: TRect
  hasHeader: boolean
  children: TableRow[]                // only TableRow

DiffBlock
  bounds: TRect
  children: TextLine[]                // lines marked as added/removed/context
```

### Leaf-ish Nodes (may contain Span children)

```
TextLine
  bounds: TRect
  children: Span[]

SelectItem
  bounds: TRect
  selected: boolean
  index: number
  children: Span[]

TableRow
  bounds: TRect
  isHeader: boolean
  cells: Span[][]                     // array of columns, each column is Span[]

StatusBar
  bounds: TRect
  segments: Span[][]                  // array of segments, each is Span[]

Confirm
  bounds: TRect
  question: string
  options: [string, string]           // e.g. ['y', 'n'] or ['Yes', 'No']
  focusedIndex: 0 | 1

TextInput
  bounds: TRect
  prompt: string
  value: string
  cursorOffset: number
  suggestion?: string

ActionTarget
  bounds: TRect
  label: string
  hotkey?: string
  focused: boolean
  children: Span[]

Link
  bounds: TRect
  hyperlinkId: number
  url?: string
  children: Span[]

Separator
  bounds: TRect
  style: 'blank' | 'line' | 'dashed'
```

### Terminal Node

```
Span
  text: string
  fg: RGB
  bg: RGB
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  faint: boolean
  inverse: boolean
```

### Type Helpers

```
TRect = { top: number, left: number, bottom: number, right: number }
RGB = { r: number, g: number, b: number }
```

## Tokenizer

Scans the cell grid and produces typed tokens with 2D bounds. Runs in 5 steps, each informing the next.

### Step 1: Palette Detection

Frequency-count bg/fg colors across all non-empty cells. Most frequent bg = `defaultBg`, most frequent fg = `defaultFg`. Handles INVERSE flag by swapping fg/bg before comparison.

Runs once on initial viewport. Re-runs only if >50% of rows are dirty (indicates theme change or full-screen switch).

**Output:** `{ defaultBg: RGB, defaultFg: RGB }`

### Step 2: Cell Classification

Single-pass linear scan, O(cols × rows). Each cell gets metadata bits:

| Bit | Name | Condition |
|-----|------|-----------|
| isBoxDraw | Codepoint in U+2500..U+257F or U+2580..U+259F |
| isHighlighted | bg ≠ defaultBg (after INVERSE swap) |
| isFgStyled | fg ≠ defaultFg |
| isEmpty | codepoint === 0 or codepoint === 0x20 |
| isBlank | isEmpty AND !isHighlighted |
| isWide | width === 2 |
| isWideRight | previous cell has width === 2 |
| hasLink | hyperlink_id > 0 |

**Output:** `CellMeta[][]` (parallel grid, or packed bitfield)

### Step 3: Border Tracing

Find closed rectangles of box-drawing characters.

**Algorithm — Corner Tracing:**

1. For each cell where `isBoxDraw` AND is a top-left corner (┌ ╔ ┏ ╭):
2. Trace right along horizontal connectors (─ ═ ━ ┬ ┴ ╦ ╩ ┳ ┻) → find top-right corner (┐ ╗ ┓ ╮)
3. Trace down along vertical connectors (│ ║ ┃ ├ ┤ ╠ ╣ ┣ ┫) → find bottom-right corner (┘ ╝ ┛ ╯)
4. Verify bottom-left corner and bottom/left borders
5. If all four sides verify → emit `BorderFrame` token

**Corner classification:**
- Top-left: ┌ ╔ ┏ ╭ (connects right + down)
- Top-right: ┐ ╗ ┓ ╮ (connects left + down)
- Bottom-left: └ ╚ ┗ ╰ (connects right + up)
- Bottom-right: ┘ ╝ ┛ ╯ (connects left + up)

Nested frames: after finding a frame, recursively scan its interior for inner frames.

Title detection: extract text content from the top border row between corners.

**Output:** `BorderFrame { bounds, interior, style, title? }[]`

### Step 4: Block Segmentation

Connected-component flood fill on highlighted cells (4-connected), scoped to each frame interior (or root viewport for unframed areas).

For each component, compute bounding box and classify by shape:
- `spansFullWidth AND height === 1` → full-width block
- `width < frameWidth AND height === 1` → small block
- `height > 1` → multi-row block

Multiple small blocks on the same row are emitted as separate tokens (the parser decides if they're a button group, tab bar, etc.).

**Output:** `HighlightedBlock { bounds, color: RGB, shape }[]`

### Step 5: Run Extraction

Within each scope (frame interior or root viewport, excluding areas covered by child frames), extract contiguous non-empty text cells into `TextRun` tokens. A new run starts when fg/bg/flags change.

Also emit:
- `WhitespaceGap { bounds, height }` for blank rows between content sections
- `LinkSpan { bounds, hyperlinkId, text }` for cells with `hyperlinkId > 0`
- `CursorToken { position, visible }` for cursor location

**Output:** `TextRun[]`, `WhitespaceGap[]`, `LinkSpan[]`, `CursorToken`

### Token Type Summary

| Token | Fields | Source |
|-------|--------|--------|
| `BorderFrame` | bounds, interior, style, title? | Step 3 |
| `HighlightedBlock` | bounds, color, shape | Step 4 |
| `TextRun` | bounds, spans: RawSpan[] | Step 5 |
| `WhitespaceGap` | bounds, height | Step 5 |
| `LinkSpan` | bounds, hyperlinkId, text | Step 5 |
| `CursorToken` | position, visible | Step 5 |

## Parser

Consumes tokens within a scope and produces AST nodes. Uses recursive descent scoped by frames.

### Scope Parsing

```
parseScope(tokens: Token[], bounds: TRect) → ASTNode[]

1. Set aside CursorToken for input detection

2. For each BorderFrame token in scope:
   - title = extract text from top border row
   - innerTokens = tokens within frame.interior
   - children = parseScope(innerTokens, frame.interior)  // recurse
   - emit Panel { border, title, children }
   - remove consumed tokens

3. Remaining tokens → parseFlatContent(tokens, cursor)
```

### Flat Content Parsing

Tokens within a scope (no remaining frames) are grouped by row ranges, split on `WhitespaceGap` into sections. Each section is matched against patterns in specificity order. First match wins.

**Pattern priority (highest → lowest):**

1. **SelectList** — 3+ TextRun/HighlightedBlock tokens at consecutive rows with consistent indentation AND (numbered markers `/^\d+[.)]\s/` OR arrow marker `/^[❯›>→]\s/` OR exactly one highlighted row among peers). Scoring: consistent indentation +3, consistent markers +3, sequential numbering +2, one highlighted row +3, arrow marker +3. Score ≥ 5 → SelectList with SelectItem children.

2. **Table** — 3+ TextRun tokens with 2+ consistent column boundaries detected via separator characters (│ | ┃ at >60% of rows at same column) or whitespace alignment. First row bold/underlined or followed by border row → header. Emit Table with TableRow children.

3. **DiffBlock** — Consecutive TextRuns where lines start with `+`/`-` prefixes OR have consistent green-fg / red-fg coloring. Emit DiffBlock with TextLine children, each marked as added/removed/context.

4. **Confirm** — Input-like region with exactly 2 short options detected (y/n, Yes/No, Approve/Reject — two small HighlightedBlocks or bracketed letters). Emit Confirm with question text and options.

5. **TextInput** — Cursor is in this section + prompt character detected to left of cursor (> $ % # : ? ❯ ›) or fg color change at prompt boundary. Emit TextInput with prompt, value, cursorOffset, suggestion.

6. **ActionTarget** — Small HighlightedBlock tokens on a row. Scoring: non-default bg +2, short text (<20 chars) +1, bold/inverse +1, surrounded by space +1, hotkey hint ([x], (x), Ctrl+X) +2, peer group on same row +2. Score ≥ 3 → ActionTarget. Multiple on same row → separate ActionTarget nodes.

7. **StatusBar** — Full-width HighlightedBlock on last row of scope. Emit StatusBar with segments extracted from styling boundaries.

8. **Link** — LinkSpan tokens → Link nodes with text and hyperlinkId.

9. **Separator** — WhitespaceGap between sections → Separator with style based on gap content (blank rows, line chars, dashed chars).

10. **TextLine + Span** (always succeeds) — Remaining TextRun tokens grouped into TextLine nodes. Styling boundaries within a run produce separate Span children.

### Mode Detection

Runs before parsing, classifies the current viewport state:

| Mode | Detection |
|------|-----------|
| `tui` | `isAlternateScreen() === true` |
| `streaming` | >3 dirty rows per update cycle for >3 consecutive cycles, no interactive regions detected |
| `idle` | Cursor visible, cursor row matches prompt pattern, no dirty rows for >2 seconds |
| `interactive` | Default — everything else |

## Visitors

Each visitor walks the AST for a single purpose. The AST is immutable — visitors read and produce output.

### RenderVisitor — AST → React Components

Clean switch on node type. 1:1 mapping:

| AST Node | React Component |
|----------|----------------|
| Document | `<SessionGUIView>` |
| Panel | `<NodePanel>` |
| Group | `<NodeGroup>` |
| TextLine | `<NodeTextLine>` |
| Span | `<NodeSpan>` |
| SelectList | `<NodeSelectList>` |
| SelectItem | `<NodeSelectItem>` |
| Confirm | `<NodeConfirm>` |
| TextInput | `<NodeTextInput>` |
| ActionTarget | `<NodeActionTarget>` |
| StatusBar | `<NodeStatusBar>` |
| Table | `<NodeTable>` |
| TableRow | `<NodeTableRow>` |
| DiffBlock | `<NodeDiffBlock>` |
| Link | `<NodeLink>` |
| Separator | `<NodeSeparator>` |

All components use the existing threads MUI theme and `@tdsk/components`. Light and dark mode supported via existing theme toggle.

### FeedVisitor — AST Diffs → Feed Events

Compares AST(t) vs AST(t-1) to extract feed events:

**Feed event types:**

```
TFeedEvent =
  | { kind: 'action';  status: 'running' | 'done' | 'error'; action: string; target: string; detail?: Document }
  | { kind: 'prompt';  status: 'waiting' | 'answered'; question: string; options?: string[]; answer?: string }
  | { kind: 'output';  status: 'streaming' | 'complete'; lines: TextLine[]; summary?: string; collapsed: boolean }
  | { kind: 'tui';     status: 'active' | 'exited'; regionTree: Document }
  | { kind: 'input';   text: string; source: 'user' }
  | { kind: 'idle';    timestamp: number }
```

**Diff rules:**
- New `TextInput` appeared → `{ kind: 'prompt', status: 'waiting' }`
- `TextInput` disappeared → mark prompt as `answered`
- New `DiffBlock` appeared → `{ kind: 'action', status: 'running', action: 'edit' }`
- New `SelectList` appeared → `{ kind: 'prompt', status: 'waiting' }` with options
- `SelectList.selectedIndex` changed → selection made
- Large volume of new `TextLine` nodes → `{ kind: 'output', status: 'streaming' }`
- Mode → `tui` → `{ kind: 'tui', status: 'active' }`
- Mode → `idle` for >2s → `{ kind: 'idle' }`

**Feed rendering rules:**
- Newest events at the bottom, auto-scroll
- Action cards: colored status dot + action type label + target + expandable detail
- Prompt cards: interactive response components (buttons, list items, input). Once answered, collapse to show answer inline
- Output cards: streaming lines with auto-scroll. When complete, collapse with line count summary. Click to expand.
- TUI cards: take over full view. Activity feed pauses. On exit, summary card inserted, feed resumes.
- User input cards: styled distinctly from system output
- Idle markers: subtle timestamp dividers
- Completed cards auto-collapse to single line for scannability

### InteractionVisitor — Nodes → Keystroke Handlers

For every interactive node, computes the keystroke sequence from current cursor position to target:

| Node Type | Interaction |
|-----------|-------------|
| SelectItem at index N | Arrow keys from cursor to list → arrow to index → Enter |
| SelectItem (numbered) | Type number + Enter |
| Confirm option | Send option character ('y'/'n') |
| TextInput | Forward keystrokes directly |
| ActionTarget with hotkey | Send hotkey directly |
| ActionTarget without hotkey | Navigate to bounds via arrows → Enter |
| Link | Open URL in browser (no terminal keystroke) |

**Navigation computation:** Cursor position is known. Target node bounds are known. The grid tells you everything in between. Arrow-key sequence = delta from cursor to target. For cross-panel navigation, compute panel traversal (Tab or modifier key to switch focus groups, then arrows within).

All interactions flow through a single `sendKeystroke()` function → WASM onData → WebSocket → backend SSH.

### AccessibilityVisitor — Nodes → ARIA Annotations

| Node Type | ARIA |
|-----------|------|
| SelectList | `role="listbox"`, `aria-activedescendant` |
| SelectItem | `role="option"`, `aria-selected` |
| TextInput | `role="textbox"`, `aria-label` from prompt |
| ActionTarget | `role="button"`, `aria-label` from label |
| Table | `role="table"` |
| TableRow (header) | `role="columnheader"` on cells |
| StatusBar | `role="status"`, `aria-live="polite"` |

## Incremental Updates

Dirty row tracking from ghostty enables efficient incremental processing:

1. `getDirtyRows()` → which rows changed
2. **Tokenizer:** re-tokenize only dirty rows (with 1-row margin for boundary detection). Merge with unchanged tokens.
3. **Parser:** re-parse only scopes that contain dirty tokens. Unchanged scopes keep cached AST subtrees.
4. **Visitors:** diff new AST against previous AST. Only changed subtrees produce new visitor output.
5. React reconciles only changed components.

**Scope-to-row index:** `Map<number, Scope[]>` — enables O(1) lookup of affected scopes from dirty rows.

## Activity Feed Engine

Sits between visitors and React. Converts AST changes over time into a chronological timeline.

### Mode Handling

| Viewport Mode | Feed Behavior |
|---------------|---------------|
| `interactive` | Action cards in timeline — reads, edits, prompts, outputs |
| `tui` | Feed pauses, full-viewport region components rendered |
| `streaming` | Collapsible output card, auto-scrolling, line count summary |
| `idle` | Input-ready state, subtle idle marker in feed |

### Mode Transitions

- `interactive` → `tui`: push TUI event, pause feed, render full-viewport
- `tui` → `interactive`: mark TUI exited, insert summary card, resume feed
- `interactive` → `streaming`: push output event, start accumulating lines
- `streaming` → `idle`: mark output complete, collapse card

### Non-AI-Tool Scenarios

- **Build logs** (streaming mode): Collapsible output card with auto-scroll. Summary when complete ("47 lines of output"). Click to expand.
- **TUI apps** (tui mode): Full-viewport component rendering via AST. All panels, lists, tabs, inputs rendered as interactive components. Feed resumes when TUI exits.
- **Simple commands** (interactive → idle): Single card with command + output, collapsed if short.

## Input Model

Persistent input area at bottom of view, visible in both GUI and terminal modes.

**Chat-style text input:** Text field at bottom. User types natural language or commands. On submit → raw terminal input via `sendKeystroke()`. User input card appears in feed.

**Interactive region responses:** Prompt cards in the feed contain interactive components (buttons for y/n, list items for selections, input fields for text). User responds by clicking within the card.

**Both paths converge:** Whether clicking a button or typing in the text field, the same `sendKeystroke()` function translates to terminal input. Terminal is always source of truth.

## Session Page Structure

```
┌─────────────────────────────────────────────────┐
│  Session Header                                  │
│  [Runtime icon + name]  [Project]       [Timer]  │
│  [Status counters: reads | edits | pending]      │
│                              [GUI | Terminal] ←── toggle
├─────────────────────────────────────────────────┤
│  Content Area (switches based on toggle)         │
│                                                  │
│  GUI Mode (default):                             │
│    Activity Feed (vertical timeline)             │
│    - Action cards                                │
│    - Prompt cards (interactive)                  │
│    - Output cards (collapsible)                  │
│    - User input cards                            │
│    OR (TUI detected): Full-viewport components   │
│                                                  │
│  Terminal Mode (toggle):                         │
│    TerminalView (ghostty canvas — unchanged)     │
│                                                  │
├─────────────────────────────────────────────────┤
│  Input Area                                      │
│  [Text input field]                  [Send btn]  │
└─────────────────────────────────────────────────┘
```

**Toggle behavior:**
- GUI → Terminal: ghostty canvas attaches to shared WASM instance, renders immediately. Feed preserved in memory.
- Terminal → GUI: canvas detaches, spatial analyzer reads current viewport. Feed history intact.
- Both views stay hot in memory. Switching is instant.

## What Gets Removed

| File/Module | Action |
|---|---|
| `repos/domain/src/parser/terminalParser.ts` | Remove |
| `repos/domain/src/parser/changeDetector.ts` | Remove |
| `repos/domain/src/parser/contentFilter.ts` | Remove |
| `repos/domain/src/parser/patternMatcher.ts` | Remove |
| `repos/domain/src/parser/cellLayout.probe.test.ts` | Remove |
| `repos/domain/src/parser/contentFilter.test.ts` | Remove |
| `repos/domain/src/types/gui.types.ts` | Remove (replaced by AST types in threads) |
| `repos/domain/src/constants/gui.ts` | Remove |
| `repos/domain/src/constants/gui.test.ts` | Remove |
| `repos/backend/src/services/interpreter/` | Remove entirely |
| `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` | Simplify — remove parsing, event batching, generative UI |
| `repos/threads/src/components/ChatView/` | Replace with new GUI view |
| `repos/threads/src/components/ChatView/GenerativeUIRenderer.tsx` | Remove |
| `repos/threads/src/components/ChatView/registry/` | Remove |

## What Stays

| File/Module | Status |
|---|---|
| `repos/threads/src/components/TerminalView/` | Unchanged |
| `repos/domain/src/parser/ghosttyVT.ts` | Stays — shared WASM wrapper |
| `repos/threads/src/actions/sessions/openSession.ts` | Simplified — binary frames only |
| Backend WebSocket handler | Simplified — raw byte relay + storage |

## Visual Design

**Style:** Rich Dashboard — dark themed, information-dense, stat counters, colored status indicators. Vercel/GitHub Actions aesthetic.

**Layout:** Activity Feed — vertical timeline with color-coded status dots. Green = done, amber = needs attention, purple = working. Expandable cards for details.

**Theming:** All components use existing threads MUI theme + `@tdsk/components`. Light and dark mode via existing theme toggle. Approved mockups define layout, format, and interaction patterns — not literal colors.

**Approved visual references:** Saved in `docs/superpowers/visuals/`:
- `2026-04-15-terminal-ast-gui-design-direction.html` — Rich Dashboard aesthetic (card layout, status counters, inline diffs, approval flows)
- `2026-04-15-terminal-ast-gui-activity-feed.html` — Activity Feed timeline (vertical timeline, color-coded dots, expandable cards)
