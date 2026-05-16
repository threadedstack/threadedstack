# ghostty-web → xterm.js Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ghostty-web with xterm.js as the terminal emulator in `repos/threads`, eliminating monkey-patched rendering hacks and raw buffer replay in favor of xterm.js's stable public API, keep-alive terminals, and headless cell-level buffer access.

**Architecture:** The interactive terminal (`TerminalView.tsx`) swaps to `@xterm/xterm` + `@xterm/addon-fit` with keep-alive terminals (no destroy/recreate on tab switch). The GUI engine's headless parser (`wasmBridge.ts`) swaps to `@xterm/headless` with an adapter that packs xterm.js's per-cell API into the existing 16-byte DataView format, so the entire tokenizer/parser/AST pipeline stays untouched. The `ITheme` type import changes from `ghostty-web` to `@xterm/xterm` across 3 files. The `ghostty-web` package and its WASM init are removed entirely.

**Tech Stack:** `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/headless`, React, TypeScript, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `repos/threads/package.json` | Modify | Remove `ghostty-web`, add `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/headless` |
| `repos/threads/src/index.tsx` | Modify | Remove ghostty-web `init()` import and call |
| `repos/threads/src/types/terminal.types.ts` | Modify | Change `ITheme` import from `ghostty-web` to `@xterm/xterm` |
| `repos/threads/src/constants/terminal.ts` | Modify | Change `ITheme` import from `ghostty-web` to `@xterm/xterm` |
| `repos/threads/src/components/Terminal/TerminalThemeSettings.tsx` | Modify | Change `ITheme` import from `ghostty-web` to `@xterm/xterm` |
| `repos/threads/src/components/Terminal/TerminalView.tsx` | Rewrite | xterm.js Terminal + FitAddon, keep-alive on tab switch, ResizeObserver, no monkey-patching |
| `repos/threads/src/services/gui/engine/wasmBridge.ts` | Rewrite | `@xterm/headless` adapter implementing `TBrowserVTerminal` with DataView packing |
| `repos/threads/src/services/gui/engine/index.ts` | Modify | Update export (same public API, different internals) |
| `repos/threads/src/actions/gui/destroyAllEngines.ts` | Modify | Remove `resetWasmCache` import and HMR call |
| `repos/threads/src/constants/tokenizer.ts` | Modify | Rename `GhosttyVTCellSize` → `VTCellSize`, `GhosttyVTConfigSize` → remove |
| `repos/threads/src/services/gui/tokenizer/decode.ts` | Modify | Update import to renamed constant |
| `repos/threads/src/services/gui/tokenizer/decode.test.ts` | Modify | Update import to renamed constant |
| `repos/threads/src/services/gui/tokenizer/runs.ts` | No change | Consumes `decodeCell()` — unaffected |
| `repos/threads/src/services/gui/tokenizer/constantDrift.test.ts` | Modify | Update test to use renamed constant, remove config size test |
| `repos/threads/src/services/gui/engine/sessionEngine.ts` | No change | Consumes `TBrowserVTerminal` interface — unaffected |
| `repos/threads/src/services/gui/engine/sessionEngine.test.ts` | No change | Mocks `createBrowserTerminal` — mock shape unchanged |
| `repos/threads/src/utils/terminal/estimateDimensions.ts` | No change | Pure math, terminal-agnostic |
| `repos/threads/src/utils/terminal/preloadFonts.ts` | No change | Font loading, terminal-agnostic |

| `repos/threads/src/actions/sessions/openSession.ts` | Modify | Add `disposeTerminal()` call on session close |

**Files that do NOT change:** All tokenizer files (`tokenizer.ts`, `palette.ts`, `borders.ts`, `blocks.ts`, `runs.ts`), all parser files, all AST types, all visitors, `sendInput.ts`, `estimateTerminalDimensions.ts`, `preloadFonts.ts`, `sessionEngine.ts`, `sessionEngine.test.ts`.

---

## Task 1: Install xterm.js packages and remove ghostty-web

**Files:**
- Modify: `repos/threads/package.json`

- [ ] **Step 1: Install xterm.js packages**

Run from `repos/threads/`:
```bash
pnpm add @xterm/xterm @xterm/addon-fit @xterm/headless
```

- [ ] **Step 2: Remove ghostty-web**

Run from `repos/threads/`:
```bash
pnpm remove ghostty-web
```

- [ ] **Step 3: Verify install**

Run from repo root:
```bash
pnpm install
```

Expected: Clean install, no peer dependency warnings for the new packages.

- [ ] **Step 4: Commit**

```
feat(threads): replace ghostty-web with xterm.js packages
```

---

## Task 2: Update ITheme imports (3 files)

These three files import `type { ITheme } from 'ghostty-web'`. xterm.js exports the same type name with the same shape (superset — has all the same fields plus extras like `extendedAnsi`, `scrollbarSliderBackground`).

**Files:**
- Modify: `repos/threads/src/types/terminal.types.ts:1`
- Modify: `repos/threads/src/constants/terminal.ts:1`
- Modify: `repos/threads/src/components/Terminal/TerminalThemeSettings.tsx:1`

- [ ] **Step 1: Update terminal.types.ts**

Change line 1:
```typescript
// Before:
import type { ITheme } from 'ghostty-web'
// After:
import type { ITheme } from '@xterm/xterm'
```

- [ ] **Step 2: Update constants/terminal.ts**

Change line 1:
```typescript
// Before:
import type { ITheme } from 'ghostty-web'
// After:
import type { ITheme } from '@xterm/xterm'
```

- [ ] **Step 3: Update TerminalThemeSettings.tsx**

Change line 1:
```typescript
// Before:
import type { ITheme } from 'ghostty-web'
// After:
import type { ITheme } from '@xterm/xterm'
```

- [ ] **Step 4: Run type check**

```bash
cd repos/threads && pnpm types
```

Expected: No type errors from ITheme changes. The ghostty-web `ITheme` fields (`foreground`, `background`, `cursor`, `cursorAccent`, `selectionBackground`, `selectionForeground`, `black`, `red`, ..., `brightWhite`) all exist on xterm.js's `ITheme`.

- [ ] **Step 5: Commit**

```
refactor(threads): update ITheme imports from ghostty-web to @xterm/xterm
```

---

## Task 3: Remove ghostty-web init() from app entrypoint

The app calls `init()` from `ghostty-web` at startup to pre-load the WASM module. xterm.js has no equivalent global init — it loads on first Terminal instantiation.

**Files:**
- Modify: `repos/threads/src/index.tsx:7,41`

- [ ] **Step 1: Remove the import and init call**

Remove line 7:
```typescript
import { init } from 'ghostty-web'
```

Remove line 41:
```typescript
init().catch(console.error)
```

- [ ] **Step 2: Run type check**

```bash
cd repos/threads && pnpm types
```

Expected: No errors.

- [ ] **Step 3: Commit**

```
refactor(threads): remove ghostty-web init() from app entrypoint
```

---

## Task 4: Rename tokenizer constants

Rename `GhosttyVTCellSize` to `VTCellSize` and remove `GhosttyVTConfigSize` (only used by the WASM bridge, which is being rewritten). Update all consumers.

**Files:**
- Modify: `repos/threads/src/constants/tokenizer.ts`
- Modify: `repos/threads/src/services/gui/tokenizer/decode.ts:2`
- Modify: `repos/threads/src/services/gui/tokenizer/decode.test.ts:2`
- Modify: `repos/threads/src/services/gui/tokenizer/constantDrift.test.ts`

- [ ] **Step 1: Update constants/tokenizer.ts**

```typescript
export const VTCellSize = 16

export const CellFlags = {
  BOLD: 0x01,
  ITALIC: 0x02,
  UNDERLINE: 0x04,
  STRIKETHROUGH: 0x08,
  INVERSE: 0x10,
  INVISIBLE: 0x20,
  BLINK: 0x40,
  FAINT: 0x80,
} as const
```

Remove `GhosttyVTConfigSize` — it was only used by the WASM bridge.

- [ ] **Step 2: Update decode.ts import**

```typescript
// Before:
import { CellFlags, GhosttyVTCellSize } from '@TTH/constants/tokenizer'
// After:
import { CellFlags, VTCellSize } from '@TTH/constants/tokenizer'
```

Then rename all uses in the file:
- `cellOffset`: `(row * cols + col) * VTCellSize`
- `buildTestViewport`: `cols * rows * VTCellSize`

- [ ] **Step 3: Update decode.test.ts import**

```typescript
// Before:
import { GhosttyVTCellSize, CellFlags } from '@TTH/constants/tokenizer'
// After:
import { VTCellSize, CellFlags } from '@TTH/constants/tokenizer'
```

Rename all uses of `GhosttyVTCellSize` to `VTCellSize` in the test file.

- [ ] **Step 4: Update constantDrift.test.ts**

This test asserts that the threads-local constants match the domain-exported constants. Update the import and test:

```typescript
import {
  VTCellSize as BrowserCellSize,
} from '@TTH/constants/tokenizer'
import {
  GhosttyVTCellSize as DomainCellSize,
} from '@tdsk/domain/constants/parser'

it(`VTCellSize matches domain`, () => {
  expect(BrowserCellSize).toBe(DomainCellSize)
})
```

Remove the `GhosttyVTConfigSize` test — that constant no longer exists.

- [ ] **Step 5: Search for any remaining references**

```bash
grep -rn "GhosttyVTCellSize\|GhosttyVTConfigSize" repos/threads/src/ --include="*.ts" --include="*.tsx"
```

Expected: No results.

- [ ] **Step 6: Run tests**

```bash
cd repos/threads && pnpm test
```

Expected: All existing tests pass (decode.test.ts, constantDrift.test.ts, palette.test.ts, sessionEngine.test.ts).

- [ ] **Step 7: Commit**

```
refactor(threads): rename GhosttyVTCellSize to VTCellSize, remove GhosttyVTConfigSize
```

---

## Task 5: Rewrite wasmBridge.ts with @xterm/headless adapter

Replace the ghostty WASM-based headless terminal with `@xterm/headless`. The adapter must produce a `DataView` in the existing 16-byte-per-cell binary format so the tokenizer pipeline is completely unaffected.

**Files:**
- Rewrite: `repos/threads/src/services/gui/engine/wasmBridge.ts`
- Modify: `repos/threads/src/services/gui/engine/index.ts`
- Modify: `repos/threads/src/actions/gui/destroyAllEngines.ts`

- [ ] **Step 1: Write the xterm.js headless adapter**

Rewrite `repos/threads/src/services/gui/engine/wasmBridge.ts`:

```typescript
import type { TBrowserVTerminal } from '@TTH/types'

import { Terminal } from '@xterm/headless'
import { VTCellSize, CellFlags } from '@TTH/constants/tokenizer'

const Ansi256Palette: Array<[number, number, number]> = buildAnsi256Palette()

function buildAnsi256Palette(): Array<[number, number, number]> {
  const palette: Array<[number, number, number]> = []

  // 0-7: standard colors
  const standard: Array<[number, number, number]> = [
    [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
    [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
  ]
  palette.push(...standard)

  // 8-15: bright colors
  const bright: Array<[number, number, number]> = [
    [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
    [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
  ]
  palette.push(...bright)

  // 16-231: 6x6x6 color cube
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        palette.push([
          r ? r * 40 + 55 : 0,
          g ? g * 40 + 55 : 0,
          b ? b * 40 + 55 : 0,
        ])
      }
    }
  }

  // 232-255: grayscale ramp
  for (let i = 0; i < 24; i++) {
    const v = i * 10 + 8
    palette.push([v, v, v])
  }

  return palette
}

function resolveColor(
  color: number,
  isRGB: boolean,
  isPalette: boolean,
  defaultR: number,
  defaultG: number,
  defaultB: number
): [number, number, number] {
  if (isRGB) {
    return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff]
  }
  if (isPalette) {
    return Ansi256Palette[color] ?? [defaultR, defaultG, defaultB]
  }
  return [defaultR, defaultG, defaultB]
}

export async function createBrowserTerminal(
  cols = 80,
  rows = 24
): Promise<TBrowserVTerminal> {
  const term = new Terminal({ cols, rows, scrollback: 0 })

  // @xterm/headless has no renderer, so onRender doesn't fire.
  // Track dirty state with a simple flag: any write() or resize()
  // marks all rows dirty. The SessionEngine calls process() on
  // RAF after writes, then markClean(), so this stays bounded.
  let _allDirty = false
  let _freed = false

  const terminal: TBrowserVTerminal = {
    get cols() { return term.cols },
    get rows() { return term.rows },

    write(data: string | Uint8Array) {
      if (_freed) throw new Error(`Terminal has been freed`)
      term.write(data)
      _allDirty = true
    },

    resize(newCols: number, newRows: number) {
      if (_freed) throw new Error(`Terminal has been freed`)
      term.resize(newCols, newRows)
      _allDirty = true
    },

    getDirtyRows(): number[] {
      if (_freed) throw new Error(`Terminal has been freed`)
      if (!_allDirty) return []
      const rows: number[] = []
      for (let r = 0; r < term.rows; r++) rows.push(r)
      return rows
    },

    getViewport(): DataView {
      if (_freed) throw new Error(`Terminal has been freed`)
      const c = term.cols
      const r = term.rows
      const totalBytes = c * r * VTCellSize
      const buffer = new ArrayBuffer(totalBytes)
      const view = new DataView(buffer)
      const buf = term.buffer.active
      const cell = buf.getNullCell()

      for (let row = 0; row < r; row++) {
        const line = buf.getLine(buf.baseY + row)
        if (!line) continue

        for (let col = 0; col < c; col++) {
          line.getCell(col, cell)
          const offset = (row * c + col) * VTCellSize

          const codepoint = cell.getCode()
          view.setUint32(offset, codepoint, true)

          const [fgR, fgG, fgB] = resolveColor(
            cell.getFgColor(), cell.isFgRGB(), cell.isFgPalette(),
            255, 255, 255
          )
          view.setUint8(offset + 4, fgR)
          view.setUint8(offset + 5, fgG)
          view.setUint8(offset + 6, fgB)

          const [bgR, bgG, bgB] = resolveColor(
            cell.getBgColor(), cell.isBgRGB(), cell.isBgPalette(),
            0, 0, 0
          )
          view.setUint8(offset + 7, bgR)
          view.setUint8(offset + 8, bgG)
          view.setUint8(offset + 9, bgB)

          let flags = 0
          if (cell.isBold()) flags |= CellFlags.BOLD
          if (cell.isItalic()) flags |= CellFlags.ITALIC
          if (cell.isUnderline()) flags |= CellFlags.UNDERLINE
          if (cell.isStrikethrough()) flags |= CellFlags.STRIKETHROUGH
          if (cell.isInverse()) flags |= CellFlags.INVERSE
          if (cell.isInvisible()) flags |= CellFlags.INVISIBLE
          if (cell.isBlink()) flags |= CellFlags.BLINK
          if (cell.isDim()) flags |= CellFlags.FAINT
          view.setUint8(offset + 10, flags)

          view.setUint8(offset + 11, cell.getWidth())

          // hyperlinkId: not exposed per-cell in xterm.js — always 0
          view.setUint16(offset + 12, 0, true)

          const chars = cell.getChars()
          view.setUint8(offset + 14, chars.length)

          // byte 15: reserved
        }
      }

      return view
    },

    getCursor() {
      if (_freed) throw new Error(`Terminal has been freed`)
      const buf = term.buffer.active
      return {
        x: buf.cursorX,
        y: buf.cursorY,
        visible: true,
      }
    },

    isAlternateScreen() {
      if (_freed) throw new Error(`Terminal has been freed`)
      return term.buffer.active.type === `alternate`
    },

    markClean() {
      if (_freed) throw new Error(`Terminal has been freed`)
      _allDirty = false
    },

    free() {
      if (_freed) return
      _freed = true
      term.dispose()
    },
  }

  return terminal
}
```

- [ ] **Step 2: Update engine/index.ts export**

The export stays the same — `createBrowserTerminal` is still the public API:

```typescript
export { createBrowserTerminal } from './wasmBridge'
export { SessionEngine } from './sessionEngine'
```

No change needed.

- [ ] **Step 3: Update destroyAllEngines.ts**

Remove the `resetWasmCache` import and HMR call (there's no WASM cache to reset):

```typescript
import {
  setGuiAsts,
  setGuiFeeds,
  setGuiModes,
  getGuiEngines,
  setGuiEngines,
} from '@TTH/state/accessors'

export const destroyAllEngines = () => {
  const engines = getGuiEngines()
  for (const engine of engines.values()) {
    try {
      engine.destroy()
    } catch {
      /* already destroyed */
    }
  }
  setGuiEngines(new Map())
  setGuiAsts(new Map())
  setGuiFeeds(new Map())
  setGuiModes(new Map())
}
```

- [ ] **Step 4: Run type check**

```bash
cd repos/threads && pnpm types
```

Expected: No errors. The `TBrowserVTerminal` interface is unchanged, so `sessionEngine.ts` compiles without modification.

- [ ] **Step 5: Run existing tests**

```bash
cd repos/threads && pnpm test
```

Expected: `sessionEngine.test.ts` passes — it mocks `createBrowserTerminal` and doesn't depend on internals. `decode.test.ts` and `constantDrift.test.ts` pass — they don't touch the bridge.

- [ ] **Step 6: Commit**

```
feat(threads): rewrite wasmBridge with @xterm/headless adapter
```

---

## Task 6: Rewrite TerminalView.tsx with xterm.js

Replace ghostty-web's `Terminal` + `FitAddon` with xterm.js equivalents. Key architectural changes:

1. **No monkey-patching** — xterm.js manages its own render loop correctly.
2. **No raw buffer replay** — terminals stay alive when hidden, preserving full state.
3. **No SIGWINCH toggle** — no color fix needed since terminals aren't destroyed.
4. **ResizeObserver replaces `observeResize()`** — xterm.js FitAddon doesn't have it.
5. **Theme changes apply in place** — no need to recreate the terminal.

**Files:**
- Rewrite: `repos/threads/src/components/Terminal/TerminalView.tsx`

- [ ] **Step 1: Write the new TerminalView**

```typescript
import { Box } from '@mui/material'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalSettings } from '@TTH/state/selectors'
import { useRef, useEffect, useCallback } from 'react'
import {
  sendInput,
  sendControl,
  getRawBuffer,
  subscribeTerminalData,
} from '@TTH/actions/sessions'

const terminals = new Map<string, { term: Terminal; fitAddon: FitAddon }>()

export type TTerminalView = {
  active: boolean
  sessionId: string
}

export const TerminalView = (props: TTerminalView) => {
  const { sessionId, active } = props
  const [settings] = useTerminalSettings()
  const containerRef = useRef<HTMLDivElement>(null)

  const onData = useCallback((data: string) => sendInput(sessionId, data), [sessionId])

  const onResize = useCallback(
    (dims: { cols: number; rows: number }) => {
      sendControl(sessionId, { type: `resize`, cols: dims.cols, rows: dims.rows })
    },
    [sessionId]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let entry = terminals.get(sessionId)

    if (!entry) {
      const term = new Terminal({
        theme: settings.theme,
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        scrollback: settings.scrollback,
        cursorBlink: settings.cursorBlink,
        cursorStyle: settings.cursorStyle,
        allowTransparency: settings.allowTransparency,
        smoothScrollDuration: settings.smoothScrollDuration,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(container)

      const buffer = getRawBuffer(sessionId).slice()
      for (const chunk of buffer) {
        term.write(chunk)
      }

      entry = { term, fitAddon }
      terminals.set(sessionId, entry)
    } else {
      container.replaceChildren()
      container.appendChild(entry.term.element!)
    }

    const { term, fitAddon } = entry

    const dataDisposable = term.onData(onData)
    const resizeDisposable = term.onResize(onResize)

    const unsubscribe = subscribeTerminalData(sessionId, (data: string) => {
      term.write(data)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
    })
    resizeObserver.observe(container)

    fitAddon.fit()

    return () => {
      dataDisposable.dispose()
      resizeDisposable.dispose()
      unsubscribe()
      resizeObserver.disconnect()
    }
  }, [sessionId, onData, onResize])

  useEffect(() => {
    const entry = terminals.get(sessionId)
    if (!entry) return

    const { term } = entry

    term.options.fontSize = settings.fontSize
    term.options.fontFamily = settings.fontFamily
    term.options.cursorStyle = settings.cursorStyle
    term.options.cursorBlink = settings.cursorBlink
    term.options.smoothScrollDuration = settings.smoothScrollDuration
    term.options.theme = { ...settings.theme }

    entry.fitAddon.fit()
  }, [
    sessionId,
    settings.fontSize,
    settings.fontFamily,
    settings.cursorStyle,
    settings.cursorBlink,
    settings.smoothScrollDuration,
    settings.theme,
  ])

  useEffect(() => {
    if (!active) return
    const entry = terminals.get(sessionId)
    if (!entry) return
    entry.fitAddon.fit()
  }, [active, sessionId])

  return (
    <Box
      ref={containerRef}
      sx={{
        width: `100%`,
        height: `100%`,
        display: active ? `block` : `none`,
        '& .xterm': {
          height: `100%`,
        },
      }}
    />
  )
}

export function disposeTerminal(sessionId: string) {
  const entry = terminals.get(sessionId)
  if (!entry) return
  entry.fitAddon.dispose()
  entry.term.dispose()
  terminals.delete(sessionId)
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const entry of terminals.values()) {
      entry.fitAddon.dispose()
      entry.term.dispose()
    }
    terminals.clear()
  })
}
```

Key design decisions:
- **`terminals` module-level Map** — keeps Terminal instances alive across tab switches. Created once per session, reused on re-mount.
- **No `themeKey` recreation** — xterm.js applies `term.options.theme = { ...newTheme }` without destroying the terminal. The settings effect handles this.
- **`disposeTerminal()` export** — called by session close logic to clean up when a session ends (wired in Task 7).
- **`container.appendChild(entry.term.element!)`** — re-parents the existing terminal DOM into the new container on re-mount.
- **`ResizeObserver`** — replaces ghostty-web's `fitAddon.observeResize()`.

- [ ] **Step 2: Run type check**

```bash
cd repos/threads && pnpm types
```

Expected: No errors. The component's props and exports are unchanged.

- [ ] **Step 3: Commit**

```
feat(threads): rewrite TerminalView with xterm.js keep-alive terminals
```

---

## Task 7: Wire terminal disposal into session cleanup

When a WebSocket session closes, the terminal should be disposed. The `openSession.ts` `ws.onclose` handler already cleans up session state — add a call to `disposeTerminal()` there.

**Files:**
- Modify: `repos/threads/src/actions/sessions/openSession.ts`

- [ ] **Step 1: Import and call disposeTerminal**

Add import at top of `openSession.ts`:

```typescript
import { disposeTerminal } from '@TTH/components/Terminal/TerminalView'
```

In the `ws.onclose` handler, after `removeOpenSession(sessionId)`, add:

```typescript
disposeTerminal(sessionId)
```

The relevant section (around line 249) becomes:

```typescript
const session = getOpenSessions().get(sessionId)
if (session) {
  removeOpenSession(sessionId)
  removeStoredSession(sandboxId, sessionId)
  disposeTerminal(sessionId)
}
```

- [ ] **Step 2: Run type check**

```bash
cd repos/threads && pnpm types
```

Expected: No errors.

- [ ] **Step 3: Commit**

```
feat(threads): dispose xterm terminal on session close
```

---

## Task 8: Remove the themeKey useMemo from stale references

The old `TerminalView` had a `themeKey` useMemo that triggered terminal recreation on theme change. The new implementation doesn't use it. Verify no other file references `themeKey` or the old ghost-web-specific pattern.

**Files:**
- None (verification only)

- [ ] **Step 1: Grep for stale ghostty-web references**

```bash
grep -rn "ghostty-web\|ghostty_\|startRenderLoop\|animationFrameId\|wasmTerm\|scrollbarOpacity\|themeKey" repos/threads/src/ --include="*.ts" --include="*.tsx"
```

Expected: Only hits in `wasmBridge.ts` should be gone. If any remain, fix them.

- [ ] **Step 2: Grep for old GhosttyVT references**

```bash
grep -rn "GhosttyVT\|ghosttyWasmUrl\|ghostty-vt\.wasm\|resetWasmCache" repos/threads/src/ --include="*.ts" --include="*.tsx"
```

Expected: Zero results. All WASM references should be gone.

- [ ] **Step 3: Verify no ghostty-web in node_modules**

```bash
ls repos/threads/node_modules/ghostty-web 2>/dev/null && echo "STILL PRESENT" || echo "REMOVED"
```

Expected: `REMOVED`.

---

## Task 9: Full type check and test suite

**Files:**
- None (validation only)

- [ ] **Step 1: Run full type check**

```bash
cd repos/threads && pnpm types
```

Expected: Zero errors across all source files.

- [ ] **Step 2: Run unit tests**

```bash
cd repos/threads && pnpm test
```

Expected: All tests pass. Key test files to watch:
- `sessionEngine.test.ts` — mocks `createBrowserTerminal`, should pass unchanged
- `decode.test.ts` — tests DataView decoding, should pass with renamed constant
- `constantDrift.test.ts` — verifies cell size matches domain, should pass with renamed constant
- `palette.test.ts` — tests color palette detection from DataView, unaffected

- [ ] **Step 3: Commit**

```
chore(threads): verify types and tests pass after xterm.js migration
```

---

## Task 10: Manual UI validation

Start the threads dev server and validate the terminal works in the browser.

- [ ] **Step 1: Start the dev server**

```bash
cd repos/threads && pnpm start
```

Expected: Vite dev server starts on port 5886.

- [ ] **Step 2: Test terminal rendering**

Navigate to a sandbox session in the browser. Verify:
- Terminal renders with correct colors (theme applied)
- Text input works (keystrokes sent to backend)
- Terminal resizes correctly when window is resized
- Scrollback works (scroll up to see history)
- Cursor blinks (if `cursorBlink: true`)

- [ ] **Step 3: Test tab switching (keep-alive)**

Open two sessions. Switch between tabs. Verify:
- Terminal content is preserved (no garbled text, no color loss)
- No visible flicker or re-render delay
- Cursor position is preserved
- Both sessions remain responsive

- [ ] **Step 4: Test theme changes**

Open terminal settings and change the theme preset. Verify:
- Colors update immediately without terminal recreation
- Custom color picker works
- Switching presets works

- [ ] **Step 5: Test terminal settings**

Change font size, font family, cursor style. Verify:
- Changes apply immediately
- Terminal re-fits correctly after font size change

- [ ] **Step 6: Test GUI view (AST engine)**

If the sandbox supports GUI view, switch to it. Verify:
- GUI engine receives terminal data and renders AST
- Activity feed shows events
- No console errors from the headless adapter

- [ ] **Step 7: Test session lifecycle**

Close a session. Verify:
- Terminal is disposed (no memory leak)
- Opening a new session creates a fresh terminal
- Recreate/restart sandbox commands work
