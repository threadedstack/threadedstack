# Terminal AST GUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ChatView in the threads SPA with a deterministic Terminal AST Parser that reads cell data from a headless ghostty-web WASM instance, parses it into a typed AST, and renders it as native MUI components in an activity-feed dashboard.

**Architecture:** Four browser-side layers — (1) Terminal State via ghostty WASM headless instance, (2) 5-step Tokenizer that scans the cell grid into typed tokens, (3) Recursive-descent Parser that produces a 16-node-type AST, (4) Four Visitors that convert the AST into React components, feed events, keystroke handlers, and ARIA annotations. The backend simplifies to a raw byte pipe + storage. All parsing moves client-side.

**Tech Stack:** TypeScript, React 18, MUI 6, Jotai, ghostty-web WASM, Vite, Vitest

**Spec:** `docs/superpowers/specs/2026-04-15-terminal-ast-gui-design.md`
**Visual refs:** `docs/superpowers/visuals/2026-04-15-terminal-ast-gui-*.html`

---

## CRITICAL RULES FOR ALL TASKS

- **NEVER** run `git commit`, `git push`, or any git mutation. Output commit messages as text only.
- **NEVER** save files to the project root. Use appropriate subdirectories.
- **NEVER** add TODO/FIXME comments. Implement fully or explain why you cannot.
- **NEVER** re-export from another package. Update all callsites to the real source.
- Exported types go in the repo's `types/` directory. Non-exported types stay local.
- All new code goes in `repos/threads/src/` unless explicitly stated otherwise.
- Run `cd repos/threads && pnpm test` for unit tests, `cd repos/threads && pnpm types` for type checking.

---

## File Structure

### New Files (`repos/threads/src/`)

```
ast/
  types.ts              — AST node types, TRect, RGB, TFeedEvent, viewport modes
  nodes.ts              — Factory functions for creating typed AST nodes
  index.ts              — Barrel export

tokenizer/
  types.ts              — Token types (BorderFrame, HighlightedBlock, TextRun, etc.)
  decode.ts             — Cell byte decoder (16-byte WASM cell → structured fields)
  palette.ts            — Step 1: Palette detection (frequency-count bg/fg)
  classify.ts           — Step 2: Cell classification (metadata bits per cell)
  borders.ts            — Step 3: Border tracing (corner-based rectangle detection)
  blocks.ts             — Step 4: Block segmentation (connected-component flood fill)
  runs.ts               — Step 5: Run extraction (styled text spans + whitespace + links)
  tokenizer.ts          — Orchestrator: runs all 5 steps, produces Token[]
  index.ts

parser/
  modeDetector.ts       — Viewport mode detection (interactive/tui/streaming/idle)
  scopeParser.ts        — Recursive descent parser scoped by BorderFrames → Panels
  flatParser.ts         — Flat content pattern matching (10 patterns, specificity order)
  parser.ts             — Orchestrator: mode + scope + flat → Document AST
  index.ts

visitors/
  renderVisitor.ts      — AST → React element tree (1:1 node-to-component mapping)
  feedVisitor.ts        — AST(t) vs AST(t-1) diff → TFeedEvent[]
  interactionVisitor.ts — Interactive nodes → keystroke handler functions
  accessibilityVisitor.ts — Nodes → ARIA prop annotations
  index.ts

engine/
  wasmBridge.ts         — Browser-compatible ghostty WASM loader + VTerminal with viewport access
  sessionEngine.ts      — Per-session pipeline: bytes → WASM → tokenize → parse → visit → state
  index.ts

components/
  ASTNodes/
    NodeSpan.tsx        — Styled inline text span
    NodeTextLine.tsx    — Row of Span children
    NodePanel.tsx       — Bordered container with optional title
    NodeGroup.tsx       — Logical grouping, no visual border
    NodeSelectList.tsx  — List with selectable items
    NodeSelectItem.tsx  — Single selectable item with highlight
    NodeConfirm.tsx     — Yes/No confirmation prompt
    NodeTextInput.tsx   — Text input with cursor
    NodeActionTarget.tsx — Clickable button/action
    NodeStatusBar.tsx   — Full-width status bar with segments
    NodeTable.tsx       — Table container
    NodeTableRow.tsx    — Table row with cells
    NodeDiffBlock.tsx   — Diff display with add/remove coloring
    NodeLink.tsx        — Clickable hyperlink
    NodeSeparator.tsx   — Visual separator (blank/line/dashed)
    index.ts

  ActivityFeed/
    ActivityFeed.tsx    — Vertical timeline container with auto-scroll
    ActionCard.tsx      — Action event card (status dot + label + detail)
    PromptCard.tsx      — Interactive prompt card (buttons/list/input)
    OutputCard.tsx      — Collapsible streaming output card
    TUICard.tsx         — Full-viewport TUI takeover card
    UserInputCard.tsx   — User input display card
    IdleMarker.tsx      — Subtle timestamp divider
    index.ts

  SessionGUIView/
    SessionGUIView.tsx  — Main GUI view: header + feed/TUI + input
    index.ts

  SessionHeader/
    SessionHeader.tsx   — Runtime icon, project, timer, status counters
    index.ts

  ViewToggle/
    ViewToggle.tsx      — GUI/Terminal toggle button group
    index.ts

state/
  gui.ts                — Jotai atoms: AST, feed events, viewport mode, engine refs

hooks/
  useSessionEngine.ts   — Engine lifecycle (create/destroy on session open/close)
  useActivityFeed.ts    — Feed state subscription + auto-scroll management
```

### Modified Files

```
repos/threads/src/
  pages/Session/Session.tsx         — Replace ChatView/TerminalView toggle with SessionGUIView
  actions/sessions/openSession.ts   — Remove deriveToolState, add engine.write() for binary data
  state/sessions.ts                 — Remove sessionEventsAtom, sessionToolStateAtom
  state/accessors.ts                — Remove event/toolState accessors, add GUI accessors
  state/selectors.ts                — Remove event/toolState selectors, add GUI selectors

repos/backend/src/
  endpoints/sandboxes/onShellConnect.ts — Remove TerminalParser, GhosttyVT, deriveToolState,
                                          event batching, ChunkBuffer, broadcastUpgrade
  types/shellSession.types.ts           — Remove parser, toolState, lastRunningToolCall fields

repos/domain/src/
  parser/index.ts                   — Keep only GhosttyVT + VTerminal exports
  types/index.ts                    — Remove gui.types re-export
  types/shellEvent.types.ts         — Remove TJsonComponentTree reference
  constants/index.ts                — Remove gui.ts re-export
  models/organization.ts            — Remove TOrgConfig import/usage
```

### Removed Files

```
repos/domain/src/parser/changeDetector.ts (+ .test.ts)
repos/domain/src/parser/terminalParser.ts (+ .test.ts)
repos/domain/src/parser/contentFilter.ts (+ .test.ts)
repos/domain/src/parser/deriveToolState.ts (+ .test.ts)
repos/domain/src/parser/patternMatcher.ts (+ .test.ts)
repos/domain/src/parser/markdownFormatter.ts (+ .test.ts)
repos/domain/src/parser/web.ts
repos/domain/src/parser/matchers/ (entire directory)
repos/domain/src/types/gui.types.ts
repos/domain/src/constants/gui.ts (+ .test.ts)
repos/threads/src/components/ChatView/ (entire directory — replaced by SessionGUIView)
```

---

## Task 1: AST Types, Token Types, and Feed Event Types

**Files:**
- Create: `repos/threads/src/ast/types.ts`
- Create: `repos/threads/src/ast/nodes.ts`
- Create: `repos/threads/src/ast/index.ts`
- Create: `repos/threads/src/tokenizer/types.ts`
- Test: `repos/threads/src/ast/nodes.test.ts`

All other tasks depend on these types. They define the contracts for every layer.

- [ ] **Step 1: Create AST type definitions**

Create `repos/threads/src/ast/types.ts`:

```typescript
// --- Geometry ---
export type TRect = { top: number; left: number; bottom: number; right: number }
export type RGB = { r: number; g: number; b: number }

// --- Viewport Modes ---
export type TViewportMode = 'interactive' | 'tui' | 'streaming' | 'idle'

// --- Terminal Node (leaf) ---
export type TSpan = {
  type: 'Span'
  text: string
  fg: RGB
  bg: RGB
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  faint: boolean
  inverse: boolean
}

// --- Leaf-ish Nodes ---
export type TTextLine = {
  type: 'TextLine'
  bounds: TRect
  children: TSpan[]
}

export type TSelectItem = {
  type: 'SelectItem'
  bounds: TRect
  selected: boolean
  index: number
  children: TSpan[]
}

export type TTableRow = {
  type: 'TableRow'
  bounds: TRect
  isHeader: boolean
  cells: TSpan[][]
}

export type TStatusBar = {
  type: 'StatusBar'
  bounds: TRect
  segments: TSpan[][]
}

export type TConfirm = {
  type: 'Confirm'
  bounds: TRect
  question: string
  options: [string, string]
  focusedIndex: 0 | 1
}

export type TTextInput = {
  type: 'TextInput'
  bounds: TRect
  prompt: string
  value: string
  cursorOffset: number
  suggestion?: string
}

export type TActionTarget = {
  type: 'ActionTarget'
  bounds: TRect
  label: string
  hotkey?: string
  focused: boolean
  children: TSpan[]
}

export type TLink = {
  type: 'Link'
  bounds: TRect
  hyperlinkId: number
  url?: string
  children: TSpan[]
}

export type TSeparator = {
  type: 'Separator'
  bounds: TRect
  style: 'blank' | 'line' | 'dashed'
}

// --- Container Nodes ---
export type TSelectList = {
  type: 'SelectList'
  bounds: TRect
  selectedIndex: number
  style: 'arrow' | 'numbered' | 'highlighted'
  children: TSelectItem[]
}

export type TTable = {
  type: 'Table'
  bounds: TRect
  hasHeader: boolean
  children: TTableRow[]
}

export type TDiffBlock = {
  type: 'DiffBlock'
  bounds: TRect
  children: TTextLine[]
}

export type TGroup = {
  type: 'Group'
  bounds: TRect
  children: TContentNode[]
}

export type TPanel = {
  type: 'Panel'
  bounds: TRect
  border: 'single' | 'double' | 'heavy' | 'rounded'
  title?: string
  children: TContentNode[]
}

// --- Content Node Union ---
export type TContentNode =
  | TPanel
  | TGroup
  | TTextLine
  | TSelectList
  | TConfirm
  | TTextInput
  | TActionTarget
  | TStatusBar
  | TTable
  | TDiffBlock
  | TLink
  | TSeparator

// --- Document Root ---
export type TDocument = {
  type: 'Document'
  bounds: TRect
  cursor: { x: number; y: number; visible: boolean }
  mode: TViewportMode
  children: TContentNode[]
}

// --- AST Node Union (all types) ---
export type TASTNode = TDocument | TContentNode | TSpan | TSelectItem | TTableRow

// --- Feed Event Types ---
export type TFeedEvent =
  | { kind: 'action'; id: string; status: 'running' | 'done' | 'error'; action: string; target: string; detail?: TDocument }
  | { kind: 'prompt'; id: string; status: 'waiting' | 'answered'; question: string; options?: string[]; answer?: string }
  | { kind: 'output'; id: string; status: 'streaming' | 'complete'; lines: TTextLine[]; summary?: string; collapsed: boolean }
  | { kind: 'tui'; id: string; status: 'active' | 'exited'; regionTree: TDocument }
  | { kind: 'input'; id: string; text: string; source: 'user' }
  | { kind: 'idle'; id: string; timestamp: number }

// --- ARIA Props (from AccessibilityVisitor) ---
export type TAriaProps = Record<string, string | boolean | undefined>

// --- Interaction Handler ---
export type TInteractionHandler = {
  nodeType: string
  bounds: TRect
  label: string
  execute: () => void
}
```

- [ ] **Step 2: Create AST node factory functions**

Create `repos/threads/src/ast/nodes.ts`:

```typescript
import type {
  TRect, RGB, TSpan, TTextLine, TPanel, TGroup, TSelectList, TSelectItem,
  TConfirm, TTextInput, TActionTarget, TStatusBar, TTable, TTableRow,
  TDiffBlock, TLink, TSeparator, TDocument, TContentNode, TViewportMode,
} from './types'

export const span = (text: string, fg: RGB, bg: RGB, flags: Partial<Omit<TSpan, 'type' | 'text' | 'fg' | 'bg'>> = {}): TSpan => ({
  type: 'Span', text, fg, bg,
  bold: false, italic: false, underline: false, strikethrough: false, faint: false, inverse: false,
  ...flags,
})

export const textLine = (bounds: TRect, children: TSpan[]): TTextLine => ({
  type: 'TextLine', bounds, children,
})

export const panel = (bounds: TRect, border: TPanel['border'], children: TContentNode[], title?: string): TPanel => ({
  type: 'Panel', bounds, border, children, ...(title != null ? { title } : {}),
})

export const group = (bounds: TRect, children: TContentNode[]): TGroup => ({
  type: 'Group', bounds, children,
})

export const selectList = (bounds: TRect, selectedIndex: number, style: TSelectList['style'], children: TSelectItem[]): TSelectList => ({
  type: 'SelectList', bounds, selectedIndex, style, children,
})

export const selectItem = (bounds: TRect, index: number, selected: boolean, children: TSpan[]): TSelectItem => ({
  type: 'SelectItem', bounds, selected, index, children,
})

export const confirm = (bounds: TRect, question: string, options: [string, string], focusedIndex: 0 | 1): TConfirm => ({
  type: 'Confirm', bounds, question, options, focusedIndex,
})

export const textInput = (bounds: TRect, prompt: string, value: string, cursorOffset: number, suggestion?: string): TTextInput => ({
  type: 'TextInput', bounds, prompt, value, cursorOffset, ...(suggestion != null ? { suggestion } : {}),
})

export const actionTarget = (bounds: TRect, label: string, focused: boolean, children: TSpan[], hotkey?: string): TActionTarget => ({
  type: 'ActionTarget', bounds, label, focused, children, ...(hotkey != null ? { hotkey } : {}),
})

export const statusBar = (bounds: TRect, segments: TSpan[][]): TStatusBar => ({
  type: 'StatusBar', bounds, segments,
})

export const table = (bounds: TRect, hasHeader: boolean, children: TTableRow[]): TTable => ({
  type: 'Table', bounds, hasHeader, children,
})

export const tableRow = (bounds: TRect, isHeader: boolean, cells: TSpan[][]): TTableRow => ({
  type: 'TableRow', bounds, isHeader, cells,
})

export const diffBlock = (bounds: TRect, children: TTextLine[]): TDiffBlock => ({
  type: 'DiffBlock', bounds, children,
})

export const link = (bounds: TRect, hyperlinkId: number, children: TSpan[], url?: string): TLink => ({
  type: 'Link', bounds, hyperlinkId, children, ...(url != null ? { url } : {}),
})

export const separator = (bounds: TRect, style: TSeparator['style']): TSeparator => ({
  type: 'Separator', bounds, style,
})

export const document = (
  bounds: TRect,
  cursor: TDocument['cursor'],
  mode: TViewportMode,
  children: TContentNode[],
): TDocument => ({
  type: 'Document', bounds, cursor, mode, children,
})
```

- [ ] **Step 3: Create barrel export**

Create `repos/threads/src/ast/index.ts`:

```typescript
export * from './types'
export * from './nodes'
```

- [ ] **Step 4: Create token type definitions**

Create `repos/threads/src/tokenizer/types.ts`:

```typescript
import type { TRect, RGB } from '@TTH/ast'

// --- Decoded Cell (from 16-byte WASM cell) ---
export type TDecodedCell = {
  codepoint: number
  fg: RGB
  bg: RGB
  flags: number
  width: number
  hyperlinkId: number
  graphemeLen: number
}

// --- Cell flags bitfield ---
export const CellFlags = {
  BOLD:          0x01,
  ITALIC:        0x02,
  UNDERLINE:     0x04,
  STRIKETHROUGH: 0x08,
  INVERSE:       0x10,
  INVISIBLE:     0x20,
  BLINK:         0x40,
  FAINT:         0x80,
} as const

// --- Cell metadata bits (from classification step) ---
export type TCellMeta = {
  isBoxDraw: boolean
  isHighlighted: boolean
  isFgStyled: boolean
  isEmpty: boolean
  isBlank: boolean
  isWide: boolean
  isWideRight: boolean
  hasLink: boolean
}

// --- Palette ---
export type TPalette = {
  defaultBg: RGB
  defaultFg: RGB
}

// --- Raw Span (unstyled, from run extraction) ---
export type TRawSpan = {
  text: string
  fg: RGB
  bg: RGB
  flags: number
}

// --- Token types ---
export type TBorderFrame = {
  type: 'BorderFrame'
  bounds: TRect
  interior: TRect
  style: 'single' | 'double' | 'heavy' | 'rounded'
  title?: string
}

export type THighlightedBlock = {
  type: 'HighlightedBlock'
  bounds: TRect
  color: RGB
  shape: 'full-width' | 'small' | 'multi-row'
}

export type TTextRun = {
  type: 'TextRun'
  bounds: TRect
  spans: TRawSpan[]
}

export type TWhitespaceGap = {
  type: 'WhitespaceGap'
  bounds: TRect
  height: number
}

export type TLinkSpan = {
  type: 'LinkSpan'
  bounds: TRect
  hyperlinkId: number
  text: string
}

export type TCursorToken = {
  type: 'CursorToken'
  position: { x: number; y: number }
  visible: boolean
}

export type TToken =
  | TBorderFrame
  | THighlightedBlock
  | TTextRun
  | TWhitespaceGap
  | TLinkSpan
  | TCursorToken
```

- [ ] **Step 5: Write test for node factories**

Create `repos/threads/src/ast/nodes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { span, textLine, panel, document, selectList, selectItem } from './nodes'

describe('AST node factories', () => {
  const rect = { top: 0, left: 0, bottom: 1, right: 10 }
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }

  it('creates a Span with default flags', () => {
    const s = span('hello', white, black)
    expect(s.type).toBe('Span')
    expect(s.text).toBe('hello')
    expect(s.bold).toBe(false)
    expect(s.italic).toBe(false)
  })

  it('creates a Span with override flags', () => {
    const s = span('bold', white, black, { bold: true })
    expect(s.bold).toBe(true)
    expect(s.italic).toBe(false)
  })

  it('creates a TextLine with children', () => {
    const line = textLine(rect, [span('hi', white, black)])
    expect(line.type).toBe('TextLine')
    expect(line.children).toHaveLength(1)
  })

  it('creates a Panel with border and optional title', () => {
    const p = panel(rect, 'single', [], 'Title')
    expect(p.type).toBe('Panel')
    expect(p.border).toBe('single')
    expect(p.title).toBe('Title')
  })

  it('creates a Document with mode and cursor', () => {
    const doc = document(rect, { x: 0, y: 0, visible: true }, 'idle', [])
    expect(doc.type).toBe('Document')
    expect(doc.mode).toBe('idle')
    expect(doc.children).toHaveLength(0)
  })

  it('creates a SelectList with items', () => {
    const items = [
      selectItem(rect, 0, true, [span('Option A', white, black)]),
      selectItem(rect, 1, false, [span('Option B', white, black)]),
    ]
    const list = selectList(rect, 0, 'arrow', items)
    expect(list.type).toBe('SelectList')
    expect(list.selectedIndex).toBe(0)
    expect(list.children).toHaveLength(2)
    expect(list.children[0].selected).toBe(true)
  })
})
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd repos/threads && npx vitest run src/ast/nodes.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 7: Commit**

```
feat(threads): add AST types, token types, and node factories

16 AST node types, 6 token types, and factory functions for the
Terminal AST GUI parser pipeline. Types define the contracts for
tokenizer → parser → visitor data flow.
```

---

## Task 2: WASM Browser Bridge

**Files:**
- Create: `repos/threads/src/engine/wasmBridge.ts`
- Create: `repos/threads/src/engine/index.ts`
- Test: `repos/threads/src/engine/wasmBridge.test.ts`

Loads the ghostty-vt WASM binary in the browser and provides a `TBrowserVTerminal` interface with full cell-grid viewport access. This is the foundation for the GUI pipeline — without it, the tokenizer has no cell data to read.

The key difference from domain's `GhosttyVT`: domain loads WASM via Node.js `readFile`; this loads via browser `fetch`. Both use the same WASM module and export names.

- [ ] **Step 1: Create the WASM bridge**

Create `repos/threads/src/engine/wasmBridge.ts`:

```typescript
import { GhosttyVTCellSize } from '@tdsk/domain'

// Vite resolves this to an asset URL at build time
import ghosttyWasmUrl from 'ghostty-web/ghostty-vt.wasm?url'

const GhosttyVTConfigSize = 80

type WasmExports = {
  memory: WebAssembly.Memory
  ghostty_terminal_new_with_config: (cols: number, rows: number, configPtr: number) => number
  ghostty_terminal_free: (handle: number) => void
  ghostty_terminal_write: (handle: number, ptr: number, len: number) => void
  ghostty_terminal_resize: (handle: number, cols: number, rows: number) => void
  ghostty_terminal_is_alternate_screen: (handle: number) => number
  ghostty_render_state_update: (handle: number) => number
  ghostty_render_state_get_cursor_x: (handle: number) => number
  ghostty_render_state_get_cursor_y: (handle: number) => number
  ghostty_render_state_get_cursor_visible: (handle: number) => number
  ghostty_render_state_is_row_dirty: (handle: number, row: number) => boolean
  ghostty_render_state_mark_clean: (handle: number) => void
  ghostty_render_state_get_viewport: (handle: number, bufPtr: number, cellCount: number) => number
  ghostty_wasm_alloc_u8_array: (len: number) => number
  ghostty_wasm_free_u8_array: (ptr: number, len: number) => void
}

export type TBrowserVTerminal = {
  readonly cols: number
  readonly rows: number
  write: (data: string | Uint8Array) => void
  resize: (newCols: number, newRows: number) => void
  getDirtyRows: () => number[]
  getViewport: () => DataView
  getCursor: () => { x: number; y: number; visible: boolean }
  isAlternateScreen: () => boolean
  markClean: () => void
  free: () => void
}

let wasmModule: WebAssembly.Module | null = null
let modulePromise: Promise<WebAssembly.Module> | null = null

async function loadModule(): Promise<WebAssembly.Module> {
  if (wasmModule) return wasmModule
  if (modulePromise) return modulePromise
  modulePromise = (async () => {
    const response = await fetch(ghosttyWasmUrl)
    const mod = await WebAssembly.compileStreaming(response)
    wasmModule = mod
    return mod
  })()
  return modulePromise
}

export async function createBrowserTerminal(cols = 80, rows = 24): Promise<TBrowserVTerminal> {
  const mod = await loadModule()
  const encoder = new TextEncoder()

  let instance: WebAssembly.Instance
  instance = await WebAssembly.instantiate(mod, {
    env: {
      log: (ptr: number, len: number) => {
        const exports = instance.exports as unknown as WasmExports
        const buf = new Uint8Array(exports.memory.buffer, ptr, len)
        console.debug('[ghostty-vt]', new TextDecoder().decode(buf))
      },
    },
  })

  const exports = instance.exports as unknown as WasmExports
  const { memory } = exports

  // Allocate + zero config, create terminal
  const configPtr = exports.ghostty_wasm_alloc_u8_array(GhosttyVTConfigSize)
  new Uint8Array(memory.buffer).fill(0, configPtr, configPtr + GhosttyVTConfigSize)
  const handle = exports.ghostty_terminal_new_with_config(cols, rows, configPtr)
  exports.ghostty_wasm_free_u8_array(configPtr, GhosttyVTConfigSize)
  if (!handle) throw new Error('Failed to create ghostty browser terminal')

  // Clear screen to initialize cells
  const clearBytes = encoder.encode('\x1b[2J\x1b[H')
  const clearPtr = exports.ghostty_wasm_alloc_u8_array(clearBytes.length)
  new Uint8Array(memory.buffer).set(clearBytes, clearPtr)
  exports.ghostty_terminal_write(handle, clearPtr, clearBytes.length)
  exports.ghostty_wasm_free_u8_array(clearPtr, clearBytes.length)

  let _cols = cols
  let _rows = rows
  let _freed = false
  let _vpBufPtr = 0
  let _vpBufSize = 0

  const ensureViewportBuf = () => {
    const cellCount = _cols * _rows
    const bufSize = cellCount * GhosttyVTCellSize
    if (_vpBufPtr && _vpBufSize !== bufSize) {
      exports.ghostty_wasm_free_u8_array(_vpBufPtr, _vpBufSize)
      _vpBufPtr = 0
    }
    if (!_vpBufPtr) {
      _vpBufPtr = exports.ghostty_wasm_alloc_u8_array(bufSize)
      _vpBufSize = bufSize
    }
    return { bufPtr: _vpBufPtr, bufSize, cellCount }
  }

  return {
    get cols() { return _cols },
    get rows() { return _rows },

    write(data: string | Uint8Array) {
      if (_freed) return
      const bytes = typeof data === 'string' ? encoder.encode(data) : data
      const ptr = exports.ghostty_wasm_alloc_u8_array(bytes.length)
      new Uint8Array(memory.buffer).set(bytes, ptr)
      exports.ghostty_terminal_write(handle, ptr, bytes.length)
      exports.ghostty_wasm_free_u8_array(ptr, bytes.length)
    },

    resize(newCols: number, newRows: number) {
      if (_freed) return
      _cols = newCols
      _rows = newRows
      exports.ghostty_terminal_resize(handle, newCols, newRows)
    },

    getDirtyRows(): number[] {
      if (_freed) return []
      exports.ghostty_render_state_update(handle)
      const dirty: number[] = []
      for (let r = 0; r < _rows; r++) {
        if (exports.ghostty_render_state_is_row_dirty(handle, r)) dirty.push(r)
      }
      return dirty
    },

    getViewport(): DataView {
      if (_freed) return new DataView(new ArrayBuffer(0))
      exports.ghostty_render_state_update(handle)
      const { bufPtr, bufSize, cellCount } = ensureViewportBuf()
      new Uint8Array(memory.buffer).fill(0, bufPtr, bufPtr + bufSize)
      exports.ghostty_render_state_get_viewport(handle, bufPtr, cellCount)
      return new DataView(memory.buffer, bufPtr, bufSize)
    },

    getCursor() {
      if (_freed) return { x: 0, y: 0, visible: false }
      exports.ghostty_render_state_update(handle)
      return {
        x: exports.ghostty_render_state_get_cursor_x(handle),
        y: exports.ghostty_render_state_get_cursor_y(handle),
        visible: !!exports.ghostty_render_state_get_cursor_visible(handle),
      }
    },

    isAlternateScreen() {
      if (_freed) return false
      return !!exports.ghostty_terminal_is_alternate_screen(handle)
    },

    markClean() {
      if (_freed) return
      exports.ghostty_render_state_mark_clean(handle)
    },

    free() {
      if (_freed) return
      _freed = true
      if (_vpBufPtr) {
        exports.ghostty_wasm_free_u8_array(_vpBufPtr, _vpBufSize)
        _vpBufPtr = 0
        _vpBufSize = 0
      }
      exports.ghostty_terminal_free(handle)
    },
  }
}
```

- [ ] **Step 2: Create barrel export**

Create `repos/threads/src/engine/index.ts`:

```typescript
export { createBrowserTerminal } from './wasmBridge'
export type { TBrowserVTerminal } from './wasmBridge'
```

- [ ] **Step 3: Verify Vite resolves the WASM import**

Check that `ghostty-web` has the WASM file:

Run: `ls repos/threads/node_modules/ghostty-web/ghostty-vt.wasm 2>/dev/null || ls node_modules/ghostty-web/ghostty-vt.wasm 2>/dev/null`

If the file doesn't exist at either path, check `find node_modules/ghostty-web -name '*.wasm'` and update the import path in wasmBridge.ts accordingly.

- [ ] **Step 4: Type check**

Run: `cd repos/threads && pnpm types`
Expected: No type errors in `engine/wasmBridge.ts`.

- [ ] **Step 5: Commit**

```
feat(threads): add browser WASM bridge for ghostty VT terminal

Loads ghostty-vt.wasm via Vite URL import and provides a
TBrowserVTerminal interface with full viewport cell-grid access
for the GUI tokenizer pipeline.
```

---

## Task 3: Cell Decoder and Palette Detection

**Files:**
- Create: `repos/threads/src/tokenizer/decode.ts`
- Create: `repos/threads/src/tokenizer/palette.ts`
- Test: `repos/threads/src/tokenizer/decode.test.ts`
- Test: `repos/threads/src/tokenizer/palette.test.ts`

The cell decoder unpacks the 16-byte WASM cell format into structured fields. Palette detection identifies the terminal's default foreground/background colors by frequency counting.

- [ ] **Step 1: Write cell decoder tests**

Create `repos/threads/src/tokenizer/decode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { decodeCell, buildTestViewport } from './decode'
import { GhosttyVTCellSize } from '@tdsk/domain'

describe('decodeCell', () => {
  it('decodes a cell with ASCII character and RGB colors', () => {
    const buf = new ArrayBuffer(GhosttyVTCellSize)
    const dv = new DataView(buf)
    // codepoint 65 = 'A' (little-endian u32)
    dv.setUint32(0, 65, true)
    // fg: r=255, g=128, b=64
    dv.setUint8(4, 255)
    dv.setUint8(5, 128)
    dv.setUint8(6, 64)
    // bg: r=0, g=0, b=0
    dv.setUint8(7, 0)
    dv.setUint8(8, 0)
    dv.setUint8(9, 0)
    // flags: BOLD (0x01)
    dv.setUint8(10, 0x01)
    // width: 1
    dv.setUint8(11, 1)
    // hyperlink_id: 0
    dv.setUint16(12, 0, true)
    // grapheme_len: 1
    dv.setUint8(14, 1)

    const cell = decodeCell(dv, 0)
    expect(cell.codepoint).toBe(65)
    expect(cell.fg).toEqual({ r: 255, g: 128, b: 64 })
    expect(cell.bg).toEqual({ r: 0, g: 0, b: 0 })
    expect(cell.flags).toBe(0x01)
    expect(cell.width).toBe(1)
    expect(cell.hyperlinkId).toBe(0)
  })

  it('decodes a cell with hyperlink', () => {
    const buf = new ArrayBuffer(GhosttyVTCellSize)
    const dv = new DataView(buf)
    dv.setUint32(0, 72, true) // 'H'
    dv.setUint16(12, 42, true) // hyperlink_id=42
    const cell = decodeCell(dv, 0)
    expect(cell.hyperlinkId).toBe(42)
  })

  it('decodes empty cell as codepoint 0', () => {
    const buf = new ArrayBuffer(GhosttyVTCellSize)
    const dv = new DataView(buf)
    const cell = decodeCell(dv, 0)
    expect(cell.codepoint).toBe(0)
  })
})

describe('buildTestViewport', () => {
  it('creates a viewport with specified text on row 0', () => {
    const { view, cols, rows } = buildTestViewport(3, 1, [{ row: 0, col: 0, text: 'Hi' }])
    expect(cols).toBe(3)
    expect(rows).toBe(1)
    const c0 = decodeCell(view, 0)
    expect(c0.codepoint).toBe(72) // 'H'
    const c1 = decodeCell(view, GhosttyVTCellSize)
    expect(c1.codepoint).toBe(105) // 'i'
    const c2 = decodeCell(view, 2 * GhosttyVTCellSize)
    expect(c2.codepoint).toBe(0) // empty
  })
})
```

- [ ] **Step 2: Run tests — should fail (module not found)**

Run: `cd repos/threads && npx vitest run src/tokenizer/decode.test.ts`
Expected: FAIL — cannot resolve `./decode`.

- [ ] **Step 3: Implement cell decoder**

Create `repos/threads/src/tokenizer/decode.ts`:

```typescript
import { GhosttyVTCellSize } from '@tdsk/domain'
import type { TDecodedCell } from './types'
import type { RGB } from '@TTH/ast'

/**
 * Decode a single 16-byte cell from the WASM viewport buffer.
 * Layout (little-endian):
 *   bytes 0-3:   codepoint (u32)
 *   bytes 4-6:   fg r,g,b (u8 each)
 *   byte  7:     bg r (u8)
 *   bytes 8-9:   bg g,b (u8 each)
 *   byte  10:    flags (u8 bitfield)
 *   byte  11:    width (u8)
 *   bytes 12-13: hyperlink_id (u16 LE)
 *   byte  14:    grapheme_len (u8)
 *   byte  15:    reserved
 */
export function decodeCell(view: DataView, offset: number): TDecodedCell {
  return {
    codepoint:   view.getUint32(offset, true),
    fg:          { r: view.getUint8(offset + 4), g: view.getUint8(offset + 5), b: view.getUint8(offset + 6) },
    bg:          { r: view.getUint8(offset + 7), g: view.getUint8(offset + 8), b: view.getUint8(offset + 9) },
    flags:       view.getUint8(offset + 10),
    width:       view.getUint8(offset + 11),
    hyperlinkId: view.getUint16(offset + 12, true),
    graphemeLen: view.getUint8(offset + 14),
  }
}

/** Resolve the effective fg/bg after applying the INVERSE flag. */
export function resolveColors(cell: TDecodedCell): { fg: RGB; bg: RGB } {
  const inverse = (cell.flags & 0x10) !== 0
  return inverse ? { fg: cell.bg, bg: cell.fg } : { fg: cell.fg, bg: cell.bg }
}

/** Cell offset in the viewport buffer for (row, col). */
export function cellOffset(row: number, col: number, cols: number): number {
  return (row * cols + col) * GhosttyVTCellSize
}

/**
 * Test helper: build a synthetic viewport DataView.
 * Takes an array of {row, col, text, fg?, bg?, flags?} descriptors.
 */
export function buildTestViewport(
  cols: number,
  rows: number,
  fills: Array<{
    row: number; col: number; text: string
    fg?: RGB; bg?: RGB; flags?: number; width?: number; hyperlinkId?: number
  }> = [],
): { view: DataView; cols: number; rows: number } {
  const buf = new ArrayBuffer(cols * rows * GhosttyVTCellSize)
  const view = new DataView(buf)

  for (const fill of fills) {
    for (let i = 0; i < fill.text.length; i++) {
      const off = cellOffset(fill.row, fill.col + i, cols)
      view.setUint32(off, fill.text.codePointAt(i)!, true)
      if (fill.fg) {
        view.setUint8(off + 4, fill.fg.r)
        view.setUint8(off + 5, fill.fg.g)
        view.setUint8(off + 6, fill.fg.b)
      }
      if (fill.bg) {
        view.setUint8(off + 7, fill.bg.r)
        view.setUint8(off + 8, fill.bg.g)
        view.setUint8(off + 9, fill.bg.b)
      }
      if (fill.flags != null) view.setUint8(off + 10, fill.flags)
      view.setUint8(off + 11, fill.width ?? 1)
      if (fill.hyperlinkId != null) view.setUint16(off + 12, fill.hyperlinkId, true)
      view.setUint8(off + 14, 1)
    }
  }

  return { view, cols, rows }
}
```

- [ ] **Step 4: Run decode tests — should pass**

Run: `cd repos/threads && npx vitest run src/tokenizer/decode.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Write palette detection tests**

Create `repos/threads/src/tokenizer/palette.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectPalette } from './palette'
import { buildTestViewport } from './decode'

describe('detectPalette', () => {
  it('returns the most frequent bg/fg as defaults', () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }
    const red = { r: 255, g: 0, b: 0 }

    // 3x2 grid: 5 cells have white-on-black, 1 cell has red-on-black
    const { view, cols, rows } = buildTestViewport(3, 2, [
      { row: 0, col: 0, text: 'AB', fg: white, bg: black },
      { row: 0, col: 2, text: 'C', fg: red, bg: black },
      { row: 1, col: 0, text: 'DE', fg: white, bg: black },
    ])

    const palette = detectPalette(view, cols, rows)
    expect(palette.defaultBg).toEqual(black)
    expect(palette.defaultFg).toEqual(white)
  })

  it('handles INVERSE flag by swapping fg/bg before counting', () => {
    const black = { r: 0, g: 0, b: 0 }
    const white = { r: 255, g: 255, b: 255 }

    // Cell with INVERSE flag: stored fg=black, bg=white, but visual is fg=white, bg=black
    const { view, cols, rows } = buildTestViewport(2, 1, [
      { row: 0, col: 0, text: 'A', fg: white, bg: black },
      { row: 0, col: 1, text: 'B', fg: black, bg: white, flags: 0x10 }, // INVERSE
    ])

    const palette = detectPalette(view, cols, rows)
    // Both cells visually have white fg, black bg
    expect(palette.defaultBg).toEqual(black)
    expect(palette.defaultFg).toEqual(white)
  })
})
```

- [ ] **Step 6: Run palette tests — should fail**

Run: `cd repos/threads && npx vitest run src/tokenizer/palette.test.ts`
Expected: FAIL — cannot resolve `./palette`.

- [ ] **Step 7: Implement palette detection**

Create `repos/threads/src/tokenizer/palette.ts`:

```typescript
import { GhosttyVTCellSize } from '@tdsk/domain'
import type { RGB } from '@TTH/ast'
import type { TPalette } from './types'
import { decodeCell, resolveColors } from './decode'

const rgbKey = (c: RGB): string => `${c.r},${c.g},${c.b}`

const parseKey = (key: string): RGB => {
  const [r, g, b] = key.split(',').map(Number)
  return { r, g, b }
}

export function detectPalette(view: DataView, cols: number, rows: number): TPalette {
  const bgCounts = new Map<string, number>()
  const fgCounts = new Map<string, number>()

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offset = (row * cols + col) * GhosttyVTCellSize
      const cell = decodeCell(view, offset)
      if (cell.codepoint === 0 && cell.fg.r === 0 && cell.fg.g === 0 && cell.fg.b === 0
          && cell.bg.r === 0 && cell.bg.g === 0 && cell.bg.b === 0) {
        continue // skip uninitialized cells
      }

      const { fg, bg } = resolveColors(cell)
      const bgK = rgbKey(bg)
      const fgK = rgbKey(fg)
      bgCounts.set(bgK, (bgCounts.get(bgK) ?? 0) + 1)
      if (cell.codepoint !== 0 && cell.codepoint !== 0x20) {
        fgCounts.set(fgK, (fgCounts.get(fgK) ?? 0) + 1)
      }
    }
  }

  let maxBg = ''
  let maxBgCount = 0
  for (const [key, count] of bgCounts) {
    if (count > maxBgCount) { maxBg = key; maxBgCount = count }
  }

  let maxFg = ''
  let maxFgCount = 0
  for (const [key, count] of fgCounts) {
    if (count > maxFgCount) { maxFg = key; maxFgCount = count }
  }

  return {
    defaultBg: maxBg ? parseKey(maxBg) : { r: 0, g: 0, b: 0 },
    defaultFg: maxFg ? parseKey(maxFg) : { r: 255, g: 255, b: 255 },
  }
}
```

- [ ] **Step 8: Run palette tests — should pass**

Run: `cd repos/threads && npx vitest run src/tokenizer/palette.test.ts`
Expected: All tests PASS.

- [ ] **Step 9: Commit**

```
feat(threads): add cell decoder and palette detection (tokenizer steps 0-1)

Cell decoder unpacks 16-byte WASM cells into structured fields.
Palette detection frequency-counts fg/bg colors to identify the
terminal's default palette, handling the INVERSE flag correctly.
Includes buildTestViewport helper for synthetic test data.
```

---

## Task 4: Cell Classification

**Files:**
- Create: `repos/threads/src/tokenizer/classify.ts`
- Test: `repos/threads/src/tokenizer/classify.test.ts`

Single-pass O(cols x rows) scan. Each cell gets metadata bits for use by subsequent tokenizer steps.

- [ ] **Step 1: Write classification tests**

Create `repos/threads/src/tokenizer/classify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { classifyCells } from './classify'
import { buildTestViewport } from './decode'

describe('classifyCells', () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  const blue = { r: 0, g: 0, b: 255 }

  it('classifies empty cells as isEmpty and isBlank', () => {
    const { view, cols, rows } = buildTestViewport(2, 1, [])
    const palette = { defaultBg: black, defaultFg: white }
    const grid = classifyCells(view, cols, rows, palette)
    expect(grid[0][0].isEmpty).toBe(true)
    expect(grid[0][0].isBlank).toBe(true)
  })

  it('classifies box-drawing characters', () => {
    // U+2500 = '─' (box drawing horizontal)
    const { view, cols, rows } = buildTestViewport(1, 1, [
      { row: 0, col: 0, text: '\u2500', fg: white, bg: black },
    ])
    const palette = { defaultBg: black, defaultFg: white }
    const grid = classifyCells(view, cols, rows, palette)
    expect(grid[0][0].isBoxDraw).toBe(true)
  })

  it('classifies highlighted cells (bg != defaultBg)', () => {
    const { view, cols, rows } = buildTestViewport(1, 1, [
      { row: 0, col: 0, text: 'X', fg: white, bg: blue },
    ])
    const palette = { defaultBg: black, defaultFg: white }
    const grid = classifyCells(view, cols, rows, palette)
    expect(grid[0][0].isHighlighted).toBe(true)
  })

  it('classifies cells with hyperlinks', () => {
    const { view, cols, rows } = buildTestViewport(1, 1, [
      { row: 0, col: 0, text: 'L', fg: white, bg: black, hyperlinkId: 5 },
    ])
    const palette = { defaultBg: black, defaultFg: white }
    const grid = classifyCells(view, cols, rows, palette)
    expect(grid[0][0].hasLink).toBe(true)
  })

  it('marks wide-right cells when previous cell is wide', () => {
    const { view, cols, rows } = buildTestViewport(3, 1, [
      { row: 0, col: 0, text: 'A', fg: white, bg: black, width: 2 },
      // col 1 is the right half of the wide cell (auto-handled)
      { row: 0, col: 2, text: 'B', fg: white, bg: black },
    ])
    const palette = { defaultBg: black, defaultFg: white }
    const grid = classifyCells(view, cols, rows, palette)
    expect(grid[0][0].isWide).toBe(true)
    expect(grid[0][1].isWideRight).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — should fail**

Run: `cd repos/threads && npx vitest run src/tokenizer/classify.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement cell classification**

Create `repos/threads/src/tokenizer/classify.ts`:

```typescript
import { GhosttyVTCellSize } from '@tdsk/domain'
import type { RGB } from '@TTH/ast'
import type { TCellMeta, TPalette } from './types'
import { decodeCell, resolveColors } from './decode'

const rgbEq = (a: RGB, b: RGB): boolean => a.r === b.r && a.g === b.g && a.b === b.b

function isBoxDrawCodepoint(cp: number): boolean {
  return (cp >= 0x2500 && cp <= 0x257f) || (cp >= 0x2580 && cp <= 0x259f)
}

export function classifyCells(
  view: DataView,
  cols: number,
  rows: number,
  palette: TPalette,
): TCellMeta[][] {
  const grid: TCellMeta[][] = []

  for (let row = 0; row < rows; row++) {
    const rowMeta: TCellMeta[] = []
    for (let col = 0; col < cols; col++) {
      const offset = (row * cols + col) * GhosttyVTCellSize
      const cell = decodeCell(view, offset)
      const { fg, bg } = resolveColors(cell)

      const isEmpty = cell.codepoint === 0 || cell.codepoint === 0x20
      const isHighlighted = !rgbEq(bg, palette.defaultBg)
      const prevIsWide = col > 0 && rowMeta[col - 1]?.isWide

      rowMeta.push({
        isBoxDraw: isBoxDrawCodepoint(cell.codepoint),
        isHighlighted,
        isFgStyled: !rgbEq(fg, palette.defaultFg),
        isEmpty,
        isBlank: isEmpty && !isHighlighted,
        isWide: cell.width === 2,
        isWideRight: prevIsWide,
        hasLink: cell.hyperlinkId > 0,
      })
    }
    grid.push(rowMeta)
  }

  return grid
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd repos/threads && npx vitest run src/tokenizer/classify.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```
feat(threads): add cell classification (tokenizer step 2)

Single-pass O(cols*rows) scan classifies each cell with metadata
bits: isBoxDraw, isHighlighted, isFgStyled, isEmpty, isBlank,
isWide, isWideRight, hasLink. Used by border tracing, block
segmentation, and run extraction steps.
```

---

## Task 5: Border Tracing

**Files:**
- Create: `repos/threads/src/tokenizer/borders.ts`
- Test: `repos/threads/src/tokenizer/borders.test.ts`

Finds closed rectangles of box-drawing characters using corner tracing. Supports single, double, heavy, and rounded border styles. Handles nested frames recursively.

- [ ] **Step 1: Write border tracing tests**

Create `repos/threads/src/tokenizer/borders.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { traceBorders } from './borders'
import { classifyCells } from './classify'
import { buildTestViewport } from './decode'

describe('traceBorders', () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  const palette = { defaultBg: black, defaultFg: white }

  it('detects a single-border rectangle', () => {
    // ┌──┐
    // │  │
    // └──┘
    const { view, cols, rows } = buildTestViewport(4, 3, [
      { row: 0, col: 0, text: '\u250c\u2500\u2500\u2510', fg: white, bg: black },
      { row: 1, col: 0, text: '\u2502', fg: white, bg: black },
      { row: 1, col: 3, text: '\u2502', fg: white, bg: black },
      { row: 2, col: 0, text: '\u2514\u2500\u2500\u2518', fg: white, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const frames = traceBorders(view, cols, rows, meta)
    expect(frames).toHaveLength(1)
    expect(frames[0].style).toBe('single')
    expect(frames[0].bounds).toEqual({ top: 0, left: 0, bottom: 2, right: 3 })
    expect(frames[0].interior).toEqual({ top: 1, left: 1, bottom: 1, right: 2 })
  })

  it('detects a rounded-border rectangle', () => {
    // ╭──╮
    // │  │
    // ╰──╯
    const { view, cols, rows } = buildTestViewport(4, 3, [
      { row: 0, col: 0, text: '\u256d\u2500\u2500\u256e', fg: white, bg: black },
      { row: 1, col: 0, text: '\u2502', fg: white, bg: black },
      { row: 1, col: 3, text: '\u2502', fg: white, bg: black },
      { row: 2, col: 0, text: '\u2570\u2500\u2500\u256f', fg: white, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const frames = traceBorders(view, cols, rows, meta)
    expect(frames).toHaveLength(1)
    expect(frames[0].style).toBe('rounded')
  })

  it('extracts title from top border row', () => {
    // ┌─Title─┐
    // │       │
    // └───────┘
    const { view, cols, rows } = buildTestViewport(9, 3, [
      { row: 0, col: 0, text: '\u250c', fg: white, bg: black },
      { row: 0, col: 1, text: '\u2500', fg: white, bg: black },
      { row: 0, col: 2, text: 'Title', fg: white, bg: black },
      { row: 0, col: 7, text: '\u2500', fg: white, bg: black },
      { row: 0, col: 8, text: '\u2510', fg: white, bg: black },
      { row: 1, col: 0, text: '\u2502', fg: white, bg: black },
      { row: 1, col: 8, text: '\u2502', fg: white, bg: black },
      { row: 2, col: 0, text: '\u2514', fg: white, bg: black },
      { row: 2, col: 1, text: '\u2500\u2500\u2500\u2500\u2500\u2500\u2500', fg: white, bg: black },
      { row: 2, col: 8, text: '\u2518', fg: white, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const frames = traceBorders(view, cols, rows, meta)
    expect(frames).toHaveLength(1)
    expect(frames[0].title).toBe('Title')
  })

  it('returns empty array when no borders exist', () => {
    const { view, cols, rows } = buildTestViewport(4, 2, [
      { row: 0, col: 0, text: 'text', fg: white, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const frames = traceBorders(view, cols, rows, meta)
    expect(frames).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests — should fail**

Run: `cd repos/threads && npx vitest run src/tokenizer/borders.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement border tracing**

Create `repos/threads/src/tokenizer/borders.ts`:

```typescript
import { GhosttyVTCellSize } from '@tdsk/domain'
import type { TRect } from '@TTH/ast'
import type { TBorderFrame, TCellMeta } from './types'
import { decodeCell } from './decode'

// Corner character sets
const TOP_LEFT     = new Set([0x250c, 0x2554, 0x250f, 0x256d]) // ┌ ╔ ┏ ╭
const TOP_RIGHT    = new Set([0x2510, 0x2557, 0x2513, 0x256e]) // ┐ ╗ ┓ ╮
const BOTTOM_LEFT  = new Set([0x2514, 0x255a, 0x2517, 0x2570]) // └ ╚ ┗ ╰
const BOTTOM_RIGHT = new Set([0x2518, 0x255d, 0x251b, 0x256f]) // ┘ ╝ ┛ ╯

// Connector character sets (includes corners that connect in the right direction)
const H_CONNECTORS = new Set([
  0x2500, 0x2550, 0x2501, // ─ ═ ━
  0x252c, 0x2534, 0x2564, 0x2567, 0x2533, 0x253b, // ┬ ┴ ╤ ╧ ┳ ┻
])
const V_CONNECTORS = new Set([
  0x2502, 0x2551, 0x2503, // │ ║ ┃
  0x251c, 0x2524, 0x2560, 0x2563, 0x2523, 0x252b, // ├ ┤ ╠ ╣ ┣ ┫
])

// Style detection from top-left corner
const STYLE_MAP: Record<number, TBorderFrame['style']> = {
  0x250c: 'single', 0x2554: 'double', 0x250f: 'heavy', 0x256d: 'rounded',
}

function getCp(view: DataView, row: number, col: number, cols: number): number {
  return view.getUint32((row * cols + col) * GhosttyVTCellSize, true)
}

function canConnectH(cp: number): boolean {
  return H_CONNECTORS.has(cp) || TOP_LEFT.has(cp) || TOP_RIGHT.has(cp)
    || BOTTOM_LEFT.has(cp) || BOTTOM_RIGHT.has(cp)
}

function canConnectV(cp: number): boolean {
  return V_CONNECTORS.has(cp) || TOP_LEFT.has(cp) || TOP_RIGHT.has(cp)
    || BOTTOM_LEFT.has(cp) || BOTTOM_RIGHT.has(cp)
}

function extractTitle(view: DataView, row: number, leftCol: number, rightCol: number, cols: number): string | undefined {
  let title = ''
  for (let col = leftCol + 1; col < rightCol; col++) {
    const cp = getCp(view, row, col, cols)
    if (cp !== 0 && !H_CONNECTORS.has(cp)) {
      title += String.fromCodePoint(cp)
    }
  }
  const trimmed = title.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function traceBorders(
  view: DataView,
  cols: number,
  rows: number,
  meta: TCellMeta[][],
  scopeBounds?: TRect,
): TBorderFrame[] {
  const frames: TBorderFrame[] = []
  const top = scopeBounds?.top ?? 0
  const left = scopeBounds?.left ?? 0
  const bottom = scopeBounds?.bottom ?? rows - 1
  const right = scopeBounds?.right ?? cols - 1

  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      if (!meta[row]?.[col]?.isBoxDraw) continue
      const tlCp = getCp(view, row, col, cols)
      if (!TOP_LEFT.has(tlCp)) continue

      // Trace right to find top-right corner
      let trCol = -1
      for (let c = col + 1; c <= right; c++) {
        const cp = getCp(view, row, c, cols)
        if (TOP_RIGHT.has(cp)) { trCol = c; break }
        if (!canConnectH(cp) && !H_CONNECTORS.has(cp)) break
      }
      if (trCol < 0) continue

      // Trace down from top-right to find bottom-right corner
      let brRow = -1
      for (let r = row + 1; r <= bottom; r++) {
        const cp = getCp(view, r, trCol, cols)
        if (BOTTOM_RIGHT.has(cp)) { brRow = r; break }
        if (!canConnectV(cp) && !V_CONNECTORS.has(cp)) break
      }
      if (brRow < 0) continue

      // Verify bottom-left corner
      const blCp = getCp(view, brRow, col, cols)
      if (!BOTTOM_LEFT.has(blCp)) continue

      // Verify left border
      let leftOk = true
      for (let r = row + 1; r < brRow; r++) {
        const cp = getCp(view, r, col, cols)
        if (!canConnectV(cp)) { leftOk = false; break }
      }
      if (!leftOk) continue

      // Verify bottom border
      let bottomOk = true
      for (let c = col + 1; c < trCol; c++) {
        const cp = getCp(view, brRow, c, cols)
        if (!canConnectH(cp) && !H_CONNECTORS.has(cp)) { bottomOk = false; break }
      }
      if (!bottomOk) continue

      const style = STYLE_MAP[tlCp] ?? 'single'
      const title = extractTitle(view, row, col, trCol, cols)
      const bounds: TRect = { top: row, left: col, bottom: brRow, right: trCol }
      const interior: TRect = { top: row + 1, left: col + 1, bottom: brRow - 1, right: trCol - 1 }

      frames.push({ type: 'BorderFrame', bounds, interior, style, ...(title != null ? { title } : {}) })

      // Recursively scan interior for nested frames
      if (interior.bottom >= interior.top && interior.right >= interior.left) {
        const nested = traceBorders(view, cols, rows, meta, interior)
        frames.push(...nested)
      }
    }
  }

  return frames
}
```

- [ ] **Step 4: Run tests — should pass**

Run: `cd repos/threads && npx vitest run src/tokenizer/borders.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```
feat(threads): add border tracing (tokenizer step 3)

Corner-based algorithm finds closed rectangles of box-drawing
characters. Supports single/double/heavy/rounded styles, extracts
titles from top border, and recursively scans interiors for
nested frames.
```

---

## Task 6: Block Segmentation and Run Extraction

**Files:**
- Create: `repos/threads/src/tokenizer/blocks.ts`
- Create: `repos/threads/src/tokenizer/runs.ts`
- Test: `repos/threads/src/tokenizer/blocks.test.ts`
- Test: `repos/threads/src/tokenizer/runs.test.ts`

Block segmentation uses connected-component flood fill on highlighted cells. Run extraction produces styled text spans from contiguous non-empty cells.

- [ ] **Step 1: Write block segmentation tests**

Create `repos/threads/src/tokenizer/blocks.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { segmentBlocks } from './blocks'
import { classifyCells } from './classify'
import { buildTestViewport } from './decode'

describe('segmentBlocks', () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  const blue = { r: 0, g: 0, b: 255 }
  const palette = { defaultBg: black, defaultFg: white }

  it('finds a full-width highlighted block', () => {
    const { view, cols, rows } = buildTestViewport(5, 1, [
      { row: 0, col: 0, text: 'ABCDE', fg: white, bg: blue },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const scope = { top: 0, left: 0, bottom: 0, right: 4 }
    const blocks = segmentBlocks(meta, scope, cols)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].shape).toBe('full-width')
    expect(blocks[0].color).toEqual(blue)
  })

  it('finds a small highlighted block', () => {
    const { view, cols, rows } = buildTestViewport(10, 1, [
      { row: 0, col: 3, text: 'OK', fg: white, bg: blue },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const scope = { top: 0, left: 0, bottom: 0, right: 9 }
    const blocks = segmentBlocks(meta, scope, cols)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].shape).toBe('small')
  })

  it('returns empty when no highlighted cells', () => {
    const { view, cols, rows } = buildTestViewport(5, 1, [
      { row: 0, col: 0, text: 'hello', fg: white, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const scope = { top: 0, left: 0, bottom: 0, right: 4 }
    const blocks = segmentBlocks(meta, scope, cols)
    expect(blocks).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Implement block segmentation**

Create `repos/threads/src/tokenizer/blocks.ts`:

```typescript
import type { TRect, RGB } from '@TTH/ast'
import type { THighlightedBlock, TCellMeta } from './types'

export function segmentBlocks(
  meta: TCellMeta[][],
  scope: TRect,
  scopeWidth: number,
): THighlightedBlock[] {
  const visited = new Set<string>()
  const blocks: THighlightedBlock[] = []

  for (let row = scope.top; row <= scope.bottom; row++) {
    for (let col = scope.left; col <= scope.right; col++) {
      const key = `${row},${col}`
      if (visited.has(key)) continue
      if (!meta[row]?.[col]?.isHighlighted) continue

      // Flood fill (4-connected)
      const component: Array<{ row: number; col: number }> = []
      const stack = [{ row, col }]
      while (stack.length > 0) {
        const cell = stack.pop()!
        const ck = `${cell.row},${cell.col}`
        if (visited.has(ck)) continue
        if (cell.row < scope.top || cell.row > scope.bottom) continue
        if (cell.col < scope.left || cell.col > scope.right) continue
        if (!meta[cell.row]?.[cell.col]?.isHighlighted) continue
        visited.add(ck)
        component.push(cell)
        stack.push(
          { row: cell.row - 1, col: cell.col },
          { row: cell.row + 1, col: cell.col },
          { row: cell.row, col: cell.col - 1 },
          { row: cell.row, col: cell.col + 1 },
        )
      }

      if (component.length === 0) continue

      let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity
      for (const c of component) {
        if (c.row < minR) minR = c.row
        if (c.row > maxR) maxR = c.row
        if (c.col < minC) minC = c.col
        if (c.col > maxC) maxC = c.col
      }

      const bounds: TRect = { top: minR, left: minC, bottom: maxR, right: maxC }
      const width = maxC - minC + 1
      const height = maxR - minR + 1
      const fWidth = scope.right - scope.left + 1

      let shape: THighlightedBlock['shape']
      if (height > 1) shape = 'multi-row'
      else if (width >= fWidth) shape = 'full-width'
      else shape = 'small'

      // Use the first cell's highlight color (they're all highlighted in the same component)
      // We need the actual RGB — but TCellMeta doesn't store it.
      // The color must be passed from the decode layer. For now, use a placeholder
      // that the tokenizer orchestrator fills in by reading the viewport.
      blocks.push({
        type: 'HighlightedBlock',
        bounds,
        color: { r: 0, g: 0, b: 0 }, // filled by orchestrator from viewport data
        shape,
      })
    }
  }

  return blocks
}
```

Note: The `color` field is populated by the tokenizer orchestrator in Task 7, which has access to the viewport DataView.

- [ ] **Step 3: Run block tests — should pass**

Run: `cd repos/threads && npx vitest run src/tokenizer/blocks.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 4: Write run extraction tests**

Create `repos/threads/src/tokenizer/runs.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { extractRuns } from './runs'
import { classifyCells } from './classify'
import { buildTestViewport } from './decode'

describe('extractRuns', () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  const red = { r: 255, g: 0, b: 0 }
  const palette = { defaultBg: black, defaultFg: white }

  it('extracts a single text run', () => {
    const { view, cols, rows } = buildTestViewport(5, 1, [
      { row: 0, col: 0, text: 'Hello', fg: white, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const scope = { top: 0, left: 0, bottom: 0, right: 4 }
    const result = extractRuns(view, cols, meta, scope, [])
    expect(result.textRuns).toHaveLength(1)
    expect(result.textRuns[0].spans[0].text).toBe('Hello')
  })

  it('splits runs at style boundaries', () => {
    const { view, cols, rows } = buildTestViewport(6, 1, [
      { row: 0, col: 0, text: 'Hel', fg: white, bg: black },
      { row: 0, col: 3, text: 'lo!', fg: red, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const scope = { top: 0, left: 0, bottom: 0, right: 5 }
    const result = extractRuns(view, cols, meta, scope, [])
    expect(result.textRuns).toHaveLength(1)
    expect(result.textRuns[0].spans).toHaveLength(2)
    expect(result.textRuns[0].spans[0].text).toBe('Hel')
    expect(result.textRuns[0].spans[1].text).toBe('lo!')
    expect(result.textRuns[0].spans[1].fg).toEqual(red)
  })

  it('detects whitespace gaps between rows', () => {
    const { view, cols, rows } = buildTestViewport(5, 3, [
      { row: 0, col: 0, text: 'Line1', fg: white, bg: black },
      // row 1 is blank
      { row: 2, col: 0, text: 'Line2', fg: white, bg: black },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const scope = { top: 0, left: 0, bottom: 2, right: 4 }
    const result = extractRuns(view, cols, meta, scope, [])
    expect(result.textRuns).toHaveLength(2)
    expect(result.gaps).toHaveLength(1)
    expect(result.gaps[0].bounds.top).toBe(1)
  })

  it('extracts link spans', () => {
    const { view, cols, rows } = buildTestViewport(4, 1, [
      { row: 0, col: 0, text: 'Link', fg: white, bg: black, hyperlinkId: 7 },
    ])
    const meta = classifyCells(view, cols, rows, palette)
    const scope = { top: 0, left: 0, bottom: 0, right: 3 }
    const result = extractRuns(view, cols, meta, scope, [])
    expect(result.links).toHaveLength(1)
    expect(result.links[0].hyperlinkId).toBe(7)
    expect(result.links[0].text).toBe('Link')
  })
})
```

- [ ] **Step 5: Implement run extraction**

Create `repos/threads/src/tokenizer/runs.ts`:

```typescript
import { GhosttyVTCellSize } from '@tdsk/domain'
import type { TRect, RGB } from '@TTH/ast'
import type { TTextRun, TWhitespaceGap, TLinkSpan, TCellMeta, TRawSpan, TBorderFrame } from './types'
import { decodeCell, resolveColors } from './decode'

type TRunResult = {
  textRuns: TTextRun[]
  gaps: TWhitespaceGap[]
  links: TLinkSpan[]
}

const rgbEq = (a: RGB, b: RGB): boolean => a.r === b.r && a.g === b.g && a.b === b.b

function isInFrame(row: number, col: number, frames: TBorderFrame[]): boolean {
  for (const f of frames) {
    if (row >= f.bounds.top && row <= f.bounds.bottom && col >= f.bounds.left && col <= f.bounds.right)
      return true
  }
  return false
}

export function extractRuns(
  view: DataView,
  cols: number,
  meta: TCellMeta[][],
  scope: TRect,
  childFrames: TBorderFrame[],
): TRunResult {
  const textRuns: TTextRun[] = []
  const gaps: TWhitespaceGap[] = []
  const links: TLinkSpan[] = []
  let gapStart = -1

  for (let row = scope.top; row <= scope.bottom; row++) {
    // Check if entire row is blank (within scope)
    let rowBlank = true
    for (let col = scope.left; col <= scope.right; col++) {
      if (!isInFrame(row, col, childFrames) && !meta[row]?.[col]?.isBlank) {
        rowBlank = false
        break
      }
    }

    if (rowBlank) {
      if (gapStart < 0) gapStart = row
      continue
    }

    // Emit gap if we had blank rows
    if (gapStart >= 0) {
      gaps.push({
        type: 'WhitespaceGap',
        bounds: { top: gapStart, left: scope.left, bottom: row - 1, right: scope.right },
        height: row - gapStart,
      })
      gapStart = -1
    }

    // Extract text runs and link spans for this row
    const spans: TRawSpan[] = []
    let linkText = ''
    let linkId = 0
    let linkStart = -1
    let runStart = -1

    for (let col = scope.left; col <= scope.right; col++) {
      if (isInFrame(row, col, childFrames)) continue

      const cellMeta = meta[row]?.[col]
      if (!cellMeta || cellMeta.isBlank || cellMeta.isWideRight) continue

      const offset = (row * cols + col) * GhosttyVTCellSize
      const cell = decodeCell(view, offset)
      const { fg, bg } = resolveColors(cell)
      const ch = cell.codepoint === 0 ? ' ' : String.fromCodePoint(cell.codepoint)

      // Handle hyperlinks
      if (cellMeta.hasLink) {
        if (linkId !== cell.hyperlinkId) {
          if (linkId > 0 && linkText.length > 0) {
            links.push({ type: 'LinkSpan', bounds: { top: row, left: linkStart, bottom: row, right: col - 1 }, hyperlinkId: linkId, text: linkText })
          }
          linkId = cell.hyperlinkId
          linkStart = col
          linkText = ch
        } else {
          linkText += ch
        }
        continue
      } else if (linkId > 0) {
        links.push({ type: 'LinkSpan', bounds: { top: row, left: linkStart, bottom: row, right: col - 1 }, hyperlinkId: linkId, text: linkText })
        linkId = 0
        linkText = ''
      }

      // Accumulate text spans — new span on style change
      const lastSpan = spans.length > 0 ? spans[spans.length - 1] : null
      if (lastSpan && rgbEq(lastSpan.fg, fg) && rgbEq(lastSpan.bg, bg) && lastSpan.flags === cell.flags) {
        lastSpan.text += ch
      } else {
        if (runStart < 0) runStart = col
        spans.push({ text: ch, fg, bg, flags: cell.flags })
      }
    }

    // Flush trailing link
    if (linkId > 0 && linkText.length > 0) {
      links.push({ type: 'LinkSpan', bounds: { top: row, left: linkStart, bottom: row, right: scope.right }, hyperlinkId: linkId, text: linkText })
    }

    // Emit text run for this row if we have spans
    if (spans.length > 0) {
      textRuns.push({
        type: 'TextRun',
        bounds: { top: row, left: runStart >= 0 ? runStart : scope.left, bottom: row, right: scope.right },
        spans,
      })
    }
  }

  // Trailing gap
  if (gapStart >= 0) {
    gaps.push({
      type: 'WhitespaceGap',
      bounds: { top: gapStart, left: scope.left, bottom: scope.bottom, right: scope.right },
      height: scope.bottom - gapStart + 1,
    })
  }

  return { textRuns, gaps, links }
}
```

- [ ] **Step 6: Run all tokenizer tests**

Run: `cd repos/threads && npx vitest run src/tokenizer/`
Expected: All tests PASS.

- [ ] **Step 7: Commit**

```
feat(threads): add block segmentation and run extraction (tokenizer steps 4-5)

Block segmentation uses flood fill on highlighted cells to find
HighlightedBlock tokens (full-width, small, multi-row). Run
extraction scans non-empty cells into styled TextRun spans, detects
WhitespaceGap separators, and extracts LinkSpan tokens for
hyperlinked regions.
```

---

## Task 7: Tokenizer Orchestrator

**Files:**
- Create: `repos/threads/src/tokenizer/tokenizer.ts`
- Create: `repos/threads/src/tokenizer/index.ts`
- Test: `repos/threads/src/tokenizer/tokenizer.test.ts`

Runs all 5 steps in sequence, returns the full token array.

- [ ] **Step 1: Write orchestrator test**

Create `repos/threads/src/tokenizer/tokenizer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { tokenize } from './tokenizer'
import { buildTestViewport } from './decode'

describe('tokenize', () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }
  const blue = { r: 0, g: 0, b: 255 }

  it('produces tokens from a simple viewport with text', () => {
    const { view, cols, rows } = buildTestViewport(10, 2, [
      { row: 0, col: 0, text: 'Hello', fg: white, bg: black },
      { row: 1, col: 0, text: 'World', fg: white, bg: black },
    ])
    const cursor = { x: 5, y: 1, visible: true }
    const result = tokenize(view, cols, rows, cursor)
    expect(result.tokens.length).toBeGreaterThan(0)
    expect(result.palette.defaultBg).toEqual(black)
    expect(result.cursor).toEqual({ type: 'CursorToken', position: { x: 5, y: 1 }, visible: true })
    const textRuns = result.tokens.filter(t => t.type === 'TextRun')
    expect(textRuns.length).toBeGreaterThanOrEqual(2)
  })

  it('detects border frames in the token stream', () => {
    const { view, cols, rows } = buildTestViewport(6, 3, [
      { row: 0, col: 0, text: '\u250c\u2500\u2500\u2500\u2500\u2510', fg: white, bg: black },
      { row: 1, col: 0, text: '\u2502', fg: white, bg: black },
      { row: 1, col: 1, text: 'Hi  ', fg: white, bg: black },
      { row: 1, col: 5, text: '\u2502', fg: white, bg: black },
      { row: 2, col: 0, text: '\u2514\u2500\u2500\u2500\u2500\u2518', fg: white, bg: black },
    ])
    const cursor = { x: 0, y: 0, visible: false }
    const result = tokenize(view, cols, rows, cursor)
    const frames = result.tokens.filter(t => t.type === 'BorderFrame')
    expect(frames.length).toBe(1)
  })
})
```

- [ ] **Step 2: Run test — should fail**

Run: `cd repos/threads && npx vitest run src/tokenizer/tokenizer.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement tokenizer orchestrator**

Create `repos/threads/src/tokenizer/tokenizer.ts`:

```typescript
import { GhosttyVTCellSize } from '@tdsk/domain'
import type { TToken, TCursorToken, TPalette, TCellMeta } from './types'
import { detectPalette } from './palette'
import { classifyCells } from './classify'
import { traceBorders } from './borders'
import { segmentBlocks } from './blocks'
import { extractRuns } from './runs'
import { decodeCell, resolveColors } from './decode'

export type TTokenizeResult = {
  tokens: TToken[]
  cursor: TCursorToken
  palette: TPalette
  meta: TCellMeta[][]
}

export function tokenize(
  view: DataView,
  cols: number,
  rows: number,
  cursor: { x: number; y: number; visible: boolean },
  prevPalette?: TPalette,
  dirtyRows?: number[],
): TTokenizeResult {
  // Step 1: Palette detection
  // Re-run only if no previous palette or >50% rows dirty
  const shouldRedetect = !prevPalette || !dirtyRows || dirtyRows.length > rows * 0.5
  const palette = shouldRedetect ? detectPalette(view, cols, rows) : prevPalette

  // Step 2: Cell classification
  const meta = classifyCells(view, cols, rows, palette)

  // Step 3: Border tracing
  const frames = traceBorders(view, cols, rows, meta)

  // Build set of cells covered by frames (for scope exclusion)
  const frameBoundsSet = new Set<string>()
  for (const f of frames) {
    for (let r = f.bounds.top; r <= f.bounds.bottom; r++) {
      for (let c = f.bounds.left; c <= f.bounds.right; c++) {
        frameBoundsSet.add(`${r},${c}`)
      }
    }
  }

  // Root scope = full viewport
  const rootScope = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

  // Step 4: Block segmentation (on root scope, excluding frame interiors)
  const blocks = segmentBlocks(meta, rootScope, cols)

  // Fill block colors from viewport data
  for (const block of blocks) {
    const offset = (block.bounds.top * cols + block.bounds.left) * GhosttyVTCellSize
    const cell = decodeCell(view, offset)
    const { bg } = resolveColors(cell)
    block.color = bg
  }

  // Step 5: Run extraction (root scope, excluding frame bounds)
  const { textRuns, gaps, links } = extractRuns(view, cols, meta, rootScope, frames)

  // Also extract runs inside each frame interior
  const frameTokens: TToken[] = []
  for (const frame of frames) {
    const nestedFrames = frames.filter(f =>
      f !== frame
      && f.bounds.top >= frame.interior.top && f.bounds.bottom <= frame.interior.bottom
      && f.bounds.left >= frame.interior.left && f.bounds.right <= frame.interior.right
    )
    const innerBlocks = segmentBlocks(meta, frame.interior, cols)
    for (const b of innerBlocks) {
      const off = (b.bounds.top * cols + b.bounds.left) * GhosttyVTCellSize
      const c = decodeCell(view, off)
      b.color = resolveColors(c).bg
    }
    const innerRuns = extractRuns(view, cols, meta, frame.interior, nestedFrames)
    frameTokens.push(...innerBlocks, ...innerRuns.textRuns, ...innerRuns.gaps, ...innerRuns.links)
  }

  // Cursor token
  const cursorToken: TCursorToken = {
    type: 'CursorToken',
    position: { x: cursor.x, y: cursor.y },
    visible: cursor.visible,
  }

  const tokens: TToken[] = [
    ...frames,
    ...blocks,
    ...textRuns,
    ...gaps,
    ...links,
    ...frameTokens,
    cursorToken,
  ]

  return { tokens, cursor: cursorToken, palette, meta }
}
```

- [ ] **Step 4: Create barrel export**

Create `repos/threads/src/tokenizer/index.ts`:

```typescript
export { tokenize } from './tokenizer'
export type { TTokenizeResult } from './tokenizer'
export { decodeCell, buildTestViewport, cellOffset, resolveColors } from './decode'
export { detectPalette } from './palette'
export { classifyCells } from './classify'
export { traceBorders } from './borders'
export { segmentBlocks } from './blocks'
export { extractRuns } from './runs'
export * from './types'
```

- [ ] **Step 5: Run all tokenizer tests**

Run: `cd repos/threads && npx vitest run src/tokenizer/`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```
feat(threads): add tokenizer orchestrator (5-step pipeline)

Orchestrates palette detection → cell classification → border
tracing → block segmentation → run extraction. Produces typed
token array with cursor position for parser consumption.
```

---

## Task 8: Mode Detection

**Files:**
- Create: `repos/threads/src/parser/modeDetector.ts`
- Test: `repos/threads/src/parser/modeDetector.test.ts`

Classifies the current viewport state into one of 4 modes: interactive, tui, streaming, idle.

- [ ] **Step 1: Write mode detection tests**

Create `repos/threads/src/parser/modeDetector.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { detectMode, type TModeContext } from './modeDetector'

describe('detectMode', () => {
  it('returns tui when alternate screen is active', () => {
    const ctx: TModeContext = {
      isAlternateScreen: true,
      cursor: { x: 0, y: 0, visible: true },
      dirtyRowCount: 0,
      consecutiveDirtyCycles: 0,
      idleDurationMs: 0,
      hasInteractiveRegion: false,
    }
    expect(detectMode(ctx)).toBe('tui')
  })

  it('returns streaming when many dirty rows for several cycles', () => {
    const ctx: TModeContext = {
      isAlternateScreen: false,
      cursor: { x: 0, y: 10, visible: true },
      dirtyRowCount: 5,
      consecutiveDirtyCycles: 4,
      idleDurationMs: 0,
      hasInteractiveRegion: false,
    }
    expect(detectMode(ctx)).toBe('streaming')
  })

  it('returns idle when cursor visible with no dirty rows for >2s', () => {
    const ctx: TModeContext = {
      isAlternateScreen: false,
      cursor: { x: 2, y: 5, visible: true },
      dirtyRowCount: 0,
      consecutiveDirtyCycles: 0,
      idleDurationMs: 2500,
      hasInteractiveRegion: false,
    }
    expect(detectMode(ctx)).toBe('idle')
  })

  it('returns interactive as default', () => {
    const ctx: TModeContext = {
      isAlternateScreen: false,
      cursor: { x: 0, y: 0, visible: true },
      dirtyRowCount: 1,
      consecutiveDirtyCycles: 0,
      idleDurationMs: 0,
      hasInteractiveRegion: true,
    }
    expect(detectMode(ctx)).toBe('interactive')
  })
})
```

- [ ] **Step 2: Implement mode detection**

Create `repos/threads/src/parser/modeDetector.ts`:

```typescript
import type { TViewportMode } from '@TTH/ast'

export type TModeContext = {
  isAlternateScreen: boolean
  cursor: { x: number; y: number; visible: boolean }
  dirtyRowCount: number
  consecutiveDirtyCycles: number
  idleDurationMs: number
  hasInteractiveRegion: boolean
}

export function detectMode(ctx: TModeContext): TViewportMode {
  if (ctx.isAlternateScreen) return 'tui'

  if (ctx.dirtyRowCount > 3 && ctx.consecutiveDirtyCycles > 3 && !ctx.hasInteractiveRegion) {
    return 'streaming'
  }

  if (ctx.cursor.visible && ctx.dirtyRowCount === 0 && ctx.idleDurationMs > 2000) {
    return 'idle'
  }

  return 'interactive'
}
```

- [ ] **Step 3: Run tests — should pass**

Run: `cd repos/threads && npx vitest run src/parser/modeDetector.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 4: Commit**

```
feat(threads): add viewport mode detection (parser)

Classifies viewport state into interactive/tui/streaming/idle based
on alternate screen, dirty row frequency, idle duration, and
interactive region presence.
```

---

## Task 9: Scope Parser

**Files:**
- Create: `repos/threads/src/parser/scopeParser.ts`
- Test: `repos/threads/src/parser/scopeParser.test.ts`

Recursive descent parser that converts BorderFrame tokens into Panel nodes, recursively parsing frame interiors.

- [ ] **Step 1: Write scope parser tests**

Create `repos/threads/src/parser/scopeParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseScopes } from './scopeParser'
import type { TToken, TBorderFrame, TTextRun } from '@TTH/tokenizer'

describe('parseScopes', () => {
  it('converts a BorderFrame into a Panel with text children', () => {
    const frame: TBorderFrame = {
      type: 'BorderFrame',
      bounds: { top: 0, left: 0, bottom: 4, right: 20 },
      interior: { top: 1, left: 1, bottom: 3, right: 19 },
      style: 'single',
      title: 'Info',
    }
    const textRun: TTextRun = {
      type: 'TextRun',
      bounds: { top: 2, left: 2, bottom: 2, right: 10 },
      spans: [{ text: 'Hello', fg: { r: 255, g: 255, b: 255 }, bg: { r: 0, g: 0, b: 0 }, flags: 0 }],
    }
    const tokens: TToken[] = [frame, textRun]
    const cursor = { x: 0, y: 0, visible: false }
    const rootBounds = { top: 0, left: 0, bottom: 4, right: 20 }
    const { panels, remaining } = parseScopes(tokens, rootBounds, cursor)

    expect(panels).toHaveLength(1)
    expect(panels[0].type).toBe('Panel')
    expect(panels[0].border).toBe('single')
    expect(panels[0].title).toBe('Info')
    expect(remaining).toHaveLength(0) // textRun consumed by panel
  })

  it('returns tokens outside frames as remaining', () => {
    const textRun: TTextRun = {
      type: 'TextRun',
      bounds: { top: 5, left: 0, bottom: 5, right: 10 },
      spans: [{ text: 'Outside', fg: { r: 255, g: 255, b: 255 }, bg: { r: 0, g: 0, b: 0 }, flags: 0 }],
    }
    const tokens: TToken[] = [textRun]
    const cursor = { x: 0, y: 5, visible: true }
    const rootBounds = { top: 0, left: 0, bottom: 10, right: 20 }
    const { panels, remaining } = parseScopes(tokens, rootBounds, cursor)
    expect(panels).toHaveLength(0)
    expect(remaining).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Implement scope parser**

Create `repos/threads/src/parser/scopeParser.ts`:

```typescript
import type { TRect, TPanel, TContentNode } from '@TTH/ast'
import type { TToken, TBorderFrame } from '@TTH/tokenizer'
import { parseFlatContent } from './flatParser'

function isInBounds(token: TToken, bounds: TRect): boolean {
  if (!('bounds' in token)) return false
  const tb = token.bounds
  return tb.top >= bounds.top && tb.bottom <= bounds.bottom
    && tb.left >= bounds.left && tb.right <= bounds.right
}

export function parseScopes(
  tokens: TToken[],
  rootBounds: TRect,
  cursor: { x: number; y: number; visible: boolean },
): { panels: TPanel[]; remaining: TToken[] } {
  const frames = tokens.filter((t): t is TBorderFrame => t.type === 'BorderFrame')
  const consumed = new Set<TToken>()
  const panels: TPanel[] = []

  // Sort frames by area (largest first) to handle nesting correctly
  const sortedFrames = [...frames].sort((a, b) => {
    const areaA = (a.bounds.bottom - a.bounds.top) * (a.bounds.right - a.bounds.left)
    const areaB = (b.bounds.bottom - b.bounds.top) * (b.bounds.right - b.bounds.left)
    return areaB - areaA
  })

  // Track which frames are nested inside other frames
  const nestedInFrame = new Set<TBorderFrame>()
  for (const frame of sortedFrames) {
    for (const inner of sortedFrames) {
      if (inner === frame) continue
      if (isInBounds(inner, frame.interior)) {
        nestedInFrame.add(inner)
      }
    }
  }

  // Only process top-level frames (not nested ones — they'll be recursed into)
  const topFrames = sortedFrames.filter(f => !nestedInFrame.has(f))

  for (const frame of topFrames) {
    consumed.add(frame)

    // Collect tokens inside this frame's interior
    const innerTokens = tokens.filter(t => t !== frame && !consumed.has(t) && isInBounds(t, frame.interior))
    for (const t of innerTokens) consumed.add(t)

    // Recurse: parse inner scopes
    const { panels: innerPanels, remaining: innerRemaining } = parseScopes(innerTokens, frame.interior, cursor)

    // Parse flat content from remaining inner tokens
    const flatNodes = parseFlatContent(innerRemaining, frame.interior, cursor)

    const children: TContentNode[] = [...innerPanels, ...flatNodes]

    panels.push({
      type: 'Panel',
      bounds: frame.bounds,
      border: frame.style,
      children,
      ...(frame.title != null ? { title: frame.title } : {}),
    })
  }

  // Also consume nested frames that were processed via recursion
  for (const f of frames) consumed.add(f)

  const remaining = tokens.filter(t => !consumed.has(t))
  return { panels, remaining }
}
```

- [ ] **Step 3: Run tests — will fail because flatParser doesn't exist yet**

Expected: FAIL — `./flatParser` not found. That's OK — we implement it in the next task.

- [ ] **Step 4: Commit (hold until Task 10 completes)**

This task is tightly coupled with Task 10. Commit them together after both pass.

---

## Task 10: Flat Content Parser

**Files:**
- Create: `repos/threads/src/parser/flatParser.ts`
- Test: `repos/threads/src/parser/flatParser.test.ts`

Pattern matching in specificity order. Each section of tokens (split by WhitespaceGap) is matched against 10 patterns. First match wins.

- [ ] **Step 1: Write flat parser tests**

Create `repos/threads/src/parser/flatParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseFlatContent } from './flatParser'
import type { TToken, TTextRun, THighlightedBlock, TWhitespaceGap } from '@TTH/tokenizer'

describe('parseFlatContent', () => {
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const green = { r: 0, g: 255, b: 0 }
  const red = { r: 255, g: 0, b: 0 }
  const blue = { r: 0, g: 0, b: 255 }
  const scope = { top: 0, left: 0, bottom: 10, right: 40 }
  const cursor = { x: 0, y: 0, visible: false }

  it('parses numbered list as SelectList', () => {
    const tokens: TToken[] = [
      { type: 'TextRun', bounds: { top: 0, left: 2, bottom: 0, right: 20 }, spans: [{ text: '1. Option A', fg: white, bg: black, flags: 0 }] },
      { type: 'TextRun', bounds: { top: 1, left: 2, bottom: 1, right: 20 }, spans: [{ text: '2. Option B', fg: white, bg: black, flags: 0 }] },
      { type: 'TextRun', bounds: { top: 2, left: 2, bottom: 2, right: 20 }, spans: [{ text: '3. Option C', fg: white, bg: black, flags: 0 }] },
    ]
    const nodes = parseFlatContent(tokens, scope, cursor)
    const selectLists = nodes.filter(n => n.type === 'SelectList')
    expect(selectLists).toHaveLength(1)
    expect(selectLists[0].type).toBe('SelectList')
    if (selectLists[0].type === 'SelectList') {
      expect(selectLists[0].children).toHaveLength(3)
      expect(selectLists[0].style).toBe('numbered')
    }
  })

  it('parses diff-colored lines as DiffBlock', () => {
    const tokens: TToken[] = [
      { type: 'TextRun', bounds: { top: 0, left: 0, bottom: 0, right: 20 }, spans: [{ text: '+added line', fg: green, bg: black, flags: 0 }] },
      { type: 'TextRun', bounds: { top: 1, left: 0, bottom: 1, right: 20 }, spans: [{ text: '-removed line', fg: red, bg: black, flags: 0 }] },
      { type: 'TextRun', bounds: { top: 2, left: 0, bottom: 2, right: 20 }, spans: [{ text: ' context line', fg: white, bg: black, flags: 0 }] },
    ]
    const nodes = parseFlatContent(tokens, scope, cursor)
    const diffBlocks = nodes.filter(n => n.type === 'DiffBlock')
    expect(diffBlocks).toHaveLength(1)
  })

  it('falls back to TextLine for unmatched content', () => {
    const tokens: TToken[] = [
      { type: 'TextRun', bounds: { top: 0, left: 0, bottom: 0, right: 10 }, spans: [{ text: 'Hello world', fg: white, bg: black, flags: 0 }] },
    ]
    const nodes = parseFlatContent(tokens, scope, cursor)
    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('TextLine')
  })

  it('parses highlighted blocks on last row as StatusBar', () => {
    const tokens: TToken[] = [
      { type: 'HighlightedBlock', bounds: { top: 10, left: 0, bottom: 10, right: 40 }, color: blue, shape: 'full-width' as const },
      { type: 'TextRun', bounds: { top: 10, left: 0, bottom: 10, right: 40 }, spans: [
        { text: 'NORMAL', fg: black, bg: blue, flags: 0x01 },
        { text: '  main  ', fg: white, bg: blue, flags: 0 },
        { text: 'ln 42', fg: white, bg: blue, flags: 0 },
      ]},
    ]
    const nodes = parseFlatContent(tokens, scope, cursor)
    const statusBars = nodes.filter(n => n.type === 'StatusBar')
    expect(statusBars).toHaveLength(1)
  })

  it('creates Separator from WhitespaceGap', () => {
    const tokens: TToken[] = [
      { type: 'TextRun', bounds: { top: 0, left: 0, bottom: 0, right: 10 }, spans: [{ text: 'before', fg: white, bg: black, flags: 0 }] },
      { type: 'WhitespaceGap', bounds: { top: 1, left: 0, bottom: 1, right: 40 }, height: 1 },
      { type: 'TextRun', bounds: { top: 2, left: 0, bottom: 2, right: 10 }, spans: [{ text: 'after', fg: white, bg: black, flags: 0 }] },
    ]
    const nodes = parseFlatContent(tokens, scope, cursor)
    const seps = nodes.filter(n => n.type === 'Separator')
    expect(seps).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Implement flat content parser**

Create `repos/threads/src/parser/flatParser.ts`:

```typescript
import type { TRect, TContentNode, TSpan, TTextLine, TSelectList, TSelectItem, TDiffBlock, TConfirm, TTextInput, TActionTarget, TStatusBar, TTable, TTableRow, TLink, TSeparator, RGB } from '@TTH/ast'
import { CellFlags, type TToken, type TTextRun, type THighlightedBlock, type TWhitespaceGap, type TLinkSpan, type TRawSpan } from '@TTH/tokenizer'

// --- Helpers ---

function rawSpanToSpan(raw: TRawSpan): TSpan {
  return {
    type: 'Span', text: raw.text, fg: raw.fg, bg: raw.bg,
    bold: (raw.flags & CellFlags.BOLD) !== 0,
    italic: (raw.flags & CellFlags.ITALIC) !== 0,
    underline: (raw.flags & CellFlags.UNDERLINE) !== 0,
    strikethrough: (raw.flags & CellFlags.STRIKETHROUGH) !== 0,
    faint: (raw.flags & CellFlags.FAINT) !== 0,
    inverse: (raw.flags & CellFlags.INVERSE) !== 0,
  }
}

function textRunToTextLine(run: TTextRun): TTextLine {
  return { type: 'TextLine', bounds: run.bounds, children: run.spans.map(rawSpanToSpan) }
}

function fullText(run: TTextRun): string {
  return run.spans.map(s => s.text).join('')
}

type TSection = { tokens: TToken[]; bounds: TRect }

function groupByRow(runs: TTextRun[]): Map<number, TTextRun[]> {
  const map = new Map<number, TTextRun[]>()
  for (const run of runs) {
    const row = run.bounds.top
    if (!map.has(row)) map.set(row, [])
    map.get(row)!.push(run)
  }
  return map
}

// --- Pattern matchers (return nodes or null) ---

const NUMBERED_RE = /^\s*\d+[.)]\s/
const ARROW_RE = /^\s*[❯›>→]\s/

function trySelectList(section: TSection, blocks: THighlightedBlock[]): TSelectList | null {
  const runs = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  if (runs.length < 3) return null

  let score = 0
  let style: TSelectList['style'] = 'highlighted'

  // Check consistent indentation
  const indents = runs.map(r => r.bounds.left)
  const allSameIndent = indents.every(i => i === indents[0])
  if (allSameIndent) score += 3

  // Check numbered markers
  const texts = runs.map(fullText)
  const numberedCount = texts.filter(t => NUMBERED_RE.test(t)).length
  if (numberedCount === runs.length) { score += 3; style = 'numbered' }

  // Check arrow markers
  const arrowCount = texts.filter(t => ARROW_RE.test(t)).length
  if (arrowCount >= 1) { score += 3; style = 'arrow' }

  // Check sequential numbering
  if (style === 'numbered') {
    const nums = texts.map(t => parseInt(t.match(/\d+/)?.[0] ?? '0'))
    const sequential = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)
    if (sequential) score += 2
  }

  // Check highlighted row (exactly one among peers)
  const rowBlocks = blocks.filter(b => runs.some(r => r.bounds.top === b.bounds.top))
  if (rowBlocks.length === 1) score += 3

  if (score < 5) return null

  // Determine selected index
  let selectedIndex = -1
  if (style === 'arrow') {
    selectedIndex = texts.findIndex(t => ARROW_RE.test(t))
  } else if (rowBlocks.length === 1) {
    selectedIndex = runs.findIndex(r => r.bounds.top === rowBlocks[0].bounds.top)
  }
  if (selectedIndex < 0) selectedIndex = 0

  const items: TSelectItem[] = runs.map((run, i) => ({
    type: 'SelectItem',
    bounds: run.bounds,
    selected: i === selectedIndex,
    index: i,
    children: run.spans.map(rawSpanToSpan),
  }))

  const bounds = {
    top: Math.min(...runs.map(r => r.bounds.top)),
    left: Math.min(...runs.map(r => r.bounds.left)),
    bottom: Math.max(...runs.map(r => r.bounds.bottom)),
    right: Math.max(...runs.map(r => r.bounds.right)),
  }

  return { type: 'SelectList', bounds, selectedIndex, style, children: items }
}

function tryTable(section: TSection): TTable | null {
  const runs = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  if (runs.length < 3) return null

  const texts = runs.map(fullText)
  // Detect column separators: │ | ┃ at consistent positions
  const sepPositions = new Map<number, number>()
  for (const text of texts) {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]
      if (ch === '│' || ch === '|' || ch === '┃') {
        sepPositions.set(i, (sepPositions.get(i) ?? 0) + 1)
      }
    }
  }

  // Need at least 2 consistent separator columns at >60% of rows
  const threshold = texts.length * 0.6
  const validSeps = [...sepPositions.entries()].filter(([_, count]) => count >= threshold).map(([pos]) => pos).sort((a, b) => a - b)
  if (validSeps.length < 2) return null

  // Determine header (first row if bold/underline or followed by border)
  const firstRun = runs[0]
  const hasHeader = firstRun.spans.some(s => (s.flags & (CellFlags.BOLD | CellFlags.UNDERLINE)) !== 0)

  const tableRows: TTableRow[] = runs.map((run, i) => {
    const text = fullText(run)
    const cellTexts: string[] = []
    let lastPos = 0
    for (const sep of validSeps) {
      cellTexts.push(text.slice(lastPos, sep).trim())
      lastPos = sep + 1
    }
    cellTexts.push(text.slice(lastPos).trim())

    return {
      type: 'TableRow',
      bounds: run.bounds,
      isHeader: hasHeader && i === 0,
      cells: cellTexts.map(ct => [{ type: 'Span' as const, text: ct, fg: run.spans[0]?.fg ?? { r: 255, g: 255, b: 255 }, bg: run.spans[0]?.bg ?? { r: 0, g: 0, b: 0 }, bold: false, italic: false, underline: false, strikethrough: false, faint: false, inverse: false }]),
    }
  })

  return { type: 'Table', bounds: section.bounds, hasHeader, children: tableRows }
}

function tryDiffBlock(section: TSection): TDiffBlock | null {
  const runs = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  if (runs.length < 2) return null

  const texts = runs.map(fullText)
  const addRemoveCount = texts.filter(t => /^[+-]/.test(t.trimStart())).length
  // Also check for green/red coloring
  const greenRedCount = runs.filter(r => {
    const fg = r.spans[0]?.fg
    if (!fg) return false
    return (fg.g > 150 && fg.r < 100) || (fg.r > 150 && fg.g < 100)
  }).length

  if (addRemoveCount < 2 && greenRedCount < 2) return null

  return {
    type: 'DiffBlock',
    bounds: section.bounds,
    children: runs.map(textRunToTextLine),
  }
}

function tryConfirm(section: TSection, blocks: THighlightedBlock[], cursor: { x: number; y: number; visible: boolean }): TConfirm | null {
  const runs = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  if (runs.length < 1) return null

  const text = runs.map(fullText).join(' ')
  const ynMatch = text.match(/\(([yY])\s*\/\s*([nN])\)|\[([yY])\s*\/\s*([nN])\]/i)
  if (!ynMatch) {
    // Check for two small highlighted blocks (buttons)
    const sectionBlocks = blocks.filter(b =>
      b.bounds.top >= section.bounds.top && b.bounds.bottom <= section.bounds.bottom && b.shape === 'small'
    )
    if (sectionBlocks.length !== 2) return null
  }

  const options: [string, string] = ynMatch
    ? [ynMatch[1] ?? ynMatch[3] ?? 'y', ynMatch[2] ?? ynMatch[4] ?? 'n']
    : ['Yes', 'No']

  const question = text.replace(/\([yYnN]\s*\/\s*[yYnN]\)|\[[yYnN]\s*\/\s*[yYnN]\]/gi, '').trim()

  return { type: 'Confirm', bounds: section.bounds, question, options, focusedIndex: 0 }
}

function tryTextInput(section: TSection, cursor: { x: number; y: number; visible: boolean }): TTextInput | null {
  if (!cursor.visible) return null
  if (cursor.y < section.bounds.top || cursor.y > section.bounds.bottom) return null

  const runs = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  const cursorRow = runs.find(r => r.bounds.top === cursor.y)
  if (!cursorRow) return null

  const text = fullText(cursorRow)
  const promptChars = ['>', '$', '%', '#', ':', '?', '❯', '›']
  let promptEnd = -1
  for (let i = 0; i < text.length; i++) {
    if (promptChars.includes(text[i]) && (i + 1 >= text.length || text[i + 1] === ' ')) {
      promptEnd = i + 1
      break
    }
  }
  if (promptEnd < 0) return null

  const prompt = text.slice(0, promptEnd).trim()
  const afterPrompt = text.slice(promptEnd).trimStart()
  const cursorOffset = cursor.x - cursorRow.bounds.left - promptEnd

  return {
    type: 'TextInput', bounds: section.bounds, prompt,
    value: afterPrompt, cursorOffset: Math.max(0, cursorOffset),
  }
}

function tryActionTargets(section: TSection, blocks: THighlightedBlock[]): TActionTarget[] | null {
  const sectionBlocks = blocks.filter(b =>
    b.bounds.top >= section.bounds.top && b.bounds.bottom <= section.bounds.bottom && b.shape === 'small'
  )
  if (sectionBlocks.length === 0) return null

  const runs = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  const targets: TActionTarget[] = []

  for (const block of sectionBlocks) {
    const run = runs.find(r => r.bounds.top === block.bounds.top
      && r.bounds.left <= block.bounds.right && r.bounds.right >= block.bounds.left)
    if (!run) continue

    const text = fullText(run).trim()
    if (text.length > 20) continue // too long for a button

    let score = 2 // non-default bg
    if (text.length < 20) score += 1
    const hotkeyMatch = text.match(/\[(\w)\]|\((\w)\)|Ctrl\+(\w)/i)
    if (hotkeyMatch) score += 2
    if (sectionBlocks.length > 1) score += 2 // peer group

    if (score < 3) continue

    targets.push({
      type: 'ActionTarget', bounds: block.bounds,
      label: text, focused: false,
      children: run.spans.map(rawSpanToSpan),
      ...(hotkeyMatch ? { hotkey: hotkeyMatch[1] ?? hotkeyMatch[2] ?? `Ctrl+${hotkeyMatch[3]}` } : {}),
    })
  }

  return targets.length > 0 ? targets : null
}

function tryStatusBar(section: TSection, blocks: THighlightedBlock[], scopeBounds: TRect): TStatusBar | null {
  const fullWidthBlocks = blocks.filter(b =>
    b.bounds.top === scopeBounds.bottom && b.shape === 'full-width'
  )
  if (fullWidthBlocks.length === 0) return null

  const runs = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  const barRun = runs.find(r => r.bounds.top === scopeBounds.bottom)
  if (!barRun) return null

  // Split spans into segments at style boundaries
  const segments: TSpan[][] = []
  let current: TSpan[] = []
  for (const raw of barRun.spans) {
    const s = rawSpanToSpan(raw)
    if (current.length > 0 && s.text.startsWith('  ')) {
      segments.push(current)
      current = [{ ...s, text: s.text.trimStart() }]
    } else {
      current.push(s)
    }
  }
  if (current.length > 0) segments.push(current)

  return { type: 'StatusBar', bounds: barRun.bounds, segments }
}

// --- Main function ---

export function parseFlatContent(
  tokens: TToken[],
  scopeBounds: TRect,
  cursor: { x: number; y: number; visible: boolean },
): TContentNode[] {
  const nodes: TContentNode[] = []

  // Separate token types
  const runs = tokens.filter((t): t is TTextRun => t.type === 'TextRun')
  const blocks = tokens.filter((t): t is THighlightedBlock => t.type === 'HighlightedBlock')
  const gaps = tokens.filter((t): t is TWhitespaceGap => t.type === 'WhitespaceGap')
  const linkSpans = tokens.filter((t): t is TLinkSpan => t.type === 'LinkSpan')

  // Split into sections by WhitespaceGap
  const sections: TSection[] = []
  const gapRows = new Set(gaps.flatMap(g => {
    const rows: number[] = []
    for (let r = g.bounds.top; r <= g.bounds.bottom; r++) rows.push(r)
    return rows
  }))

  let currentTokens: TToken[] = []
  let sectionTop = scopeBounds.top

  const allContentTokens = [...runs, ...blocks].sort((a, b) => a.bounds.top - b.bounds.top)
  for (const token of allContentTokens) {
    if (gapRows.has(token.bounds.top) && currentTokens.length > 0) {
      const bounds = {
        top: sectionTop,
        left: scopeBounds.left,
        bottom: token.bounds.top - 1,
        right: scopeBounds.right,
      }
      sections.push({ tokens: currentTokens, bounds })
      currentTokens = []
      sectionTop = token.bounds.top
    }
    currentTokens.push(token)
  }
  if (currentTokens.length > 0) {
    sections.push({
      tokens: currentTokens,
      bounds: { top: sectionTop, left: scopeBounds.left, bottom: scopeBounds.bottom, right: scopeBounds.right },
    })
  }

  // Handle empty case — just gaps
  if (sections.length === 0 && runs.length === 0) {
    for (const gap of gaps) {
      nodes.push({ type: 'Separator', bounds: gap.bounds, style: 'blank' })
    }
    return nodes
  }

  // Process each section with pattern matching
  let gapIdx = 0
  for (const section of sections) {
    // Insert separators for gaps before this section
    while (gapIdx < gaps.length && gaps[gapIdx].bounds.bottom < section.bounds.top) {
      nodes.push({ type: 'Separator', bounds: gaps[gapIdx].bounds, style: 'blank' })
      gapIdx++
    }

    const sectionBlocks = blocks.filter(b =>
      b.bounds.top >= section.bounds.top && b.bounds.bottom <= section.bounds.bottom
    )

    // Pattern matching in specificity order
    const selectList = trySelectList(section, sectionBlocks)
    if (selectList) { nodes.push(selectList); continue }

    const table = tryTable(section)
    if (table) { nodes.push(table); continue }

    const diffBlock = tryDiffBlock(section)
    if (diffBlock) { nodes.push(diffBlock); continue }

    const confirm = tryConfirm(section, sectionBlocks, cursor)
    if (confirm) { nodes.push(confirm); continue }

    const textInput = tryTextInput(section, cursor)
    if (textInput) { nodes.push(textInput); continue }

    const actionTargets = tryActionTargets(section, sectionBlocks)
    if (actionTargets) { nodes.push(...actionTargets); continue }

    const statusBar = tryStatusBar(section, sectionBlocks, scopeBounds)
    if (statusBar) { nodes.push(statusBar); continue }

    // Links
    const sectionLinks = linkSpans.filter(l =>
      l.bounds.top >= section.bounds.top && l.bounds.bottom <= section.bounds.bottom
    )
    for (const link of sectionLinks) {
      nodes.push({ type: 'Link', bounds: link.bounds, hyperlinkId: link.hyperlinkId, children: [{ type: 'Span', text: link.text, fg: { r: 100, g: 149, b: 237 }, bg: { r: 0, g: 0, b: 0 }, bold: false, italic: false, underline: true, strikethrough: false, faint: false, inverse: false }] })
    }

    // Fallback: TextLine + Span
    const sectionRuns = section.tokens.filter((t): t is TTextRun => t.type === 'TextRun')
    for (const run of sectionRuns) {
      nodes.push(textRunToTextLine(run))
    }
  }

  // Trailing gaps
  while (gapIdx < gaps.length) {
    nodes.push({ type: 'Separator', bounds: gaps[gapIdx].bounds, style: 'blank' })
    gapIdx++
  }

  return nodes
}
```

- [ ] **Step 3: Run all parser tests**

Run: `cd repos/threads && npx vitest run src/parser/`
Expected: All tests PASS (mode detection, scope parser, flat parser).

- [ ] **Step 4: Commit**

```
feat(threads): add scope parser and flat content parser

Scope parser converts BorderFrame tokens to Panel nodes via
recursive descent. Flat content parser matches 10 patterns in
specificity order: SelectList, Table, DiffBlock, Confirm,
TextInput, ActionTarget, StatusBar, Link, Separator, TextLine.
```

---

## Task 11: Parser Orchestrator

**Files:**
- Create: `repos/threads/src/parser/parser.ts`
- Create: `repos/threads/src/parser/index.ts`
- Test: `repos/threads/src/parser/parser.test.ts`

- [ ] **Step 1: Write parser orchestrator test**

Create `repos/threads/src/parser/parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parse } from './parser'
import { tokenize } from '@TTH/tokenizer'
import { buildTestViewport } from '@TTH/tokenizer'

describe('parse', () => {
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }

  it('produces a Document from tokenized viewport', () => {
    const { view, cols, rows } = buildTestViewport(20, 3, [
      { row: 0, col: 0, text: 'Hello world', fg: white, bg: black },
      { row: 2, col: 0, text: '> ', fg: white, bg: black },
    ])
    const cursor = { x: 2, y: 2, visible: true }
    const result = tokenize(view, cols, rows, cursor)
    const modeCtx = {
      isAlternateScreen: false,
      cursor,
      dirtyRowCount: 0,
      consecutiveDirtyCycles: 0,
      idleDurationMs: 0,
      hasInteractiveRegion: true,
    }
    const doc = parse(result, modeCtx)
    expect(doc.type).toBe('Document')
    expect(doc.mode).toBe('interactive')
    expect(doc.children.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Implement parser orchestrator**

Create `repos/threads/src/parser/parser.ts`:

```typescript
import type { TDocument, TContentNode } from '@TTH/ast'
import type { TTokenizeResult } from '@TTH/tokenizer'
import { detectMode, type TModeContext } from './modeDetector'
import { parseScopes } from './scopeParser'
import { parseFlatContent } from './flatParser'

export function parse(
  tokenResult: TTokenizeResult,
  modeCtx: TModeContext,
): TDocument {
  const { tokens, cursor, palette, meta } = tokenResult
  const mode = detectMode(modeCtx)

  const cols = meta[0]?.length ?? 80
  const rows = meta.length
  const rootBounds = { top: 0, left: 0, bottom: rows - 1, right: cols - 1 }

  // Scope parsing: frames → panels
  const { panels, remaining } = parseScopes(tokens, rootBounds, {
    x: cursor.position.x,
    y: cursor.position.y,
    visible: cursor.visible,
  })

  // Flat content parsing: remaining tokens → content nodes
  const flatNodes = parseFlatContent(remaining, rootBounds, {
    x: cursor.position.x,
    y: cursor.position.y,
    visible: cursor.visible,
  })

  const children: TContentNode[] = [...panels, ...flatNodes]

  return {
    type: 'Document',
    bounds: rootBounds,
    cursor: { x: cursor.position.x, y: cursor.position.y, visible: cursor.visible },
    mode,
    children,
  }
}
```

- [ ] **Step 3: Create barrel export**

Create `repos/threads/src/parser/index.ts`:

```typescript
export { parse } from './parser'
export { detectMode } from './modeDetector'
export type { TModeContext } from './modeDetector'
export { parseScopes } from './scopeParser'
export { parseFlatContent } from './flatParser'
```

- [ ] **Step 4: Run all parser tests**

Run: `cd repos/threads && npx vitest run src/parser/`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```
feat(threads): add parser orchestrator

Assembles mode detection → scope parsing → flat content parsing
into a single parse() function that produces a Document AST from
tokenized viewport data.
```

---

## Task 12: RenderVisitor and AST Node Components

**Files:**
- Create: `repos/threads/src/visitors/renderVisitor.ts`
- Create: `repos/threads/src/components/ASTNodes/NodeSpan.tsx` (and all 15 node components)
- Create: `repos/threads/src/components/ASTNodes/index.ts`
- Create: `repos/threads/src/visitors/index.ts`
- Test: `repos/threads/src/visitors/renderVisitor.test.ts`

1:1 mapping from AST node types to React components. All components use MUI + threads theme.

- [ ] **Step 1: Create all AST node components**

Each component receives its AST node as props and renders using MUI. Create all 15 in `repos/threads/src/components/ASTNodes/`:

**NodeSpan.tsx:**
```tsx
import { styled } from '@mui/material/styles'
import type { TSpan } from '@TTH/ast'

const StyledSpan = styled('span')({})

export function NodeSpan({ node }: { node: TSpan }) {
  return (
    <StyledSpan sx={{
      color: `rgb(${node.fg.r},${node.fg.g},${node.fg.b})`,
      backgroundColor: `rgb(${node.bg.r},${node.bg.g},${node.bg.b})`,
      fontWeight: node.bold ? 700 : 400,
      fontStyle: node.italic ? 'italic' : 'normal',
      textDecoration: [
        node.underline ? 'underline' : '',
        node.strikethrough ? 'line-through' : '',
      ].filter(Boolean).join(' ') || 'none',
      opacity: node.faint ? 0.6 : 1,
    }}>
      {node.text}
    </StyledSpan>
  )
}
```

**NodeTextLine.tsx:**
```tsx
import { Box } from '@mui/material'
import type { TTextLine } from '@TTH/ast'
import { NodeSpan } from './NodeSpan'

export function NodeTextLine({ node }: { node: TTextLine }) {
  return (
    <Box component="div" sx={{ fontFamily: 'monospace', whiteSpace: 'pre', lineHeight: 1.4, minHeight: '1.4em' }}>
      {node.children.map((span, i) => <NodeSpan key={i} node={span} />)}
    </Box>
  )
}
```

**NodePanel.tsx:**
```tsx
import { Box, Typography } from '@mui/material'
import type { TPanel } from '@TTH/ast'
import { renderNode } from '@TTH/visitors/renderVisitor'

const borderStyles = { single: '1px solid', double: '3px double', heavy: '2px solid', rounded: '1px solid' }

export function NodePanel({ node }: { node: TPanel }) {
  return (
    <Box sx={{
      border: (theme) => `${borderStyles[node.border]} ${theme.palette.divider}`,
      borderRadius: node.border === 'rounded' ? 1 : 0,
      p: 1, my: 0.5,
    }}>
      {node.title && <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5, display: 'block' }}>{node.title}</Typography>}
      {node.children.map((child, i) => renderNode(child, i))}
    </Box>
  )
}
```

**NodeGroup.tsx:**
```tsx
import { Box } from '@mui/material'
import type { TGroup } from '@TTH/ast'
import { renderNode } from '@TTH/visitors/renderVisitor'

export function NodeGroup({ node }: { node: TGroup }) {
  return <Box sx={{ my: 0.25 }}>{node.children.map((child, i) => renderNode(child, i))}</Box>
}
```

**NodeSelectList.tsx:**
```tsx
import { List } from '@mui/material'
import type { TSelectList } from '@TTH/ast'
import { NodeSelectItem } from './NodeSelectItem'

export function NodeSelectList({ node }: { node: TSelectList }) {
  return (
    <List dense disablePadding sx={{ my: 0.5 }}>
      {node.children.map((item, i) => <NodeSelectItem key={i} node={item} />)}
    </List>
  )
}
```

**NodeSelectItem.tsx:**
```tsx
import { ListItemButton, ListItemText } from '@mui/material'
import type { TSelectItem } from '@TTH/ast'
import { NodeSpan } from './NodeSpan'

export function NodeSelectItem({ node }: { node: TSelectItem }) {
  return (
    <ListItemButton selected={node.selected} dense sx={{ borderRadius: 0.5, py: 0.25 }}>
      <ListItemText primary={node.children.map((span, i) => <NodeSpan key={i} node={span} />)} />
    </ListItemButton>
  )
}
```

**NodeConfirm.tsx:**
```tsx
import { Box, Button, Typography } from '@mui/material'
import type { TConfirm } from '@TTH/ast'

export function NodeConfirm({ node, onRespond }: { node: TConfirm; onRespond?: (option: string) => void }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.5, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Typography variant="body2" sx={{ flex: 1 }}>{node.question}</Typography>
      {node.options.map((opt, i) => (
        <Button key={i} size="small" variant={i === node.focusedIndex ? 'contained' : 'outlined'}
          onClick={() => onRespond?.(opt)}>{opt}</Button>
      ))}
    </Box>
  )
}
```

**NodeTextInput.tsx:**
```tsx
import { Box, TextField } from '@mui/material'
import type { TTextInput } from '@TTH/ast'

export function NodeTextInput({ node }: { node: TTextInput }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.5, fontFamily: 'monospace' }}>
      <Box component="span" sx={{ opacity: 0.7 }}>{node.prompt}</Box>
      <TextField size="small" variant="standard" value={node.value}
        sx={{ flex: 1, '& input': { fontFamily: 'monospace' } }} slotProps={{ input: { readOnly: true } }} />
    </Box>
  )
}
```

**NodeActionTarget.tsx:**
```tsx
import { Button } from '@mui/material'
import type { TActionTarget } from '@TTH/ast'

export function NodeActionTarget({ node, onClick }: { node: TActionTarget; onClick?: () => void }) {
  return (
    <Button size="small" variant={node.focused ? 'contained' : 'outlined'} onClick={onClick}
      sx={{ textTransform: 'none', fontFamily: 'monospace', minWidth: 'auto', mx: 0.25 }}>
      {node.label}{node.hotkey && <Box component="span" sx={{ ml: 0.5, opacity: 0.6 }}>({node.hotkey})</Box>}
    </Button>
  )
}
```

**NodeStatusBar.tsx:**
```tsx
import { Box } from '@mui/material'
import type { TStatusBar } from '@TTH/ast'
import { NodeSpan } from './NodeSpan'

export function NodeStatusBar({ node }: { node: TStatusBar }) {
  return (
    <Box sx={{ display: 'flex', gap: 2, py: 0.25, px: 1, fontFamily: 'monospace', fontSize: '0.8rem', bgcolor: 'action.selected', borderRadius: 0.5 }}>
      {node.segments.map((seg, i) => (
        <Box key={i} component="span">{seg.map((span, j) => <NodeSpan key={j} node={span} />)}</Box>
      ))}
    </Box>
  )
}
```

**NodeTable.tsx, NodeTableRow.tsx, NodeDiffBlock.tsx, NodeLink.tsx, NodeSeparator.tsx** — follow the same pattern. Each receives its AST node type and renders with MUI.

Create the barrel export `repos/threads/src/components/ASTNodes/index.ts`:
```typescript
export { NodeSpan } from './NodeSpan'
export { NodeTextLine } from './NodeTextLine'
export { NodePanel } from './NodePanel'
export { NodeGroup } from './NodeGroup'
export { NodeSelectList } from './NodeSelectList'
export { NodeSelectItem } from './NodeSelectItem'
export { NodeConfirm } from './NodeConfirm'
export { NodeTextInput } from './NodeTextInput'
export { NodeActionTarget } from './NodeActionTarget'
export { NodeStatusBar } from './NodeStatusBar'
export { NodeTable } from './NodeTable'
export { NodeTableRow } from './NodeTableRow'
export { NodeDiffBlock } from './NodeDiffBlock'
export { NodeLink } from './NodeLink'
export { NodeSeparator } from './NodeSeparator'
```

- [ ] **Step 2: Create RenderVisitor**

Create `repos/threads/src/visitors/renderVisitor.ts`:

```tsx
import type { ReactElement } from 'react'
import type { TContentNode, TDocument } from '@TTH/ast'
import { NodePanel } from '@TTH/components/ASTNodes/NodePanel'
import { NodeGroup } from '@TTH/components/ASTNodes/NodeGroup'
import { NodeTextLine } from '@TTH/components/ASTNodes/NodeTextLine'
import { NodeSelectList } from '@TTH/components/ASTNodes/NodeSelectList'
import { NodeConfirm } from '@TTH/components/ASTNodes/NodeConfirm'
import { NodeTextInput } from '@TTH/components/ASTNodes/NodeTextInput'
import { NodeActionTarget } from '@TTH/components/ASTNodes/NodeActionTarget'
import { NodeStatusBar } from '@TTH/components/ASTNodes/NodeStatusBar'
import { NodeTable } from '@TTH/components/ASTNodes/NodeTable'
import { NodeDiffBlock } from '@TTH/components/ASTNodes/NodeDiffBlock'
import { NodeLink } from '@TTH/components/ASTNodes/NodeLink'
import { NodeSeparator } from '@TTH/components/ASTNodes/NodeSeparator'

export function renderNode(node: TContentNode, key: number | string): ReactElement {
  switch (node.type) {
    case 'Panel': return <NodePanel key={key} node={node} />
    case 'Group': return <NodeGroup key={key} node={node} />
    case 'TextLine': return <NodeTextLine key={key} node={node} />
    case 'SelectList': return <NodeSelectList key={key} node={node} />
    case 'Confirm': return <NodeConfirm key={key} node={node} />
    case 'TextInput': return <NodeTextInput key={key} node={node} />
    case 'ActionTarget': return <NodeActionTarget key={key} node={node} />
    case 'StatusBar': return <NodeStatusBar key={key} node={node} />
    case 'Table': return <NodeTable key={key} node={node} />
    case 'DiffBlock': return <NodeDiffBlock key={key} node={node} />
    case 'Link': return <NodeLink key={key} node={node} />
    case 'Separator': return <NodeSeparator key={key} node={node} />
  }
}

export function renderDocument(doc: TDocument): ReactElement[] {
  return doc.children.map((child, i) => renderNode(child, i))
}
```

- [ ] **Step 3: Create visitors barrel export**

Create `repos/threads/src/visitors/index.ts`:

```typescript
export { renderNode, renderDocument } from './renderVisitor'
```

- [ ] **Step 4: Type check all new components**

Run: `cd repos/threads && pnpm types`
Expected: No type errors.

- [ ] **Step 5: Commit**

```
feat(threads): add RenderVisitor and 15 AST node components

1:1 mapping from AST node types to MUI React components. Clean
switch-based visitor dispatches to NodePanel, NodeTextLine,
NodeSelectList, NodeConfirm, NodeTextInput, NodeActionTarget,
NodeStatusBar, NodeTable, NodeDiffBlock, NodeLink, NodeSeparator,
NodeGroup, NodeSpan, NodeSelectItem, NodeTableRow.
```

---

## Task 13: FeedVisitor

**Files:**
- Create: `repos/threads/src/visitors/feedVisitor.ts`
- Test: `repos/threads/src/visitors/feedVisitor.test.ts`

Compares AST(t) vs AST(t-1) to produce feed events for the activity timeline.

- [ ] **Step 1: Write FeedVisitor tests**

Create `repos/threads/src/visitors/feedVisitor.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { diffToFeedEvents } from './feedVisitor'
import * as N from '@TTH/ast/nodes'

describe('diffToFeedEvents', () => {
  const rect = { top: 0, left: 0, bottom: 10, right: 40 }
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }
  const cursor = { x: 0, y: 0, visible: true }

  it('emits prompt event when TextInput appears', () => {
    const prev = N.document(rect, cursor, 'interactive', [])
    const next = N.document(rect, cursor, 'interactive', [
      N.textInput(rect, '>', 'hello', 5),
    ])
    const events = diffToFeedEvents(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('prompt')
    expect(events[0].status).toBe('waiting')
  })

  it('emits action event when DiffBlock appears', () => {
    const prev = N.document(rect, cursor, 'interactive', [])
    const next = N.document(rect, cursor, 'interactive', [
      N.diffBlock(rect, [N.textLine(rect, [N.span('+added', { r: 0, g: 255, b: 0 }, black)])]),
    ])
    const events = diffToFeedEvents(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('action')
  })

  it('emits prompt event when SelectList appears', () => {
    const prev = N.document(rect, cursor, 'interactive', [])
    const next = N.document(rect, cursor, 'interactive', [
      N.selectList(rect, 0, 'numbered', [
        N.selectItem(rect, 0, true, [N.span('Option 1', white, black)]),
        N.selectItem(rect, 1, false, [N.span('Option 2', white, black)]),
      ]),
    ])
    const events = diffToFeedEvents(prev, next)
    const prompts = events.filter(e => e.kind === 'prompt')
    expect(prompts).toHaveLength(1)
  })

  it('emits idle event on mode transition to idle', () => {
    const prev = N.document(rect, cursor, 'interactive', [])
    const next = N.document(rect, cursor, 'idle', [])
    const events = diffToFeedEvents(prev, next)
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('idle')
  })

  it('emits tui event on mode transition to tui', () => {
    const prev = N.document(rect, cursor, 'interactive', [])
    const next = N.document(rect, cursor, 'tui', [N.panel(rect, 'single', [])])
    const events = diffToFeedEvents(prev, next)
    expect(events.some(e => e.kind === 'tui')).toBe(true)
  })
})
```

- [ ] **Step 2: Implement FeedVisitor**

Create `repos/threads/src/visitors/feedVisitor.ts`:

```typescript
import type { TDocument, TContentNode, TFeedEvent } from '@TTH/ast'

let eventCounter = 0
const nextId = () => `feed-${++eventCounter}`

function findNodesByType<T extends TContentNode>(doc: TDocument, type: string): T[] {
  const results: T[] = []
  const walk = (nodes: TContentNode[]) => {
    for (const node of nodes) {
      if (node.type === type) results.push(node as T)
      if ('children' in node && Array.isArray(node.children)) walk(node.children as TContentNode[])
    }
  }
  walk(doc.children)
  return results
}

export function diffToFeedEvents(prev: TDocument, next: TDocument): TFeedEvent[] {
  const events: TFeedEvent[] = []

  // Mode transitions
  if (prev.mode !== next.mode) {
    if (next.mode === 'idle') {
      events.push({ kind: 'idle', id: nextId(), timestamp: Date.now() })
    }
    if (next.mode === 'tui') {
      events.push({ kind: 'tui', id: nextId(), status: 'active', regionTree: next })
    }
    if (prev.mode === 'tui' && next.mode !== 'tui') {
      events.push({ kind: 'tui', id: nextId(), status: 'exited', regionTree: prev })
    }
  }

  // TextInput appeared → prompt waiting
  const prevInputs = findNodesByType(prev, 'TextInput')
  const nextInputs = findNodesByType(next, 'TextInput')
  if (nextInputs.length > prevInputs.length) {
    for (const input of nextInputs) {
      if (input.type === 'TextInput') {
        events.push({ kind: 'prompt', id: nextId(), status: 'waiting', question: input.prompt })
      }
    }
  }
  // TextInput disappeared → prompt answered
  if (prevInputs.length > nextInputs.length) {
    events.push({ kind: 'prompt', id: nextId(), status: 'answered', question: prevInputs[0]?.type === 'TextInput' ? (prevInputs[0] as any).prompt : '' })
  }

  // SelectList appeared → prompt with options
  const prevLists = findNodesByType(prev, 'SelectList')
  const nextLists = findNodesByType(next, 'SelectList')
  if (nextLists.length > prevLists.length) {
    for (const list of nextLists) {
      if (list.type === 'SelectList') {
        const options = list.children.map(item => {
          const text = item.children.map(s => s.text).join('')
          return text
        })
        events.push({ kind: 'prompt', id: nextId(), status: 'waiting', question: 'Select an option', options })
      }
    }
  }

  // DiffBlock appeared → action (edit)
  const prevDiffs = findNodesByType(prev, 'DiffBlock')
  const nextDiffs = findNodesByType(next, 'DiffBlock')
  if (nextDiffs.length > prevDiffs.length) {
    events.push({ kind: 'action', id: nextId(), status: 'running', action: 'edit', target: 'file' })
  }

  // Large volume of new TextLine → output streaming
  const prevLines = findNodesByType(prev, 'TextLine')
  const nextLines = findNodesByType(next, 'TextLine')
  const newLineCount = nextLines.length - prevLines.length
  if (newLineCount > 5 && next.mode === 'streaming') {
    events.push({
      kind: 'output', id: nextId(), status: 'streaming',
      lines: nextLines.slice(-newLineCount).filter(n => n.type === 'TextLine') as any[],
      collapsed: false,
    })
  }

  return events
}
```

- [ ] **Step 3: Run tests**

Run: `cd repos/threads && npx vitest run src/visitors/feedVisitor.test.ts`
Expected: All 5 tests PASS.

- [ ] **Step 4: Update visitors barrel export**

Add to `repos/threads/src/visitors/index.ts`:
```typescript
export { diffToFeedEvents } from './feedVisitor'
```

- [ ] **Step 5: Commit**

```
feat(threads): add FeedVisitor (AST diff → feed events)

Compares consecutive AST snapshots to produce typed feed events:
prompt (TextInput/SelectList appearance), action (DiffBlock),
output (streaming TextLines), tui/idle (mode transitions).
```

---

## Task 14: InteractionVisitor and AccessibilityVisitor

**Files:**
- Create: `repos/threads/src/visitors/interactionVisitor.ts`
- Create: `repos/threads/src/visitors/accessibilityVisitor.ts`
- Test: `repos/threads/src/visitors/interactionVisitor.test.ts`

- [ ] **Step 1: Implement InteractionVisitor**

Create `repos/threads/src/visitors/interactionVisitor.ts`:

```typescript
import type { TDocument, TContentNode, TInteractionHandler } from '@TTH/ast'

type TSendKeystroke = (data: string) => void

export function collectInteractions(
  doc: TDocument,
  sendKeystroke: TSendKeystroke,
): TInteractionHandler[] {
  const handlers: TInteractionHandler[] = []
  const cursor = doc.cursor

  const walk = (nodes: TContentNode[]) => {
    for (const node of nodes) {
      switch (node.type) {
        case 'SelectList':
          for (const item of node.children) {
            if (node.style === 'numbered') {
              handlers.push({
                nodeType: 'SelectItem', bounds: item.bounds, label: `Select ${item.index + 1}`,
                execute: () => sendKeystroke(`${item.index + 1}\n`),
              })
            } else {
              const delta = item.index - node.selectedIndex
              const arrows = delta > 0
                ? '\x1b[B'.repeat(delta)
                : '\x1b[A'.repeat(-delta)
              handlers.push({
                nodeType: 'SelectItem', bounds: item.bounds, label: item.children.map(s => s.text).join(''),
                execute: () => sendKeystroke(`${arrows}\n`),
              })
            }
          }
          break

        case 'Confirm':
          node.options.forEach((opt, i) => {
            handlers.push({
              nodeType: 'Confirm', bounds: node.bounds, label: opt,
              execute: () => sendKeystroke(opt.toLowerCase().charAt(0)),
            })
          })
          break

        case 'ActionTarget':
          handlers.push({
            nodeType: 'ActionTarget', bounds: node.bounds, label: node.label,
            execute: () => {
              if (node.hotkey) {
                sendKeystroke(node.hotkey)
              } else {
                // Navigate to target via arrows
                const dx = node.bounds.left - cursor.x
                const dy = node.bounds.top - cursor.y
                const hArrows = dx > 0 ? '\x1b[C'.repeat(dx) : '\x1b[D'.repeat(-dx)
                const vArrows = dy > 0 ? '\x1b[B'.repeat(dy) : '\x1b[A'.repeat(-dy)
                sendKeystroke(`${vArrows}${hArrows}\n`)
              }
            },
          })
          break

        case 'Link':
          handlers.push({
            nodeType: 'Link', bounds: node.bounds,
            label: node.url ?? node.children.map(s => s.text).join(''),
            execute: () => { if (node.url) window.open(node.url, '_blank') },
          })
          break

        case 'Panel': walk(node.children); break
        case 'Group': walk(node.children); break
      }
    }
  }

  walk(doc.children)
  return handlers
}
```

- [ ] **Step 2: Implement AccessibilityVisitor**

Create `repos/threads/src/visitors/accessibilityVisitor.ts`:

```typescript
import type { TContentNode, TAriaProps } from '@TTH/ast'

export function getAriaProps(node: TContentNode): TAriaProps {
  switch (node.type) {
    case 'SelectList':
      return { role: 'listbox', 'aria-activedescendant': `select-item-${node.selectedIndex}` }
    case 'SelectItem':
      return { role: 'option', 'aria-selected': node.selected, id: `select-item-${node.index}` }
    case 'TextInput':
      return { role: 'textbox', 'aria-label': node.prompt }
    case 'ActionTarget':
      return { role: 'button', 'aria-label': node.label }
    case 'Table':
      return { role: 'table' }
    case 'TableRow':
      return node.isHeader ? { role: 'row' } : { role: 'row' }
    case 'StatusBar':
      return { role: 'status', 'aria-live': 'polite' }
    case 'Confirm':
      return { role: 'alertdialog', 'aria-label': node.question }
    default:
      return {}
  }
}
```

- [ ] **Step 3: Write InteractionVisitor test**

Create `repos/threads/src/visitors/interactionVisitor.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { collectInteractions } from './interactionVisitor'
import * as N from '@TTH/ast/nodes'

describe('collectInteractions', () => {
  const rect = { top: 0, left: 0, bottom: 10, right: 40 }
  const white = { r: 255, g: 255, b: 255 }
  const black = { r: 0, g: 0, b: 0 }

  it('generates keystroke handlers for numbered SelectList items', () => {
    const doc = N.document(rect, { x: 0, y: 0, visible: true }, 'interactive', [
      N.selectList(rect, 0, 'numbered', [
        N.selectItem(rect, 0, true, [N.span('Opt 1', white, black)]),
        N.selectItem(rect, 1, false, [N.span('Opt 2', white, black)]),
      ]),
    ])
    const send = vi.fn()
    const handlers = collectInteractions(doc, send)
    expect(handlers).toHaveLength(2)

    handlers[1].execute() // Select item 2
    expect(send).toHaveBeenCalledWith('2\n')
  })

  it('generates handlers for Confirm options', () => {
    const doc = N.document(rect, { x: 0, y: 0, visible: true }, 'interactive', [
      N.confirm(rect, 'Continue?', ['y', 'n'], 0),
    ])
    const send = vi.fn()
    const handlers = collectInteractions(doc, send)
    expect(handlers).toHaveLength(2)

    handlers[0].execute() // Send 'y'
    expect(send).toHaveBeenCalledWith('y')
  })
})
```

- [ ] **Step 4: Run tests**

Run: `cd repos/threads && npx vitest run src/visitors/`
Expected: All tests PASS.

- [ ] **Step 5: Update barrel export**

```typescript
// repos/threads/src/visitors/index.ts
export { renderNode, renderDocument } from './renderVisitor'
export { diffToFeedEvents } from './feedVisitor'
export { collectInteractions } from './interactionVisitor'
export { getAriaProps } from './accessibilityVisitor'
```

- [ ] **Step 6: Commit**

```
feat(threads): add InteractionVisitor and AccessibilityVisitor

InteractionVisitor maps interactive nodes to keystroke handlers
(numbered selection, y/n confirm, hotkeys, arrow navigation).
AccessibilityVisitor annotates nodes with ARIA roles and props.
```

---

## Task 15: GUI State Atoms and Session Engine Hooks

**Files:**
- Create: `repos/threads/src/state/gui.ts`
- Create: `repos/threads/src/hooks/useSessionEngine.ts`
- Create: `repos/threads/src/hooks/useActivityFeed.ts`

Jotai atoms for GUI state (AST, feed events, viewport mode) and React hooks for engine lifecycle and feed management.

- [ ] **Step 1: Create GUI state atoms**

Create `repos/threads/src/state/gui.ts`:

```typescript
import { atomWithReset } from 'jotai/utils'
import type { TDocument, TFeedEvent, TViewportMode } from '@TTH/ast'
import type { SessionEngine } from '@TTH/engine/sessionEngine'

export const sessionASTAtom = atomWithReset<Map<string, TDocument>>(new Map())
export const sessionFeedAtom = atomWithReset<Map<string, TFeedEvent[]>>(new Map())
export const sessionModeAtom = atomWithReset<Map<string, TViewportMode>>(new Map())
export const sessionEngineAtom = atomWithReset<Map<string, SessionEngine>>(new Map())
```

- [ ] **Step 2: Create useSessionEngine hook**

Create `repos/threads/src/hooks/useSessionEngine.ts`:

```typescript
import { useEffect, useRef } from 'react'
import { useAtom } from 'jotai'
import { sessionEngineAtom, sessionASTAtom, sessionFeedAtom, sessionModeAtom } from '@TTH/state/gui'
import { SessionEngine } from '@TTH/engine/sessionEngine'

export function useSessionEngine(sessionId: string | null) {
  const [engines, setEngines] = useAtom(sessionEngineAtom)
  const [, setASTs] = useAtom(sessionASTAtom)
  const [, setFeeds] = useAtom(sessionFeedAtom)
  const [, setModes] = useAtom(sessionModeAtom)
  const initRef = useRef(false)

  useEffect(() => {
    if (!sessionId || engines.get(sessionId) || initRef.current) return
    initRef.current = true

    let engine: SessionEngine | null = null

    SessionEngine.create(sessionId, {
      onAST: (doc) => {
        setASTs(prev => { const next = new Map(prev); next.set(sessionId, doc); return next })
        setModes(prev => { const next = new Map(prev); next.set(sessionId, doc.mode); return next })
      },
      onFeedEvents: (events) => {
        setFeeds(prev => {
          const next = new Map(prev)
          const existing = next.get(sessionId) ?? []
          next.set(sessionId, [...existing, ...events])
          return next
        })
      },
    }).then(e => {
      engine = e
      setEngines(prev => { const next = new Map(prev); next.set(sessionId, e); return next })
    })

    return () => {
      if (engine) {
        engine.destroy()
        setEngines(prev => { const next = new Map(prev); next.delete(sessionId); return next })
        setASTs(prev => { const next = new Map(prev); next.delete(sessionId); return next })
        setFeeds(prev => { const next = new Map(prev); next.delete(sessionId); return next })
        setModes(prev => { const next = new Map(prev); next.delete(sessionId); return next })
      }
    }
  }, [sessionId])

  return engines.get(sessionId ?? '') ?? null
}
```

- [ ] **Step 3: Create useActivityFeed hook**

Create `repos/threads/src/hooks/useActivityFeed.ts`:

```typescript
import { useAtomValue } from 'jotai'
import { sessionFeedAtom, sessionModeAtom } from '@TTH/state/gui'
import type { TFeedEvent, TViewportMode } from '@TTH/ast'

export function useActivityFeed(sessionId: string): { events: TFeedEvent[]; mode: TViewportMode } {
  const feeds = useAtomValue(sessionFeedAtom)
  const modes = useAtomValue(sessionModeAtom)
  return {
    events: feeds.get(sessionId) ?? [],
    mode: modes.get(sessionId) ?? 'interactive',
  }
}
```

- [ ] **Step 4: Type check**

Run: `cd repos/threads && pnpm types`
Expected: No type errors (SessionEngine not yet created — that's Task 16. Type check will fail on the import. Create a stub if needed, or hold this commit until Task 16).

- [ ] **Step 5: Commit (after Task 16)**

Hold until session engine is implemented in Task 16.

---

## Task 16: Session Engine

**Files:**
- Create: `repos/threads/src/engine/sessionEngine.ts`
- Modify: `repos/threads/src/engine/index.ts`

Per-session pipeline orchestration: receives raw bytes, feeds to WASM terminal, runs tokenize → parse → visit, pushes results to callbacks.

- [ ] **Step 1: Implement session engine**

Create `repos/threads/src/engine/sessionEngine.ts`:

```typescript
import type { TDocument, TFeedEvent } from '@TTH/ast'
import type { TBrowserVTerminal } from './wasmBridge'
import type { TPalette } from '@TTH/tokenizer'
import type { TModeContext } from '@TTH/parser'
import { createBrowserTerminal } from './wasmBridge'
import { tokenize } from '@TTH/tokenizer'
import { parse } from '@TTH/parser'
import { diffToFeedEvents } from '@TTH/visitors'

type TEngineCallbacks = {
  onAST: (doc: TDocument) => void
  onFeedEvents: (events: TFeedEvent[]) => void
}

export class SessionEngine {
  private terminal: TBrowserVTerminal
  private callbacks: TEngineCallbacks
  private prevDoc: TDocument | null = null
  private prevPalette: TPalette | null = null
  private consecutiveDirtyCycles = 0
  private lastDataTime = 0
  private idleCheckTimer: ReturnType<typeof setInterval> | null = null
  private rafId: number | null = null
  private dirty = false
  readonly sessionId: string

  private constructor(sessionId: string, terminal: TBrowserVTerminal, callbacks: TEngineCallbacks) {
    this.sessionId = sessionId
    this.terminal = terminal
    this.callbacks = callbacks

    // Periodic idle check
    this.idleCheckTimer = setInterval(() => {
      if (this.prevDoc && this.prevDoc.mode !== 'idle') {
        const idleMs = Date.now() - this.lastDataTime
        if (idleMs > 2000) this.process()
      }
    }, 1000)
  }

  static async create(sessionId: string, callbacks: TEngineCallbacks): Promise<SessionEngine> {
    const terminal = await createBrowserTerminal(80, 24)
    return new SessionEngine(sessionId, terminal, callbacks)
  }

  write(data: string | Uint8Array): void {
    this.terminal.write(data)
    this.lastDataTime = Date.now()
    this.dirty = true

    // Debounce processing via requestAnimationFrame
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null
        if (this.dirty) this.process()
      })
    }
  }

  resize(cols: number, rows: number): void {
    this.terminal.resize(cols, rows)
    this.dirty = true
    this.process()
  }

  private process(): void {
    this.dirty = false
    const dirtyRows = this.terminal.getDirtyRows()
    const cursor = this.terminal.getCursor()
    const view = this.terminal.getViewport()

    // Track dirty cycle counts for streaming detection
    if (dirtyRows.length > 3) {
      this.consecutiveDirtyCycles++
    } else {
      this.consecutiveDirtyCycles = 0
    }

    const idleDurationMs = Date.now() - this.lastDataTime
    const hasInteractiveRegion = false // will be refined by parser output

    // Tokenize
    const tokenResult = tokenize(
      view,
      this.terminal.cols,
      this.terminal.rows,
      cursor,
      this.prevPalette ?? undefined,
      dirtyRows.length > 0 ? dirtyRows : undefined,
    )
    this.prevPalette = tokenResult.palette

    // Parse
    const modeCtx: TModeContext = {
      isAlternateScreen: this.terminal.isAlternateScreen(),
      cursor,
      dirtyRowCount: dirtyRows.length,
      consecutiveDirtyCycles: this.consecutiveDirtyCycles,
      idleDurationMs,
      hasInteractiveRegion,
    }
    const doc = parse(tokenResult, modeCtx)

    // Feed events via diff
    if (this.prevDoc) {
      const feedEvents = diffToFeedEvents(this.prevDoc, doc)
      if (feedEvents.length > 0) {
        this.callbacks.onFeedEvents(feedEvents)
      }
    }

    this.prevDoc = doc
    this.callbacks.onAST(doc)
    this.terminal.markClean()
  }

  destroy(): void {
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer)
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.terminal.free()
  }
}
```

- [ ] **Step 2: Update engine barrel export**

```typescript
// repos/threads/src/engine/index.ts
export { createBrowserTerminal } from './wasmBridge'
export type { TBrowserVTerminal } from './wasmBridge'
export { SessionEngine } from './sessionEngine'
```

- [ ] **Step 3: Type check**

Run: `cd repos/threads && pnpm types`
Expected: No type errors.

- [ ] **Step 4: Commit (combined with Task 15)**

```
feat(threads): add session engine, GUI state atoms, and hooks

SessionEngine orchestrates the per-session pipeline: raw bytes →
WASM terminal → tokenize → parse → visitors → state callbacks.
GUI atoms (AST, feed, mode, engine) track state per session.
useSessionEngine and useActivityFeed hooks manage lifecycle.
```

---

## Task 17: Activity Feed Cards

**Files:**
- Create: `repos/threads/src/components/ActivityFeed/ActionCard.tsx`
- Create: `repos/threads/src/components/ActivityFeed/PromptCard.tsx`
- Create: `repos/threads/src/components/ActivityFeed/OutputCard.tsx`
- Create: `repos/threads/src/components/ActivityFeed/UserInputCard.tsx`
- Create: `repos/threads/src/components/ActivityFeed/IdleMarker.tsx`

Each card renders a specific feed event type in the activity timeline.

- [ ] **Step 1: Create all feed card components**

Each card follows the same pattern: receives a `TFeedEvent` of its kind and renders with MUI. Status dots use green (done), amber (needs attention), purple (working).

**ActionCard.tsx** — status dot + action type + target, expandable detail:
```tsx
import { Box, Typography, Collapse, IconButton } from '@mui/material'
import { ExpandMore, ExpandLess, FiberManualRecord } from '@mui/icons-material'
import { useState } from 'react'
import type { TFeedEvent } from '@TTH/ast'
import { renderDocument } from '@TTH/visitors/renderVisitor'

type TActionEvent = Extract<TFeedEvent, { kind: 'action' }>

const statusColors = { running: '#a855f7', done: '#22c55e', error: '#ef4444' }

export function ActionCard({ event }: { event: TActionEvent }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
      <FiberManualRecord sx={{ fontSize: 10, mt: 0.7, color: statusColors[event.status] }} />
      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>{event.action}</Typography>
          <Typography variant="body2" sx={{ opacity: 0.7, fontFamily: 'monospace' }}>{event.target}</Typography>
          {event.detail && (
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
            </IconButton>
          )}
        </Box>
        {event.detail && (
          <Collapse in={expanded}>
            <Box sx={{ mt: 0.5, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
              {renderDocument(event.detail)}
            </Box>
          </Collapse>
        )}
      </Box>
    </Box>
  )
}
```

**PromptCard.tsx** — interactive response (buttons/list/input), collapses when answered:
```tsx
import { Box, Typography, Button, Chip } from '@mui/material'
import type { TFeedEvent } from '@TTH/ast'
import { FiberManualRecord } from '@mui/icons-material'

type TPromptEvent = Extract<TFeedEvent, { kind: 'prompt' }>

export function PromptCard({ event, onRespond }: { event: TPromptEvent; onRespond?: (answer: string) => void }) {
  const waiting = event.status === 'waiting'
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
      <FiberManualRecord sx={{ fontSize: 10, mt: 0.7, color: waiting ? '#f59e0b' : '#22c55e' }} />
      <Box sx={{ flex: 1 }}>
        <Typography variant="body2">{event.question}</Typography>
        {waiting && event.options && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            {event.options.map((opt, i) => (
              <Button key={i} size="small" variant="outlined" onClick={() => onRespond?.(opt)}>{opt}</Button>
            ))}
          </Box>
        )}
        {event.status === 'answered' && event.answer && (
          <Chip label={event.answer} size="small" sx={{ mt: 0.5 }} />
        )}
      </Box>
    </Box>
  )
}
```

**OutputCard.tsx** — collapsible streaming output with line count:
```tsx
import { Box, Typography, Collapse, IconButton } from '@mui/material'
import { ExpandMore, ExpandLess, FiberManualRecord } from '@mui/icons-material'
import { useState } from 'react'
import type { TFeedEvent } from '@TTH/ast'
import { NodeTextLine } from '@TTH/components/ASTNodes/NodeTextLine'

type TOutputEvent = Extract<TFeedEvent, { kind: 'output' }>

export function OutputCard({ event }: { event: TOutputEvent }) {
  const [expanded, setExpanded] = useState(!event.collapsed)
  const lineCount = event.lines.length
  return (
    <Box sx={{ py: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={() => setExpanded(!expanded)}>
        <FiberManualRecord sx={{ fontSize: 10, color: event.status === 'streaming' ? '#a855f7' : '#6b7280' }} />
        <Typography variant="body2" sx={{ opacity: 0.7 }}>{lineCount} lines of output</Typography>
        {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ mt: 0.5, pl: 2, fontFamily: 'monospace', fontSize: '0.85rem', maxHeight: 300, overflow: 'auto' }}>
          {event.lines.map((line, i) => <NodeTextLine key={i} node={line} />)}
        </Box>
      </Collapse>
    </Box>
  )
}
```

**UserInputCard.tsx:**
```tsx
import { Box, Typography } from '@mui/material'
import type { TFeedEvent } from '@TTH/ast'

type TInputEvent = Extract<TFeedEvent, { kind: 'input' }>

export function UserInputCard({ event }: { event: TInputEvent }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, py: 0.5, pl: 2 }}>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main' }}>{event.text}</Typography>
    </Box>
  )
}
```

**IdleMarker.tsx:**
```tsx
import { Box, Typography } from '@mui/material'
import type { TFeedEvent } from '@TTH/ast'

type TIdleEvent = Extract<TFeedEvent, { kind: 'idle' }>

export function IdleMarker({ event }: { event: TIdleEvent }) {
  const time = new Date(event.timestamp).toLocaleTimeString()
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1, opacity: 0.4 }}>
      <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider' }} />
      <Typography variant="caption">{time}</Typography>
      <Box sx={{ flex: 1, borderBottom: 1, borderColor: 'divider' }} />
    </Box>
  )
}
```

- [ ] **Step 2: Type check**

Run: `cd repos/threads && pnpm types`
Expected: No type errors.

- [ ] **Step 3: Commit**

```
feat(threads): add activity feed card components

ActionCard (status dot + action/target), PromptCard (interactive
response with buttons), OutputCard (collapsible streaming lines),
UserInputCard (styled user text), IdleMarker (timestamp divider).
```

---

## Task 18: ActivityFeed Container and TUICard

**Files:**
- Create: `repos/threads/src/components/ActivityFeed/TUICard.tsx`
- Create: `repos/threads/src/components/ActivityFeed/ActivityFeed.tsx`
- Create: `repos/threads/src/components/ActivityFeed/index.ts`

- [ ] **Step 1: Create TUICard**

```tsx
// repos/threads/src/components/ActivityFeed/TUICard.tsx
import { Box } from '@mui/material'
import type { TFeedEvent } from '@TTH/ast'
import { renderDocument } from '@TTH/visitors/renderVisitor'

type TTUIEvent = Extract<TFeedEvent, { kind: 'tui' }>

export function TUICard({ event }: { event: TTUIEvent }) {
  if (event.status === 'exited') {
    return (
      <Box sx={{ py: 0.5, opacity: 0.7, fontStyle: 'italic' }}>
        TUI session ended
      </Box>
    )
  }
  return (
    <Box sx={{ flex: 1, overflow: 'auto', fontFamily: 'monospace' }}>
      {renderDocument(event.regionTree)}
    </Box>
  )
}
```

- [ ] **Step 2: Create ActivityFeed container**

```tsx
// repos/threads/src/components/ActivityFeed/ActivityFeed.tsx
import { Box } from '@mui/material'
import { useRef, useLayoutEffect } from 'react'
import type { TFeedEvent } from '@TTH/ast'
import { ActionCard } from './ActionCard'
import { PromptCard } from './PromptCard'
import { OutputCard } from './OutputCard'
import { TUICard } from './TUICard'
import { UserInputCard } from './UserInputCard'
import { IdleMarker } from './IdleMarker'

function FeedCard({ event, onRespond }: { event: TFeedEvent; onRespond?: (answer: string) => void }) {
  switch (event.kind) {
    case 'action': return <ActionCard event={event} />
    case 'prompt': return <PromptCard event={event} onRespond={onRespond} />
    case 'output': return <OutputCard event={event} />
    case 'tui': return <TUICard event={event} />
    case 'input': return <UserInputCard event={event} />
    case 'idle': return <IdleMarker event={event} />
  }
}

export function ActivityFeed({ events, onRespond }: { events: TFeedEvent[]; onRespond?: (answer: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [events.length])

  return (
    <Box ref={containerRef} sx={{
      flex: 1, overflow: 'auto', px: 2, py: 1,
      display: 'flex', flexDirection: 'column', gap: 0.25,
    }}>
      {events.map((event, i) => <FeedCard key={event.id ?? i} event={event} onRespond={onRespond} />)}
    </Box>
  )
}
```

- [ ] **Step 3: Create barrel export**

```typescript
// repos/threads/src/components/ActivityFeed/index.ts
export { ActivityFeed } from './ActivityFeed'
export { ActionCard } from './ActionCard'
export { PromptCard } from './PromptCard'
export { OutputCard } from './OutputCard'
export { TUICard } from './TUICard'
export { UserInputCard } from './UserInputCard'
export { IdleMarker } from './IdleMarker'
```

- [ ] **Step 4: Commit**

```
feat(threads): add ActivityFeed container and TUICard

Vertical timeline container with auto-scroll, dispatches feed
events to typed card components. TUICard renders full-viewport
AST during TUI mode, collapses to summary on exit.
```

---

## Task 19: SessionGUIView, SessionHeader, and ViewToggle

**Files:**
- Create: `repos/threads/src/components/SessionGUIView/SessionGUIView.tsx`
- Create: `repos/threads/src/components/SessionGUIView/index.ts`
- Create: `repos/threads/src/components/SessionHeader/SessionHeader.tsx`
- Create: `repos/threads/src/components/SessionHeader/index.ts`
- Create: `repos/threads/src/components/ViewToggle/ViewToggle.tsx`
- Create: `repos/threads/src/components/ViewToggle/index.ts`

- [ ] **Step 1: Create ViewToggle**

```tsx
// repos/threads/src/components/ViewToggle/ViewToggle.tsx
import { ToggleButtonGroup, ToggleButton } from '@mui/material'
import { Dashboard, Terminal } from '@mui/icons-material'

export type TViewMode = 'gui' | 'terminal'

export function ViewToggle({ value, onChange }: { value: TViewMode; onChange: (mode: TViewMode) => void }) {
  return (
    <ToggleButtonGroup value={value} exclusive size="small"
      onChange={(_, v) => { if (v) onChange(v) }}>
      <ToggleButton value="gui"><Dashboard fontSize="small" sx={{ mr: 0.5 }} />GUI</ToggleButton>
      <ToggleButton value="terminal"><Terminal fontSize="small" sx={{ mr: 0.5 }} />Terminal</ToggleButton>
    </ToggleButtonGroup>
  )
}
```

- [ ] **Step 2: Create SessionHeader**

```tsx
// repos/threads/src/components/SessionHeader/SessionHeader.tsx
import { Box, Typography, Chip } from '@mui/material'
import type { TDocument, TFeedEvent } from '@TTH/ast'
import { ViewToggle, type TViewMode } from '@TTH/components/ViewToggle/ViewToggle'

export function SessionHeader({
  runtime, project, doc, feedEvents, viewMode, onViewChange,
}: {
  runtime: string; project?: string; doc: TDocument | null
  feedEvents: TFeedEvent[]; viewMode: TViewMode; onViewChange: (mode: TViewMode) => void
}) {
  // Derive status counters from feed events
  const actions = feedEvents.filter(e => e.kind === 'action')
  const reads = actions.filter(e => e.kind === 'action' && e.action === 'read').length
  const edits = actions.filter(e => e.kind === 'action' && e.action === 'edit').length
  const pending = feedEvents.filter(e => e.kind === 'prompt' && e.status === 'waiting').length

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{runtime}</Typography>
      {project && <Typography variant="body2" sx={{ opacity: 0.7 }}>{project}</Typography>}
      <Box sx={{ flex: 1 }} />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Chip label={`${reads} reads`} size="small" variant="outlined" />
        <Chip label={`${edits} edits`} size="small" variant="outlined" />
        {pending > 0 && <Chip label={`${pending} pending`} size="small" color="warning" />}
      </Box>
      {doc && <Chip label={doc.mode} size="small" variant="outlined" />}
      <ViewToggle value={viewMode} onChange={onViewChange} />
    </Box>
  )
}
```

- [ ] **Step 3: Create SessionGUIView**

```tsx
// repos/threads/src/components/SessionGUIView/SessionGUIView.tsx
import { Box } from '@mui/material'
import { useAtomValue } from 'jotai'
import { sessionASTAtom } from '@TTH/state/gui'
import { useActivityFeed } from '@TTH/hooks/useActivityFeed'
import { ActivityFeed } from '@TTH/components/ActivityFeed'
import { renderDocument } from '@TTH/visitors/renderVisitor'

export function SessionGUIView({ sessionId, onRespond }: { sessionId: string; onRespond?: (answer: string) => void }) {
  const asts = useAtomValue(sessionASTAtom)
  const doc = asts.get(sessionId)
  const { events, mode } = useActivityFeed(sessionId)

  // TUI mode: render full-viewport AST directly
  if (mode === 'tui' && doc) {
    return (
      <Box sx={{ flex: 1, overflow: 'auto', p: 1, fontFamily: 'monospace' }}>
        {renderDocument(doc)}
      </Box>
    )
  }

  // Normal mode: activity feed
  return <ActivityFeed events={events} onRespond={onRespond} />
}
```

- [ ] **Step 4: Create barrel exports**

```typescript
// repos/threads/src/components/SessionGUIView/index.ts
export { SessionGUIView } from './SessionGUIView'

// repos/threads/src/components/SessionHeader/index.ts
export { SessionHeader } from './SessionHeader'

// repos/threads/src/components/ViewToggle/index.ts
export { ViewToggle } from './ViewToggle'
export type { TViewMode } from './ViewToggle'
```

- [ ] **Step 5: Commit**

```
feat(threads): add SessionGUIView, SessionHeader, and ViewToggle

SessionGUIView renders activity feed in normal mode and full-viewport
AST in TUI mode. SessionHeader shows runtime, project, mode chip,
and GUI/Terminal toggle. ViewToggle replaces the old chat/terminal
toggle with GUI-first design.
```

---

## Task 20: Session Page Integration and openSession Update

**Files:**
- Modify: `repos/threads/src/pages/Session/Session.tsx`
- Modify: `repos/threads/src/actions/sessions/openSession.ts`
- Modify: `repos/threads/src/state/sessions.ts`
- Modify: `repos/threads/src/state/accessors.ts`
- Modify: `repos/threads/src/state/selectors.ts`

Wire the new GUI view into the Session page, update openSession to feed binary data to the session engine, and clean up old event/toolState atoms.

- [ ] **Step 1: Update openSession.ts**

In `repos/threads/src/actions/sessions/openSession.ts`:

Remove imports:
```diff
-import { deriveToolState } from '@tdsk/domain'
```

Remove from `ws.onmessage` handler — the block that handles parsed events and deriveToolState (lines ~148-162). Replace with forwarding binary data to the session engine:

```diff
-          } else if (msg.sessionId && msg.event) {
-            const parsedEvent = msg.event as TParsedEvent
-            appendSessionEvent(msg.sessionId, parsedEvent)
-
-            if (
-              parsedEvent.type === `permission` &&
-              getActiveSession() !== msg.sessionId
-            ) {
-              toast.warning(`Sandbox needs permission`, { duration: 5000 })
-            }
-
-            const newState = deriveToolState(parsedEvent)
-            if (newState) {
-              setToolState(msg.sessionId, newState)
-            }
```

Add a new export for engine data subscribers (similar to terminalWriters):

```typescript
const engineWriters = new Map<string, Set<(data: Uint8Array) => void>>()

export const subscribeEngineData = (sessionId: string, cb: (data: Uint8Array) => void) => {
  if (!engineWriters.has(sessionId)) engineWriters.set(sessionId, new Set())
  engineWriters.get(sessionId)!.add(cb)
  return () => { engineWriters.get(sessionId)?.delete(cb) }
}
```

In the binary data handler, add engine forwarding after the rawBuffer push:

```typescript
      // After: terminalWriters.get(sessionId)?.forEach((cb) => cb(data))
      const rawBytes = new Uint8Array(event.data)
      engineWriters.get(sessionId)?.forEach((cb) => cb(rawBytes))
```

Remove unused imports: `TParsedEvent` (if no longer used), `deriveToolState`.

Remove from accessor imports: `appendSessionEvent`, `setToolState`.

- [ ] **Step 2: Update state/sessions.ts**

Remove atoms no longer needed:

```diff
-export const sessionEventsAtom = atomWithReset<Map<string, TParsedEvent[]>>(new Map())
-export const sessionToolStateAtom = atomWithReset<Map<string, TToolState>>(new Map())
```

Remove unused imports: `TParsedEvent`, `TToolState`.

- [ ] **Step 3: Update state/accessors.ts**

Remove accessors for removed atoms:
- Remove `getSessionEvents`, `setSessionEvents`, `appendSessionEvent`, `clearSessionEvents`
- Remove `getToolState`, `setToolState`

- [ ] **Step 4: Update state/selectors.ts**

Remove selectors for removed atoms:
- Remove `useSessionEvents`
- Remove `useToolState`
- Remove `useSessionUpgrades` (if present)

- [ ] **Step 5: Update Session.tsx**

In `repos/threads/src/pages/Session/Session.tsx`:

Replace the view mode type and imports:
```diff
-import { ChatView } from '@TTH/components/ChatView'
+import { SessionGUIView } from '@TTH/components/SessionGUIView'
+import { SessionHeader } from '@TTH/components/SessionHeader'
+import { ViewToggle, type TViewMode } from '@TTH/components/ViewToggle'
+import { useSessionEngine } from '@TTH/hooks/useSessionEngine'
+import { subscribeEngineData, getRawBuffer } from '@TTH/actions/sessions/openSession'
+import { useAtomValue } from 'jotai'
+import { sessionASTAtom } from '@TTH/state/gui'

-type TViewMode = 'chat' | 'terminal'
+// TViewMode now imported from ViewToggle
```

Change the default view mode:
```diff
-const [viewMode, setViewMode] = useState<TViewMode>('chat')
+const [viewMode, setViewMode] = useState<TViewMode>('gui')
```

Add engine hook:
```typescript
const engine = useSessionEngine(activeSessionId)
```

Wire engine to receive binary data (in the session setup effect or after `openSession` resolves):
```typescript
useEffect(() => {
  if (!activeSessionId || !engine) return
  // Replay buffered data
  const buffer = getRawBuffer(activeSessionId)
  for (const chunk of buffer) {
    engine.write(chunk)
  }
  // Subscribe to new data
  const unsub = subscribeEngineData(activeSessionId, (data) => engine.write(data))
  return unsub
}, [activeSessionId, engine])
```

Replace the rendering section:
```diff
-{viewMode === 'chat' && <ChatView sessionId={sessionId} />}
-{viewMode === 'terminal' && <TerminalView sessionId={sessionId} active={viewMode === 'terminal'} />}
+{viewMode === 'gui' && <SessionGUIView sessionId={sessionId} />}
+{viewMode === 'terminal' && <TerminalView sessionId={sessionId} active={viewMode === 'terminal'} />}
```

Replace the toggle:
```diff
-<ToggleButtonGroup value={viewMode} exclusive onChange={handleViewChange}>
-  <ToggleButton value='chat'>Chat</ToggleButton>
-  <ToggleButton value='terminal'>Terminal</ToggleButton>
-</ToggleButtonGroup>
+<ViewToggle value={viewMode} onChange={setViewMode} />
```

- [ ] **Step 6: Simplify SmartInput to raw text input**

The existing `SmartInput` component depends on `useToolState(sessionId)` which no longer exists. Interactive responses (y/n, select list, text prompts) now happen via clicking cards in the ActivityFeed. SmartInput simplifies to a persistent text input that sends raw keystrokes.

In `repos/threads/src/components/SmartInput/SmartInput.tsx`, replace the toolState-based rendering with a single text field:

```tsx
import { useState, type KeyboardEvent } from 'react'
import { Box, TextField, IconButton } from '@mui/material'
import { Send } from '@mui/icons-material'
import { sendInput } from '@TTH/actions/sessions/sendInput'

export type TSmartInput = { sessionId: string }

export function SmartInput({ sessionId }: TSmartInput) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    if (!value.trim()) return
    sendInput(sessionId, value + '\n')
    setValue('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Box sx={{ display: 'flex', gap: 1, px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
      <TextField
        fullWidth size="small" placeholder="Type a command..."
        value={value} onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={{ '& input': { fontFamily: 'monospace' } }}
      />
      <IconButton onClick={handleSubmit} color="primary"><Send /></IconButton>
    </Box>
  )
}
```

Remove the old state-aware imports (`useToolState`, `IdleInput`, `PromptInput`, `WorkingIndicator`, `PermissionButtons`, `InteractiveInput` sub-components). The spec says interactive responses flow through feed cards, not the input area.

- [ ] **Step 7: Type check**

Run: `cd repos/threads && pnpm types`
Expected: No type errors.

- [ ] **Step 8: Commit**

```
feat(threads): integrate GUI view into Session page

Replace ChatView with SessionGUIView. Update openSession to
forward binary data to session engine. Remove sessionEventsAtom
and sessionToolStateAtom (parsing now client-side). Default view
mode is now 'gui' with terminal toggle.
```

---

## Task 21: Backend Simplification and Domain Cleanup

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`
- Modify: `repos/backend/src/types/shellSession.types.ts`
- Modify: `repos/domain/src/parser/index.ts`
- Modify: `repos/domain/src/types/index.ts`
- Modify: `repos/domain/src/types/shellEvent.types.ts`
- Modify: `repos/domain/src/constants/index.ts`
- Modify: `repos/domain/src/models/organization.ts`
- Remove: `repos/domain/src/parser/changeDetector.ts` (+ test)
- Remove: `repos/domain/src/parser/terminalParser.ts` (+ test)
- Remove: `repos/domain/src/parser/contentFilter.ts` (+ test)
- Remove: `repos/domain/src/parser/deriveToolState.ts` (+ test)
- Remove: `repos/domain/src/parser/patternMatcher.ts` (+ test)
- Remove: `repos/domain/src/parser/markdownFormatter.ts` (+ test)
- Remove: `repos/domain/src/parser/web.ts`
- Remove: `repos/domain/src/parser/matchers/` (entire directory)
- Remove: `repos/domain/src/types/gui.types.ts`
- Remove: `repos/domain/src/constants/gui.ts` (+ test)
- Remove: `repos/threads/src/components/ChatView/` (entire directory)

This is cleanup. All new functionality is already in place from Tasks 1-20.

- [ ] **Step 1: Simplify onShellConnect.ts**

In `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`:

Remove imports:
```diff
-import { TerminalParser, GhosttyVT, deriveToolState } from '@tdsk/domain'
```

Remove the `ensureWasmReady()` function and its singleton.

Remove the `broadcastUpgrade()` function (if present).

In the new-session creation path, remove:
- `GhosttyVT.init()` call
- `TerminalParser` instantiation
- `parser.write(data)` in the SSH stream data handler — replace with just broadcasting raw bytes and buffering
- `deriveToolState(event)` calls
- `chunkBuffer` usage (if present)
- `guiConfig` resolution (if present)

In `TShellSession` creation, remove the `parser` field assignment.

The SSH stream `data` handler should simplify to:
```typescript
sshStream.on('data', (data: Buffer) => {
  // Buffer for reconnect replay
  session.buffer.write(data)
  // Broadcast binary data to all attachments
  for (const ws of session.attachments) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data)
    }
  }
})
```

- [ ] **Step 2: Simplify shellSession.types.ts**

```diff
-import { TerminalParser } from '@tdsk/domain'
-import type { TToolState } from '@tdsk/domain'

 export type TShellSession = {
   // ... keep all fields except:
-  parser: TerminalParser
-  toolState: TToolState
-  lastRunningToolCall: (TParsedEvent & { type: 'tool-call' }) | null
 }
```

Remove `gui-interaction` from `TShellControlMsg` union (if present).

- [ ] **Step 3: Clean up domain parser/index.ts**

Replace contents of `repos/domain/src/parser/index.ts` with:
```typescript
export { GhosttyVT } from './ghosttyVT'
export type { VTerminal } from './ghosttyVT'
```

- [ ] **Step 4: Clean up domain types/index.ts**

Remove the gui.types re-export line:
```diff
-export * from './gui.types'
```

- [ ] **Step 5: Clean up domain constants/index.ts**

Remove the gui re-export line:
```diff
-export * from './gui'
```

- [ ] **Step 6: Clean up shellEvent.types.ts**

Remove `TJsonComponentTree` import and any event types that reference it.

- [ ] **Step 7: Clean up organization.ts**

Remove `TOrgConfig` import and the `config` field usage (if it only existed for gui config).

- [ ] **Step 8: Delete old parser files**

Delete all files listed in the "Removed Files" section of this plan. Use `git rm` for tracked files:

```bash
git rm repos/domain/src/parser/changeDetector.ts
git rm repos/domain/src/parser/terminalParser.ts
git rm repos/domain/src/parser/contentFilter.ts
git rm repos/domain/src/parser/deriveToolState.ts
git rm repos/domain/src/parser/patternMatcher.ts
git rm repos/domain/src/parser/markdownFormatter.ts
git rm repos/domain/src/parser/web.ts
git rm -r repos/domain/src/parser/matchers/
git rm repos/domain/src/types/gui.types.ts
git rm repos/domain/src/constants/gui.ts
```

Also remove test files (check for `.test.ts` or `.spec.ts` variants):
```bash
git rm repos/domain/src/parser/cellLayout.probe.test.ts
git rm repos/domain/src/parser/contentFilter.test.ts
git rm repos/domain/src/constants/gui.test.ts
```

- [ ] **Step 9: Delete old ChatView**

```bash
git rm -r repos/threads/src/components/ChatView/
```

- [ ] **Step 10: Search for broken imports**

Run: `cd repos/domain && pnpm types` and `cd repos/backend && pnpm types` and `cd repos/threads && pnpm types`

Fix any remaining broken imports. Common patterns:
- If anything still imports `deriveToolState`, `TerminalParser`, `TToolState`, `TParsedEvent` (for event handling), update or remove the import.
- If anything still imports from `ChatView`, update to use `SessionGUIView`.

- [ ] **Step 11: Run all tests**

```bash
cd repos/domain && pnpm test
cd repos/backend && pnpm test
cd repos/threads && pnpm test
```

Expected: All tests pass. Any test that specifically tested removed code will need to be deleted as part of this step.

- [ ] **Step 12: Commit**

```
refactor: remove old parser, interpreter, and ChatView

Backend simplified to raw byte pipe + storage. Domain cleaned up:
removed TerminalParser, ChangeDetector, ContentFilter, PatternMatcher,
InterpreterService, gui.types, gui constants. Threads ChatView
replaced by SessionGUIView. All parsing now happens client-side
via the AST pipeline.
```

---

## Post-Implementation Verification

After all 21 tasks are complete:

1. **Type check all repos:**
   ```bash
   pnpm types
   ```

2. **Run all unit tests:**
   ```bash
   pnpm test
   ```

3. **Start dev services and verify:**
   ```bash
   tdsk dev start --clean
   cd repos/threads && pnpm start
   ```

4. **Manual testing via browser:**
   - Open threads app, connect to a sandbox session
   - Verify GUI view shows activity feed with cards
   - Toggle to terminal view, verify it still works
   - Toggle back to GUI view, verify state is preserved
   - Test interactive prompts (select list, y/n confirm)
   - Test TUI mode (run a TUI app, verify full-viewport rendering)
   - Test streaming mode (run a build, verify collapsible output)

5. **Integration tests:**
   ```bash
   cd repos/integration && pnpm test
   ```
