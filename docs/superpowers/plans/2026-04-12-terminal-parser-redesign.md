# Terminal Parser Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle regex-based terminal parser with ghostty-web's WASM VT parser running headlessly, with server-only parsing and multiplexed WebSocket delivery.

**Architecture:** Three-layer pipeline — GhosttyVT (WASM virtual terminal) → ChangeDetector (dirty-row sealed-line emitter) → PatternMatcher (runtime-specific event classification). Parsing is server-side only; the client receives raw PTY bytes (binary frames for ghostty-web rendering) plus structured events (JSON text frames for chat UI).

**Tech Stack:** ghostty-web (WASM), TypeScript, WebSocket (ws), Vitest

**Spec:** `docs/superpowers/specs/2026-04-12-terminal-parser-redesign-design.md`

**CRITICAL RULES FOR ALL TASKS:**
- **NEVER run `git commit`, `git push`, or any git write command** — only `git add`, `git status`, `git diff`
- All new files go in appropriate subdirectories, NEVER in the repo root
- Shared/exported types go in the repo's `types/` directory
- Load the relevant sub-repo skill before starting work on that repo

---

## File Structure

### repos/domain/src/parser/ (modified)

| File | Action | Responsibility |
|------|--------|----------------|
| `ghosttyVT.ts` | CREATE | WASM singleton, terminal handle wrapper (`GhosttyVT`, `VTerminal`) |
| `changeDetector.ts` | CREATE | Dirty-row tracking, sealed-line emission, `activity` events |
| `terminalParser.ts` | REWRITE | Orchestrator: VTerminal → ChangeDetector → PatternMatcher |
| `patternMatcher.ts` | MODIFY | Add matcher registry (`matcherRegistry` Map) |
| `matchers/claudeCode.ts` | KEEP | Existing regexes unchanged |
| `matchers/index.ts` | CREATE | Registry: register/lookup matchers by runtime name |
| `index.ts` | MODIFY | Update barrel exports |
| `ansiProcessor.ts` | DELETE | Replaced by GhosttyVT |
| `blockSegmenter.ts` | DELETE | Replaced by ChangeDetector |

### repos/domain/src/types/ (modified)

| File | Action | Changes |
|------|--------|---------|
| `parser.types.ts` | MODIFY | Add `activity` event, remove `input`/`TBlock`/`TSegmenterState`, simplify `TTerminalParserOpts` |

### repos/domain/src/constants/ (modified)

| File | Action | Changes |
|------|--------|---------|
| `parser.ts` | MODIFY | Remove `AnsiRegEx`, `PromptRegEx` (only keep matcher-specific regexes) |

### repos/domain/src/parser/ (tests)

| File | Action |
|------|--------|
| `ghosttyVT.test.ts` | CREATE |
| `changeDetector.test.ts` | CREATE |
| `terminalParser.test.ts` | REWRITE |
| `patternMatcher.test.ts` | MODIFY |
| `ansiProcessor.test.ts` | DELETE |
| `blockSegmenter.test.ts` | DELETE |

### repos/backend/src/ (modified)

| File | Action | Changes |
|------|--------|---------|
| `endpoints/sandboxes/onShellConnect.ts` | MODIFY | Add tool state machine, text frame emission, remove `trackInput` |
| `types/shellSession.types.ts` | MODIFY | Add `rawPtyBuffer` field, update parser type |
| `services/sandboxes/sandbox.ts` | MODIFY | Persist raw PTY buffer alongside events |

### repos/threads/src/ (modified)

| File | Action | Changes |
|------|--------|---------|
| `actions/sessions/openSession.ts` | MODIFY | Remove TerminalParser, handle text frames for events |
| `state/sessions.ts` | NO CHANGE | Already stores `TParsedEvent[]` and `TToolState` per session |
| `state/accessors.ts` | NO CHANGE | `appendSessionEvent` and `setToolState` already exist |

---

## Task 1: Update parser types

**Files:**
- Modify: `repos/domain/src/types/parser.types.ts`
- Modify: `repos/domain/src/constants/parser.ts`

- [ ] **Step 1: Update `parser.types.ts`**

Replace the full contents of `repos/domain/src/types/parser.types.ts` with:

```typescript
export type TParsedEvent =
  | { type: `text`; content: string; timestamp: number }
  | {
      type: `tool-call`
      tool: string
      target: string
      status: `running` | `done`
      detail?: string
      timestamp: number
    }
  | { type: `permission`; prompt: string; command?: string; timestamp: number }
  | {
      type: `diff`
      file: string
      additions: string[]
      removals: string[]
      timestamp: number
    }
  | { type: `error`; message: string; timestamp: number }
  | { type: `activity`; timestamp: number }
  | { type: `prompt-ready`; timestamp: number }
  | { type: `unknown`; raw: string; timestamp: number }

export type TToolState = `idle` | `prompt` | `working` | `permission` | `interactive`

export type TPatternMatcher = {
  name: string
  match: (text: string) => TParsedEvent | null
}

export type TTerminalParserOpts = {
  runtime: string
  onEvent: (event: TParsedEvent) => void
  cols?: number
  rows?: number
}
```

Removed: `TParsedEvent.input`, `TParsedEvent.thinking`, `TBlock`, `TSegmenterState`, `TTerminalParserOpts.onToolState`, `TTerminalParserOpts.debounceMs`, `TTerminalParserOpts.thinkingDelayMs`.

Added: `TParsedEvent.activity`.

- [ ] **Step 2: Trim `constants/parser.ts` — remove old regexes, add GhosttyVT constants**

Replace `repos/domain/src/constants/parser.ts` with:

```typescript
// GhosttyVT constants
export const GhosttyVTCellSize = 16
export const GhosttyVTConfigSize = 80 // scrollback(4) + fg(4) + bg(4) + cursor(4) + palette(16×4)

// Claude Code matcher patterns — used by matchers/claudeCode.ts

// Diff patterns (line starts with +/- and has content after)
export const CCDiffAddRegEx = /^\+\s+(.+)/
export const CCDiffRemoveRegEx = /^-\s+(.+)/

// Error patterns
export const CCErrorCrossRegEx = /^✗\s+(.+)/
export const CCErrorPrefixRegEx = /^Error:\s+(.+)/

// Prompt patterns
export const CCPromptPatternRegEx = /^[>$]\s*$/

// Permission prompts
export const CCPermissionProceedRegEx = /Do you want to proceed\?\s*\(y\/n\)/i
export const CCPermissionYNRegEx = /(?:Allow|Do you want to)\s+(.+?)\s*\?\s*\(y\/n\)/i

// ⏺ ToolName target
export const CCToolCallRegEx =
  /^⏺\s+(Read|Edit|Write|Bash|Glob|Grep|Agent|TodoWrite|WebFetch|WebSearch)\s+(.+)$/
```

Removed: `AnsiRegEx`, `PromptRegEx`. Added: `GhosttyVTCellSize`, `GhosttyVTConfigSize`.

- [ ] **Step 3: Run type check to verify no compile errors**

Run: `cd repos/domain && pnpm types`
Expected: Type errors in files that import removed types (`TBlock`, `TSegmenterState`, etc.) — this is expected; those files are deleted/rewritten in later tasks.

- [ ] **Step 4: Stage files**

```bash
git add repos/domain/src/types/parser.types.ts repos/domain/src/constants/parser.ts
```

---

## Task 2: Add ghostty-web dependency to domain

**Files:**
- Modify: `repos/domain/package.json`

- [ ] **Step 1: Add ghostty-web as a dependency**

Run:
```bash
cd repos/domain && pnpm add ghostty-web@0.4.0
```

Expected: `ghostty-web` added to `dependencies` in `repos/domain/package.json`. The WASM binary is resolved through pnpm's node_modules structure.

- [ ] **Step 2: Verify WASM is accessible**

Run:
```bash
node -e "const p = require.resolve('ghostty-web/ghostty-vt.wasm'); console.log('WASM at:', p)"
```

Expected: Prints path to `ghostty-vt.wasm`.

- [ ] **Step 3: Stage files**

```bash
git add repos/domain/package.json pnpm-lock.yaml
```

---

## Task 3: Implement GhosttyVT (WASM wrapper)

**Files:**
- Create: `repos/domain/src/parser/ghosttyVT.ts`
- Test: `repos/domain/src/parser/ghosttyVT.test.ts`

- [ ] **Step 1: Write the failing test**

Create `repos/domain/src/parser/ghosttyVT.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { GhosttyVT } from './ghosttyVT'
import type { VTerminal } from './ghosttyVT'

describe('GhosttyVT', () => {
  beforeAll(async () => {
    await GhosttyVT.init()
  })

  let term: VTerminal

  afterEach(() => {
    term?.free()
  })

  describe('init', () => {
    it('loads WASM singleton', async () => {
      const instance = await GhosttyVT.init()
      expect(instance).toBeDefined()
    })

    it('returns same instance on subsequent calls', async () => {
      const a = await GhosttyVT.init()
      const b = await GhosttyVT.init()
      expect(a).toBe(b)
    })
  })

  describe('createTerminal', () => {
    it('creates terminal with default dimensions', () => {
      term = GhosttyVT.createTerminal()
      expect(term.cols).toBe(80)
      expect(term.rows).toBe(24)
    })

    it('creates terminal with custom dimensions', () => {
      term = GhosttyVT.createTerminal(120, 40)
      expect(term.cols).toBe(120)
      expect(term.rows).toBe(40)
    })
  })

  describe('write + getLineText', () => {
    it('renders plain text', () => {
      term = GhosttyVT.createTerminal()
      term.write('Hello, World!\r\n')
      expect(term.getLineText(0)).toBe('Hello, World!')
    })

    it('strips ANSI color codes', () => {
      term = GhosttyVT.createTerminal()
      term.write('\x1b[31mRed text\x1b[0m\r\n')
      expect(term.getLineText(0)).toBe('Red text')
    })

    it('handles split escape sequences across writes', () => {
      term = GhosttyVT.createTerminal()
      term.write('\x1b')
      term.write('[31mRed\x1b[0m\r\n')
      expect(term.getLineText(0)).toBe('Red')
    })

    it('handles carriage return overwrites', () => {
      term = GhosttyVT.createTerminal()
      term.write('Loading... 0%')
      term.write('\rLoading... 100%')
      term.write('\r\n')
      expect(term.getLineText(0)).toMatch(/^Loading\.\.\. 100%/)
    })

    it('preserves leading whitespace', () => {
      term = GhosttyVT.createTerminal()
      term.write('    indented\r\n')
      expect(term.getLineText(0)).toBe('    indented')
    })

    it('handles OSC title without visible output', () => {
      term = GhosttyVT.createTerminal()
      term.write('\x1b]0;Title\x07Visible\r\n')
      expect(term.getLineText(0)).toBe('Visible')
    })
  })

  describe('dirty-row tracking', () => {
    it('reports dirty rows after write', () => {
      term = GhosttyVT.createTerminal()
      term.write('Line 1\r\n')
      const dirty = term.getDirtyRows()
      expect(dirty.length).toBeGreaterThan(0)
    })

    it('resets dirty state with markClean', () => {
      term = GhosttyVT.createTerminal()
      term.write('Line 1\r\n')
      term.getDirtyRows() // calls update() internally
      term.markClean()
      const dirty = term.getDirtyRows()
      expect(dirty.length).toBe(0)
    })

    it('detects only modified rows after markClean', () => {
      term = GhosttyVT.createTerminal()
      term.write('Row 0\r\nRow 1\r\nRow 2\r\n')
      term.getDirtyRows()
      term.markClean()

      term.write('\x1b[2;1HModified')
      const dirty = term.getDirtyRows()
      expect(dirty).toContain(1)
    })
  })

  describe('getCursor', () => {
    it('returns cursor position', () => {
      term = GhosttyVT.createTerminal()
      term.write('AB\r\n')
      const cursor = term.getCursor()
      expect(cursor.x).toBe(0)
      expect(cursor.y).toBe(1)
    })
  })

  describe('isAlternateScreen', () => {
    it('detects alternate screen mode', () => {
      term = GhosttyVT.createTerminal()
      expect(term.isAlternateScreen()).toBe(false)
      term.write('\x1b[?1049h')
      expect(term.isAlternateScreen()).toBe(true)
      term.write('\x1b[?1049l')
      expect(term.isAlternateScreen()).toBe(false)
    })
  })

  describe('resize', () => {
    it('updates terminal dimensions', () => {
      term = GhosttyVT.createTerminal()
      term.resize(120, 40)
      expect(term.cols).toBe(120)
      expect(term.rows).toBe(40)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/domain && pnpm vitest run src/parser/ghosttyVT.test.ts`
Expected: FAIL — `ghosttyVT.ts` does not exist.

- [ ] **Step 3: Implement GhosttyVT**

Create `repos/domain/src/parser/ghosttyVT.ts`:

```typescript
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { GhosttyVTCellSize, GhosttyVTConfigSize } from '@TDM/constants/parser'

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


export type VTerminal = {
  readonly cols: number
  readonly rows: number
  write: (data: string | Uint8Array) => void
  resize: (cols: number, rows: number) => void
  getDirtyRows: () => number[]
  getLineText: (row: number) => string
  getCursor: () => { x: number; y: number; visible: boolean }
  isAlternateScreen: () => boolean
  markClean: () => void
  free: () => void
}

let singleton: GhosttyVT | null = null

export class GhosttyVT {
  private exports: WasmExports
  private memory: WebAssembly.Memory
  private encoder = new TextEncoder()

  private constructor(instance: WebAssembly.Instance) {
    this.exports = instance.exports as unknown as WasmExports
    this.memory = this.exports.memory
  }

  static async init(): Promise<GhosttyVT> {
    if (singleton) return singleton

    const require = createRequire(import.meta.url)
    const wasmPath = require.resolve('ghostty-web/ghostty-vt.wasm')
    const wasmBytes = await readFile(wasmPath)
    const compiled = await WebAssembly.compile(wasmBytes)

    let instance: WebAssembly.Instance
    instance = await WebAssembly.instantiate(compiled, {
      env: {
        log: (ptr: number, len: number) => {
          const buf = new Uint8Array(
            (instance.exports as unknown as WasmExports).memory.buffer,
            ptr,
            len
          )
          console.log(`[ghostty-vt]`, new TextDecoder().decode(buf))
        },
      },
    })

    singleton = new GhosttyVT(instance)
    return singleton
  }

  createTerminal(cols = 80, rows = 24): VTerminal {
    const { exports, memory, encoder } = this

    // Allocate and zero config buffer
    const configPtr = exports.ghostty_wasm_alloc_u8_array(GhosttyVTConfigSize)
    new Uint8Array(memory.buffer).fill(0, configPtr, configPtr + GhosttyVTConfigSize)
    // scrollbackLimit = 0 (first 4 bytes already zero)
    const handle = exports.ghostty_terminal_new_with_config(cols, rows, configPtr)
    exports.ghostty_wasm_free_u8_array(configPtr, GhosttyVTConfigSize)

    if (!handle) throw new Error(`Failed to create ghostty terminal`)

    // Clear screen to initialize all cells (prevents stale WASM allocator data)
    const clearBytes = encoder.encode(`\x1b[2J\x1b[H`)
    const clearPtr = exports.ghostty_wasm_alloc_u8_array(clearBytes.length)
    new Uint8Array(memory.buffer).set(clearBytes, clearPtr)
    exports.ghostty_terminal_write(handle, clearPtr, clearBytes.length)
    exports.ghostty_wasm_free_u8_array(clearPtr, clearBytes.length)

    let _cols = cols
    let _rows = rows

    const term: VTerminal = {
      get cols() {
        return _cols
      },
      get rows() {
        return _rows
      },

      write(data: string | Uint8Array) {
        const bytes = typeof data === `string` ? encoder.encode(data) : data
        const ptr = exports.ghostty_wasm_alloc_u8_array(bytes.length)
        new Uint8Array(memory.buffer).set(bytes, ptr)
        exports.ghostty_terminal_write(handle, ptr, bytes.length)
        exports.ghostty_wasm_free_u8_array(ptr, bytes.length)
      },

      resize(newCols: number, newRows: number) {
        _cols = newCols
        _rows = newRows
        exports.ghostty_terminal_resize(handle, newCols, newRows)
      },

      getDirtyRows(): number[] {
        exports.ghostty_render_state_update(handle)
        const dirty: number[] = []
        for (let r = 0; r < _rows; r++) {
          if (exports.ghostty_render_state_is_row_dirty(handle, r)) dirty.push(r)
        }
        return dirty
      },

      getLineText(row: number): string {
        exports.ghostty_render_state_update(handle)
        const cellCount = _cols * _rows
        const bufSize = cellCount * GhosttyVTCellSize
        const bufPtr = exports.ghostty_wasm_alloc_u8_array(bufSize)
        new Uint8Array(memory.buffer).fill(0, bufPtr, bufPtr + bufSize)
        exports.ghostty_render_state_get_viewport(handle, bufPtr, cellCount)

        const view = new DataView(memory.buffer)
        const start = row * _cols
        let text = ``
        for (let i = 0; i < _cols; i++) {
          const cp = view.getUint32(bufPtr + (start + i) * GhosttyVTCellSize, true)
          if (cp === 0) continue
          text += String.fromCodePoint(cp)
        }
        exports.ghostty_wasm_free_u8_array(bufPtr, bufSize)
        return text.trimEnd()
      },

      getCursor() {
        exports.ghostty_render_state_update(handle)
        return {
          x: exports.ghostty_render_state_get_cursor_x(handle),
          y: exports.ghostty_render_state_get_cursor_y(handle),
          visible: !!exports.ghostty_render_state_get_cursor_visible(handle),
        }
      },

      isAlternateScreen() {
        return !!exports.ghostty_terminal_is_alternate_screen(handle)
      },

      markClean() {
        exports.ghostty_render_state_mark_clean(handle)
      },

      free() {
        exports.ghostty_terminal_free(handle)
      },
    }

    return term
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && pnpm vitest run src/parser/ghosttyVT.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Stage files**

```bash
git add repos/domain/src/parser/ghosttyVT.ts repos/domain/src/parser/ghosttyVT.test.ts
```

---

## Task 4: Implement ChangeDetector

**Files:**
- Create: `repos/domain/src/parser/changeDetector.ts`
- Test: `repos/domain/src/parser/changeDetector.test.ts`

- [ ] **Step 1: Write the failing test**

Create `repos/domain/src/parser/changeDetector.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { GhosttyVT } from './ghosttyVT'
import type { VTerminal } from './ghosttyVT'
import { ChangeDetector } from './changeDetector'

describe('ChangeDetector', () => {
  beforeAll(async () => {
    await GhosttyVT.init()
  })

  let term: VTerminal

  afterEach(() => {
    term?.free()
  })

  it('emits sealed lines when cursor moves past them', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Line one\r\n')
    detector.process()

    expect(lines).toContain('Line one')
  })

  it('does not emit the active row (cursor still on it)', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Partial')
    detector.process()

    // 'Partial' is on the cursor's row — should not be emitted
    expect(lines).not.toContain('Partial')
  })

  it('emits activity when active row is dirty but no lines sealed', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    let activityCount = 0
    const detector = new ChangeDetector(term, (line) => lines.push(line), () => activityCount++)

    term.write('Spinner frame')
    detector.process()

    expect(lines.length).toBe(0)
    expect(activityCount).toBe(1)
  })

  it('seals active row only after cursor advances', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('First')
    detector.process()
    expect(lines.length).toBe(0)

    term.write('\r\nSecond')
    detector.process()
    expect(lines).toContain('First')
    expect(lines).not.toContain('Second')
  })

  it('handles CR overwrites — only emits final content', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Loading... 0%')
    detector.process()
    term.write('\rLoading... 50%')
    detector.process()
    term.write('\rLoading... 100%')
    detector.process()
    // Still active row — nothing emitted
    expect(lines.length).toBe(0)

    term.write('\r\n')
    detector.process()
    expect(lines.length).toBe(1)
    expect(lines[0]).toMatch(/Loading\.\.\. 100%/)
  })

  it('emits multiple sealed lines from a single write', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Line A\r\nLine B\r\nLine C\r\n')
    detector.process()

    expect(lines).toContain('Line A')
    expect(lines).toContain('Line B')
    expect(lines).toContain('Line C')
  })

  it('flush seals the active row', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('Unflushed content')
    detector.process()
    expect(lines.length).toBe(0)

    detector.flush()
    expect(lines).toContain('Unflushed content')
  })

  it('skips empty lines', () => {
    term = GhosttyVT.createTerminal()
    const lines: string[] = []
    const detector = new ChangeDetector(term, (line) => lines.push(line))

    term.write('\r\n\r\n\r\n')
    detector.process()

    // Empty lines should not produce sealed line callbacks
    expect(lines.every((l) => l.trim().length > 0)).toBe(true)
  })

  it('does not emit activity when no rows are dirty', () => {
    term = GhosttyVT.createTerminal()
    let activityCount = 0
    const detector = new ChangeDetector(term, () => {}, () => activityCount++)

    // No writes, just process
    detector.process()
    expect(activityCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/domain && pnpm vitest run src/parser/changeDetector.test.ts`
Expected: FAIL — `changeDetector.ts` does not exist.

- [ ] **Step 3: Implement ChangeDetector**

Create `repos/domain/src/parser/changeDetector.ts`:

```typescript
import type { VTerminal } from '@TDM/parser/ghosttyVT'

export class ChangeDetector {
  private terminal: VTerminal
  private onSealedLine: (text: string) => void
  private onActivity: () => void
  private lastCursorY = 0

  constructor(
    terminal: VTerminal,
    onSealedLine: (text: string) => void,
    onActivity: () => void = () => {}
  ) {
    this.terminal = terminal
    this.onSealedLine = onSealedLine
    this.onActivity = onActivity
  }

  process() {
    const dirtyRows = this.terminal.getDirtyRows()
    if (dirtyRows.length === 0) return

    const cursor = this.terminal.getCursor()
    let sealedAny = false

    for (const row of dirtyRows) {
      if (row === cursor.y) continue

      const text = this.terminal.getLineText(row)
      if (text.length > 0) {
        this.onSealedLine(text)
        sealedAny = true
      }
    }

    if (!sealedAny && dirtyRows.length > 0) {
      this.onActivity()
    }

    this.lastCursorY = cursor.y
    this.terminal.markClean()
  }

  flush() {
    const cursor = this.terminal.getCursor()
    const text = this.terminal.getLineText(cursor.y)
    if (text.length > 0) {
      this.onSealedLine(text)
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && pnpm vitest run src/parser/changeDetector.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Stage files**

```bash
git add repos/domain/src/parser/changeDetector.ts repos/domain/src/parser/changeDetector.test.ts
```

---

## Task 5: Refactor PatternMatcher with registry

**Files:**
- Modify: `repos/domain/src/parser/patternMatcher.ts`
- Create: `repos/domain/src/parser/matchers/index.ts`
- Modify: `repos/domain/src/parser/patternMatcher.test.ts`

- [ ] **Step 1: Create matcher registry**

Create `repos/domain/src/parser/matchers/index.ts`:

```typescript
import type { TPatternMatcher } from '@TDM/types'
import { claudeCodeMatchers } from '@TDM/parser/matchers/claudeCode'

const matcherRegistry = new Map<string, TPatternMatcher[]>()

// Register built-in matchers
matcherRegistry.set(`claude-code`, claudeCodeMatchers)

export const getMatchers = (runtime: string): TPatternMatcher[] =>
  matcherRegistry.get(runtime) ?? []

export const registerMatchers = (runtime: string, matchers: TPatternMatcher[]) =>
  matcherRegistry.set(runtime, matchers)
```

- [ ] **Step 2: Simplify PatternMatcherPipeline**

Replace `repos/domain/src/parser/patternMatcher.ts` with:

```typescript
import type { TPatternMatcher, TParsedEvent } from '@TDM/types'

export class PatternMatcherPipeline {
  private matchers: TPatternMatcher[]
  private onEvent: (event: TParsedEvent) => void

  constructor(matchers: TPatternMatcher[], onEvent: (event: TParsedEvent) => void) {
    this.matchers = matchers
    this.onEvent = onEvent
  }

  process(text: string) {
    for (const matcher of this.matchers) {
      const event = matcher.match(text)
      if (event) {
        this.onEvent(event)
        return
      }
    }

    if (this.matchers.length === 0) {
      this.onEvent({ type: `unknown`, raw: text, timestamp: Date.now() })
    } else {
      this.onEvent({ type: `text`, content: text, timestamp: Date.now() })
    }
  }
}
```

Key change: `process()` now takes a `string` instead of a `TBlock`. No more input/output classification.

- [ ] **Step 3: Update patternMatcher.test.ts**

Replace `repos/domain/src/parser/patternMatcher.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import type { TParsedEvent, TPatternMatcher } from '@TDM/types'
import { PatternMatcherPipeline } from './patternMatcher'

const mockMatcher: TPatternMatcher = {
  name: `test-matcher`,
  match: (text: string) => {
    if (text.startsWith(`MATCH:`)) {
      return { type: `text`, content: text.slice(6), timestamp: Date.now() }
    }
    return null
  },
}

describe('PatternMatcherPipeline', () => {
  it('emits matched event on first matching pattern', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([mockMatcher], (e) => events.push(e))

    pipeline.process(`MATCH:hello`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`text`)
  })

  it('falls back to text event when no matcher hits', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([mockMatcher], (e) => events.push(e))

    pipeline.process(`no match here`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`text`)
    if (events[0].type === `text`) {
      expect(events[0].content).toBe(`no match here`)
    }
  })

  it('emits unknown event when no matchers registered', () => {
    const events: TParsedEvent[] = []
    const pipeline = new PatternMatcherPipeline([], (e) => events.push(e))

    pipeline.process(`anything`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`unknown`)
  })

  it('stops at first matching matcher (priority order)', () => {
    const events: TParsedEvent[] = []
    const secondMatcher: TPatternMatcher = {
      name: `second`,
      match: () => ({ type: `error`, message: `should not reach`, timestamp: Date.now() }),
    }
    const pipeline = new PatternMatcherPipeline([mockMatcher, secondMatcher], (e) =>
      events.push(e)
    )

    pipeline.process(`MATCH:first wins`)

    expect(events.length).toBe(1)
    expect(events[0].type).toBe(`text`)
  })
})
```

- [ ] **Step 4: Run tests**

Run: `cd repos/domain && pnpm vitest run src/parser/patternMatcher.test.ts`
Expected: All PASS.

- [ ] **Step 5: Stage files**

```bash
git add repos/domain/src/parser/patternMatcher.ts repos/domain/src/parser/patternMatcher.test.ts repos/domain/src/parser/matchers/index.ts
```

---

## Task 6: Rewrite TerminalParser orchestrator

**Files:**
- Rewrite: `repos/domain/src/parser/terminalParser.ts`
- Rewrite: `repos/domain/src/parser/terminalParser.test.ts`

- [ ] **Step 1: Write the failing test**

Replace `repos/domain/src/parser/terminalParser.test.ts` with:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { TerminalParser } from './terminalParser'
import type { TParsedEvent } from '@TDM/types'

describe('TerminalParser', () => {
  beforeAll(async () => {
    // Ensure WASM is loaded before tests run
    const { GhosttyVT } = await import('./ghosttyVT')
    await GhosttyVT.init()
  })

  let parser: TerminalParser

  afterEach(() => {
    parser?.destroy()
  })

  it('parses plain text output into text events', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('Hello world\r\n')
    parser.flush()

    const textEvents = events.filter((e) => e.type === `text`)
    expect(textEvents.length).toBeGreaterThanOrEqual(1)
    if (textEvents[0]?.type === `text`) {
      expect(textEvents[0].content).toContain(`Hello world`)
    }
  })

  it('strips ANSI before pattern matching', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('\x1b[32mGreen text\x1b[0m\r\n')
    parser.flush()

    const textEvent = events.find((e) => e.type === `text`)
    expect(textEvent).toBeDefined()
    if (textEvent?.type === `text`) {
      expect(textEvent.content).not.toContain(`\x1b`)
      expect(textEvent.content).toContain(`Green text`)
    }
  })

  it('detects Claude Code tool calls', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('⏺ Read src/index.ts\r\n')
    parser.flush()

    const toolCall = events.find((e) => e.type === `tool-call`)
    expect(toolCall).toBeDefined()
    if (toolCall?.type === `tool-call`) {
      expect(toolCall.tool).toBe(`Read`)
      expect(toolCall.target).toBe(`src/index.ts`)
    }
  })

  it('detects permission prompts', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('Allow Edit to src/App.tsx? (y/n)\r\n')
    parser.flush()

    const permission = events.find((e) => e.type === `permission`)
    expect(permission).toBeDefined()
  })

  it('handles split escape sequences across writes', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('\x1b[36m⏺\x1b[0m \x1b[1mBa')
    parser.write('sh\x1b[0m echo hello\r\n')
    parser.flush()

    const toolCall = events.find((e) => e.type === `tool-call`)
    expect(toolCall).toBeDefined()
    if (toolCall?.type === `tool-call`) {
      expect(toolCall.tool).toBe(`Bash`)
    }
  })

  it('filters CR overwrites — emits only final line', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('⠋ Working...\r⠙ Working...\r✓ Done!\r\n')
    parser.flush()

    // Should get one text event with the final content, not intermediate spinner frames
    const textEvents = events.filter((e) => e.type === `text`)
    expect(textEvents.length).toBe(1)
    if (textEvents[0]?.type === `text`) {
      expect(textEvents[0].content).toMatch(/Done!/)
    }
  })

  it('emits activity when terminal is active but no lines sealed', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('Spinner frame')
    // No \r\n — cursor stays on the active row

    const activity = events.find((e) => e.type === `activity`)
    expect(activity).toBeDefined()
  })

  it('falls back to unknown for non-registered runtimes', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `custom`,
      onEvent: (e) => events.push(e),
    })

    parser.write('⏺ Read src/index.ts\r\n')
    parser.flush()

    const unknownEvent = events.find((e) => e.type === `unknown`)
    expect(unknownEvent).toBeDefined()
  })

  it('provides raw bytes buffer for persistence', () => {
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: () => {},
    })

    const data = '⏺ Read src/index.ts\r\nsome output\r\n'
    parser.write(data)
    const raw = parser.getRawBuffer()
    expect(raw).toContain(data)
  })

  it('preserves indentation in text events', () => {
    const events: TParsedEvent[] = []
    parser = new TerminalParser({
      runtime: `claude-code`,
      onEvent: (e) => events.push(e),
    })

    parser.write('    indented code\r\n')
    parser.flush()

    const textEvent = events.find((e) => e.type === `text`)
    expect(textEvent).toBeDefined()
    if (textEvent?.type === `text`) {
      expect(textEvent.content).toBe(`    indented code`)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/domain && pnpm vitest run src/parser/terminalParser.test.ts`
Expected: FAIL — current TerminalParser imports `stripAnsi` and `BlockSegmenter` which will be gone.

- [ ] **Step 3: Implement new TerminalParser**

Replace `repos/domain/src/parser/terminalParser.ts` with:

```typescript
import type { TParsedEvent, TTerminalParserOpts } from '@TDM/types'

import { GhosttyVT } from '@TDM/parser/ghosttyVT'
import type { VTerminal } from '@TDM/parser/ghosttyVT'
import { ChangeDetector } from '@TDM/parser/changeDetector'
import { PatternMatcherPipeline } from '@TDM/parser/patternMatcher'
import { getMatchers } from '@TDM/parser/matchers'

export class TerminalParser {
  private terminal: VTerminal
  private detector: ChangeDetector
  private rawBuffer: string[] = []
  private onEvent: (event: TParsedEvent) => void

  constructor(opts: TTerminalParserOpts) {
    this.onEvent = opts.onEvent

    const matchers = getMatchers(opts.runtime)
    const pipeline = new PatternMatcherPipeline(matchers, (event) => {
      this.onEvent(event)
    })

    this.terminal = GhosttyVT.createTerminal(opts.cols ?? 80, opts.rows ?? 24)

    this.detector = new ChangeDetector(
      this.terminal,
      (sealedLine) => pipeline.process(sealedLine),
      () => this.onEvent({ type: `activity`, timestamp: Date.now() })
    )
  }

  write(data: string) {
    this.rawBuffer.push(data)
    this.terminal.write(data)
    this.detector.process()
  }

  flush() {
    this.detector.flush()
  }

  getRawBuffer(): string {
    return this.rawBuffer.join(``)
  }

  resize(cols: number, rows: number) {
    this.terminal.resize(cols, rows)
  }

  isAlternateScreen(): boolean {
    return this.terminal.isAlternateScreen()
  }

  destroy() {
    this.terminal.free()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd repos/domain && pnpm vitest run src/parser/terminalParser.test.ts`
Expected: All tests PASS.

- [ ] **Step 5: Stage files**

```bash
git add repos/domain/src/parser/terminalParser.ts repos/domain/src/parser/terminalParser.test.ts
```

---

## Task 7: Delete old files and update barrel exports

**Files:**
- Delete: `repos/domain/src/parser/ansiProcessor.ts`
- Delete: `repos/domain/src/parser/ansiProcessor.test.ts`
- Delete: `repos/domain/src/parser/blockSegmenter.ts`
- Delete: `repos/domain/src/parser/blockSegmenter.test.ts`
- Modify: `repos/domain/src/parser/index.ts`

- [ ] **Step 1: Delete old files**

```bash
rm repos/domain/src/parser/ansiProcessor.ts
rm repos/domain/src/parser/ansiProcessor.test.ts
rm repos/domain/src/parser/blockSegmenter.ts
rm repos/domain/src/parser/blockSegmenter.test.ts
```

- [ ] **Step 2: Update barrel exports**

Replace `repos/domain/src/parser/index.ts` with:

```typescript
export { GhosttyVT } from './ghosttyVT'
export type { VTerminal } from './ghosttyVT'
export { ChangeDetector } from './changeDetector'
export { TerminalParser } from './terminalParser'
export { PatternMatcherPipeline } from './patternMatcher'
export { claudeCodeMatchers } from './matchers/claudeCode'
export { getMatchers, registerMatchers } from './matchers'
```

- [ ] **Step 3: Run all parser tests**

Run: `cd repos/domain && pnpm vitest run src/parser/`
Expected: All tests PASS (ghosttyVT, changeDetector, patternMatcher, terminalParser, matchers/claudeCode).

- [ ] **Step 4: Run domain type check**

Run: `cd repos/domain && pnpm types`
Expected: PASS (no references to deleted files remain in domain).

- [ ] **Step 5: Stage files**

```bash
git add repos/domain/src/parser/
```

---

## Task 8: Update backend session handler

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`
- Modify: `repos/backend/src/types/shellSession.types.ts`

- [ ] **Step 1: Update TShellSession type**

In `repos/backend/src/types/shellSession.types.ts`, update the import and add tool state fields:

```typescript
import type { WebSocket } from 'ws'
import type { Client, ClientChannel } from 'ssh2'
import type { TerminalParser, ESandboxSessionVisibility, TParsedEvent, TToolState } from '@tdsk/domain'
import type { RingBuffer } from '@TBE/utils/ringBuffer'

export type TShellSession = {
  orgId: string
  userId: string
  sessionId: string
  sshClient: Client
  threadId: string
  sandboxId: string
  buffer: RingBuffer
  parser: TerminalParser
  sshStream: ClientChannel
  attachments: Set<WebSocket>
  ttlTimer: NodeJS.Timeout | null
  projectId?: string
  visibility: ESandboxSessionVisibility
  toolState: TToolState
  lastRunningToolCall: (TParsedEvent & { type: 'tool-call' }) | null
}

export type TShellControlMsg =
  | { type: `resize`; cols: number; rows: number }
  | { type: `signal`; signal: `SIGINT` | `SIGTSTP` }
  | { type: `reconnect`; sessionId: string }
  | { type: `visibility`; visibility: ESandboxSessionVisibility }

export type TShellServerMsg =
  | {
      type: `connected`
      sessionId: string
      sandboxId: string
      runtime: string
      threadId: string
      podOwnerUserId: string
    }
  | { type: `reconnected`; sessionId: string; bufferedBytes: number; podOwnerUserId: string }
  | {
      type: `joined`
      sessionId: string
      sandboxId: string
      runtime: string
      threadId: string
      podOwnerUserId: string
    }
  | { type: `disconnected`; reason: string }
  | { type: `error`; message: string }
  | { type: `visibility`; sessionId: string; visibility: ESandboxSessionVisibility }
  | { type: `user-joined`; sessionId: string; userId: string }
  | { type: `user-left`; sessionId: string; userId: string }
```

- [ ] **Step 2: Update onShellConnect.ts — parser creation and event handling**

In `repos/backend/src/endpoints/sandboxes/onShellConnect.ts`, update the parser creation block (lines 354-360) and the SSH stream `data` handler (lines 423-447):

Replace the parser creation (around line 354):

```typescript
      const parser = new TerminalParser({
        runtime,
        onEvent: (event) => {
          // Tool-call completion tracking (moved from parser)
          if (session.lastRunningToolCall) {
            const completionTriggers = [`tool-call`, `prompt-ready`, `permission`, `error`]
            if (completionTriggers.includes(event.type)) {
              const done: TParsedEvent = {
                ...session.lastRunningToolCall,
                status: `done`,
                timestamp: Date.now(),
              }
              sbService.queueEventForPersistence(sessionId, done)
              broadcastEvent(session, sessionId, done)
              session.lastRunningToolCall = null
            }
          }

          if (event.type === `tool-call` && event.status === `running`) {
            session.lastRunningToolCall = event as TParsedEvent & { type: `tool-call` }
          }

          // Update tool state (moved from parser)
          const newState = deriveToolState(event, session)
          if (newState && newState !== session.toolState) {
            session.toolState = newState
          }

          sbService.queueEventForPersistence(sessionId, event)
          broadcastEvent(session, sessionId, event)
        },
        cols,
        rows,
      })
```

Add the session fields when creating the session object (around line 362):

```typescript
      const session: TShellSession = {
        sessionId,
        sshClient,
        sshStream: stream,
        buffer: new RingBuffer(1024 * 1024),
        attachments: new Set([ws]),
        parser,
        threadId,
        userId,
        orgId,
        sandboxId,
        ttlTimer: null,
        projectId: sandbox?.projects?.[0]?.id ?? undefined,
        visibility: ESandboxSessionVisibility.private,
        toolState: `idle`,
        lastRunningToolCall: null,
      }
```

Add helper functions above the `onShellConnect` export:

```typescript
function broadcastEvent(session: TShellSession, sessionId: string, event: TParsedEvent) {
  const msg = JSON.stringify({ sessionId, event })
  for (const client of session.attachments) {
    if (client.readyState === 1) {
      client.send(msg)
    }
  }
}

function deriveToolState(event: TParsedEvent, session: TShellSession): TToolState | null {
  switch (event.type) {
    case `tool-call`:
      return `working`
    case `text`:
    case `diff`:
      if (session.lastRunningToolCall?.tool === `Bash`) return `interactive`
      return `working`
    case `activity`:
      return `working`
    case `permission`:
      return `permission`
    case `prompt-ready`:
      return `prompt`
    case `error`:
      return `prompt`
    default:
      return null
  }
}
```

- [ ] **Step 3: Remove `trackInput` call from wireWebSocket**

In the `wireWebSocket` function (line 530), remove the `session.parser.trackInput(inputStr)` line:

Replace:
```typescript
    const inputStr = data.toString()
    session.parser.trackInput(inputStr)
    session.sshStream.write(data)
```

With:
```typescript
    session.sshStream.write(data)
```

Also remove the unused `inputStr` variable.

- [ ] **Step 4: Add flush + complete tool calls on stream close**

In the `stream.on('close')` handler (around line 449), add tool-call completion before flush:

Replace:
```typescript
      stream.on(`close`, () => {
        parser.flush()
        sbService.flushEventBatch(sessionId)
```

With:
```typescript
      stream.on(`close`, () => {
        if (session.lastRunningToolCall) {
          const done: TParsedEvent = {
            ...session.lastRunningToolCall,
            status: `done`,
            timestamp: Date.now(),
          }
          sbService.queueEventForPersistence(sessionId, done)
          broadcastEvent(session, sessionId, done)
          session.lastRunningToolCall = null
        }
        parser.flush()
        parser.destroy()
        sbService.flushEventBatch(sessionId)
```

- [ ] **Step 5: Add resize forwarding to parser**

In the `wireWebSocket` function's resize handler (around line 498), add parser resize:

Replace:
```typescript
        if (msg.type === `resize`) {
          session.sshStream.setWindow(msg.rows, msg.cols, msg.rows * 16, msg.cols * 8)
```

With:
```typescript
        if (msg.type === `resize`) {
          session.sshStream.setWindow(msg.rows, msg.cols, msg.rows * 16, msg.cols * 8)
          session.parser.resize(msg.cols, msg.rows)
```

- [ ] **Step 6: Add import for TParsedEvent and TToolState**

Update the imports at the top of `onShellConnect.ts`:

Replace:
```typescript
import { hashKey, ESandboxSessionVisibility, PlanLimits } from '@tdsk/domain'
import type { ESubscriptionTier } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { TerminalParser } from '@tdsk/domain'
```

With:
```typescript
import { hashKey, ESandboxSessionVisibility, PlanLimits, TerminalParser } from '@tdsk/domain'
import type { ESubscriptionTier, TParsedEvent, TToolState } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
```

- [ ] **Step 7: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: PASS.

- [ ] **Step 8: Stage files**

```bash
git add repos/backend/src/endpoints/sandboxes/onShellConnect.ts repos/backend/src/types/shellSession.types.ts
```

---

## Task 9: Update threads SPA — remove client-side parser

**Files:**
- Modify: `repos/threads/src/actions/sessions/openSession.ts`

- [ ] **Step 1: Remove TerminalParser and add text frame handling**

In `repos/threads/src/actions/sessions/openSession.ts`:

Remove these imports:
```typescript
import type { TParsedEvent, TToolState, ESandboxSessionVisibility } from '@tdsk/domain'
import { TerminalParser } from '@tdsk/domain'
```

Replace with:
```typescript
import type { TParsedEvent, TToolState, ESandboxSessionVisibility } from '@tdsk/domain'
```

Remove the `parsers` map (line 23):
```typescript
const parsers = new Map<string, TerminalParser>()
```

Remove the `getParser` export (line 27):
```typescript
export const getParser = (sessionId: string) => parsers.get(sessionId)
```

- [ ] **Step 2: Remove parser creation from setupSession**

In the `setupSession` function, remove the parser creation block (lines 91-102):

```typescript
      const runtime = msg.runtime ?? `custom`
      const parser = new TerminalParser({
        runtime,
        onEvent: (parsedEvent: TParsedEvent) => appendSessionEvent(sessionId, parsedEvent),
        onToolState: (state: TToolState) => {
          setToolState(sessionId, state)
          if (state === `permission` && getActiveSession() !== sessionId) {
            toast.warning(`Sandbox needs permission`, { duration: 5000 })
          }
        },
        debounceMs: 100,
      })
      parsers.set(sessionId, parser)
```

Replace with:
```typescript
      const runtime = msg.runtime ?? `custom`
```

The `runtime` variable is still used below in `setOpenSession`.

- [ ] **Step 3: Update text frame handler to dispatch events from server**

In the `ws.onmessage` handler, inside the `typeof event.data === 'string'` branch, add event dispatch handling. After the existing message type handling (around line 155, after the `user-left` handler), add:

```typescript
          } else if (msg.sessionId && msg.event) {
            // Parsed event from server
            const parsedEvent = msg.event as TParsedEvent
            appendSessionEvent(msg.sessionId, parsedEvent)

            // Derive tool state from events (mirrors backend logic)
            if (parsedEvent.type === `permission`) {
              setToolState(msg.sessionId, `permission`)
              if (getActiveSession() !== msg.sessionId) {
                toast.warning(`Sandbox needs permission`, { duration: 5000 })
              }
            } else if (parsedEvent.type === `prompt-ready` || parsedEvent.type === `error`) {
              setToolState(msg.sessionId, `prompt`)
            } else if (parsedEvent.type === `tool-call` || parsedEvent.type === `activity` || parsedEvent.type === `text` || parsedEvent.type === `diff`) {
              setToolState(msg.sessionId, `working`)
            }
```

- [ ] **Step 4: Remove parser flush and cleanup from onclose**

In the `ws.onclose` handler, remove parser references:

Replace:
```typescript
      parsers.get(sessionId)?.flush()
      connections.delete(sessionId)
      parsers.delete(sessionId)
      rawBuffers.delete(sessionId)
```

With:
```typescript
      connections.delete(sessionId)
      rawBuffers.delete(sessionId)
```

- [ ] **Step 5: Remove parser.write from binary frame handler**

In the binary frame handler (around line 170), remove the parser.write call:

Replace:
```typescript
      parsers.get(sessionId)?.write(data)
      terminalWriters.get(sessionId)?.forEach((cb) => cb(data))
```

With:
```typescript
      terminalWriters.get(sessionId)?.forEach((cb) => cb(data))
```

- [ ] **Step 6: Run threads type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS. If any components import `getParser`, those callsites need updating.

- [ ] **Step 7: Check for getParser consumers and update**

Run: `grep -r "getParser" repos/threads/src/`

If any files import `getParser`, remove those imports and usages. The parser is no longer accessible on the client.

- [ ] **Step 8: Stage files**

```bash
git add repos/threads/src/actions/sessions/openSession.ts
```

---

## Task 10: Initialize WASM on backend startup

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` (or backend startup file)

- [ ] **Step 1: Add WASM initialization before first session**

At the top of `onShellConnect.ts`, after imports, add a lazy init flag:

```typescript
import { GhosttyVT } from '@tdsk/domain'

let wasmReady = false

async function ensureWasmReady() {
  if (wasmReady) return
  await GhosttyVT.init()
  wasmReady = true
}
```

- [ ] **Step 2: Call init at the start of onShellConnect**

At the beginning of the `onShellConnect` function body (after `const { db, sandbox: sbService, kube } = app.locals`), add:

```typescript
  await ensureWasmReady()
```

This ensures the WASM is loaded before the first parser is created. Subsequent calls are no-ops (singleton pattern).

- [ ] **Step 3: Run backend build**

Run: `cd repos/backend && pnpm build`
Expected: PASS.

- [ ] **Step 4: Stage files**

```bash
git add repos/backend/src/endpoints/sandboxes/onShellConnect.ts
```

---

## Task 11: Full test suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run all domain parser tests**

Run: `cd repos/domain && pnpm vitest run src/parser/`
Expected: All pass — ghosttyVT, changeDetector, patternMatcher, matchers/claudeCode, terminalParser.

- [ ] **Step 2: Run full domain test suite**

Run: `cd repos/domain && pnpm test`
Expected: All pass. No regressions in non-parser tests.

- [ ] **Step 3: Run backend type check**

Run: `cd repos/backend && pnpm types`
Expected: PASS.

- [ ] **Step 4: Run threads type check**

Run: `cd repos/threads && pnpm types`
Expected: PASS.

- [ ] **Step 5: Run full monorepo type check**

Run: `pnpm types`
Expected: All repos pass type checking.

- [ ] **Step 6: Run backend build**

Run: `cd repos/backend && pnpm build`
Expected: PASS.

- [ ] **Step 7: Verify the prototype still passes (regression check)**

Run: `node scripts/ghostty-headless-prototype.mjs`
Expected: 36/36 pass. This confirms the WASM is still accessible and functional.

---

## Task 12: Clean up prototype script

**Files:**
- Delete: `scripts/ghostty-headless-prototype.mjs`

- [ ] **Step 1: Delete the prototype**

```bash
rm scripts/ghostty-headless-prototype.mjs
```

The prototype served its purpose during design validation. The real tests now live in `repos/domain/src/parser/ghosttyVT.test.ts`.

- [ ] **Step 2: Stage**

```bash
git add -u scripts/ghostty-headless-prototype.mjs
```
