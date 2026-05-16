# xterm.js Migration: Investigation Findings

## 1. API Surface Mapping: ghostty-web → xterm.js

### TerminalView.tsx — Interactive Terminal

| ghostty-web API | xterm.js Equivalent | Notes |
|---|---|---|
| `new Terminal({ cols, rows, theme, fontSize, fontFamily, scrollback, cursorBlink, cursorStyle, allowTransparency, smoothScrollDuration })` | `new Terminal({ cols, rows, theme, fontSize, fontFamily, scrollback, cursorBlink, cursorStyle, allowTransparency })` | 1:1 except `smoothScrollDuration` (xterm has `smoothScrollDuration` via `fastScrollSensitivity` or custom handling) |
| `new FitAddon()` | `new FitAddon()` from `@xterm/addon-fit` | Same concept |
| `term.loadAddon(fitAddon)` | `terminal.loadAddon(fitAddon)` | Identical |
| `fitAddon.observeResize()` | **No equivalent** — use `new ResizeObserver(() => fitAddon.fit())` | Minor: ~3 lines of DIY code |
| `fitAddon.fit()` | `fitAddon.fit()` | Identical |
| `term.open(container)` | `terminal.open(container)` | Identical |
| `term.write(chunk)` | `terminal.write(chunk)` | Identical — accepts `string \| Uint8Array` |
| `term.onData(cb)` | `terminal.onData(cb)` | Identical — returns `IDisposable` |
| `term.onResize(cb)` | `terminal.onResize(cb)` | Identical — `{cols, rows}` payload |
| `term.onScroll(cb)` | `terminal.onScroll(cb)` | Identical |
| `term.onSelectionChange(cb)` | `terminal.onSelectionChange(cb)` | Identical |
| `term.options.fontSize = x` | `terminal.options.fontSize = x` | Identical |
| `term.dispose()` | `terminal.dispose()` | Identical |
| `ITheme` type | `ITheme` from `@xterm/xterm` | Same structure (foreground, background, cursor, selection, ansi palette) |

**Monkey-patched internals that GO AWAY entirely:**

| ghostty-web Hack | xterm.js | Why it's gone |
|---|---|---|
| `termAny.startRenderLoop = () => {}` | Not needed | xterm.js manages rendering correctly; no partial-redraw bugs |
| `cancelAnimationFrame(termAny.animationFrameId)` | Not needed | No rogue RAF loop to kill |
| `termAny.renderer.render(wasmTerm, full, viewportY, term, scrollbarOpacity)` | Not needed | xterm.js handles its own render lifecycle |
| `scheduleRender()` / RAF batching | Not needed | xterm.js renders on `write()` automatically |
| SIGWINCH toggle (`rows+1` then `rows`) | Likely still needed for color fix during buffer replay, OR eliminated entirely by using SerializeAddon | See Section 2 |

**Verdict: TerminalView.tsx is effectively a 1:1 swap.** The xterm.js version would be ~80 lines shorter because all the monkey-patching and manual render loop code is deleted.

### smoothScrollDuration

ghostty-web has `smoothScrollDuration` as a constructor option. xterm.js has `smoothScrollDuration` as well (introduced in v5). If it's not in the current version, the alternative is `fastScrollSensitivity` for scroll speed, but smooth scrolling on mouse wheel is supported. Check the specific xterm.js version you install.

---

## 2. SerializeAddon vs Raw Buffer Replay

### Current approach (fragile)

```
Tab switch away:
  → Terminal destroyed (ghostty-web WASM terminal freed)
  → Raw buffer kept (string[] of decoded PTY chunks)

Tab switch back:
  → New Terminal created at PTY dims (sessionDims map)
  → Buffer replayed chunk-by-chunk via write()
  → fitAddon.fit() resizes to container
  → SIGWINCH toggle forces remote repaint for correct colors
```

**Problems this solves with workarounds:**
1. Garbled text — replay at PTY dims, fit after
2. Wrong colors — SIGWINCH toggle forces remote repaint (~1s delay)
3. Render loop corruption — monkey-patched demand-driven rendering

### xterm.js SerializeAddon approach

```
Tab switch away:
  → serializeAddon.serialize() → VT escape sequence string
  → Terminal kept alive OR disposed (serialize captures everything)

Tab switch back:
  → New Terminal created
  → terminal.write(serializedState) — reconstructs EXACTLY, colors included
  → fitAddon.fit()
  → No SIGWINCH toggle needed — colors are correct from serialize data
```

**What SerializeAddon captures:**
- All text content with scrollback
- All SGR attributes (colors, bold, italic, underline, etc.)
- Cursor position and visibility
- Terminal modes (DECSET/DECRST state)
- 16-color, 256-color, and 24-bit RGB colors

**Key advantage: serialized state is self-contained.** It doesn't depend on having the original escape-sequence context that preceded the buffer window — it captures the _result_ of those escape sequences as concrete cell attributes. This eliminates the root cause of both the color bug and the dimension mismatch bug.

**Even better option: keep the Terminal alive.** xterm.js terminals can be detached from the DOM (`terminal.element` becomes `undefined`) and reattached without destroying state. Instead of serialize/deserialize:

```
Tab switch away:
  → Remove terminal's DOM element from container (or `display:none`)
  → Terminal stays alive in memory with full buffer state

Tab switch back:
  → Re-append terminal's DOM element (or `display:block`)
  → fitAddon.fit() — terminal redraws from its own live buffer
  → No replay, no serialize, no SIGWINCH — instant switch
```

This is what VS Code's integrated terminal does. The current code already uses `display: none/block` for the container, but ghostty-web's WASM terminal gets destroyed on the `useEffect` cleanup. With xterm.js, the terminal can simply persist.

**Recommendation:** Use the "keep alive" approach as primary, with SerializeAddon as a fallback for memory pressure (serializing and disposing idle terminals after a timeout).

---

## 3. GUI Engine wasmBridge.ts — The Hard Part

### What wasmBridge does today

Creates a **headless** ghostty-web WASM terminal that:
1. Receives raw PTY bytes via `write(data)`
2. Exposes a 16-byte-per-cell binary grid via `getViewport()` → `DataView`
3. Reports dirty rows via `getDirtyRows()`
4. Reports cursor state via `getCursor()`
5. Reports alternate screen state via `isAlternateScreen()`
6. Supports `markClean()` to clear dirty flags after processing

The tokenizer reads this grid cell-by-cell using `decodeCell()` which extracts:
- `codepoint` (u32) — Unicode character
- `fg` (3 × u8) — RGB foreground
- `bg` (3 × u8) — RGB background
- `flags` (u8) — bold, italic, underline, strikethrough, inverse, invisible, blink, faint
- `width` (u8) — cell width (1 or 2 for wide chars)
- `hyperlinkId` (u16) — hyperlink reference
- `graphemeLen` (u8) — grapheme cluster length

### Can xterm.js headless provide this?

**Yes, with an adapter layer.** `@xterm/headless` provides:

| ghostty-web (wasmBridge) | xterm.js headless | Match? |
|---|---|---|
| `write(data)` | `terminal.write(data)` | Exact |
| `resize(cols, rows)` | `terminal.resize(cols, rows)` | Exact |
| `getViewport()` → DataView (16 bytes/cell) | `buffer.active.getLine(y).getCell(x, cell)` → IBufferCell API | **Different format** — see below |
| `getDirtyRows()` | **No equivalent** | Must track manually or diff |
| `getCursor()` | `buffer.active.cursorX/Y` + no direct `visible` | Partial — visible needs `terminal.modes` |
| `isAlternateScreen()` | `buffer.active.type === 'alternate'` | Exact |
| `markClean()` | **No equivalent** | Dirty tracking must be custom |

### The format mismatch

ghostty-web gives a flat `DataView` of `cols × rows × 16` bytes — the tokenizer reads it with `view.getUint32(offset, true)` etc. This is a zero-copy read from WASM linear memory. Very fast.

xterm.js gives a per-cell object API:
```typescript
const cell = buffer.getNullCell()
line.getCell(x, cell)
cell.getCode()        // codepoint
cell.getFgColor()     // color number (RGB if isFgRGB())
cell.isFgRGB()        // color mode check
cell.isBold()         // flag check
// ... etc
```

**To keep the existing tokenizer unchanged**, you'd write an adapter that:
1. Creates an `@xterm/headless` Terminal
2. On `getViewport()`, iterates `rows × cols` cells and packs them into a 16-byte-per-cell DataView matching the ghostty layout
3. Maps xterm.js color modes to raw RGB bytes:
   - `isFgRGB()` → extract R/G/B from 24-bit int
   - `isFgPalette()` → look up RGB from 256-color palette table
   - `isFgDefault()` → use theme default color
4. Maps xterm.js flags to the `CellFlags` bitmask

### Performance concern

ghostty-web: `getViewport()` is a single WASM call that copies a contiguous buffer. O(1) setup + memcpy.

xterm.js adapter: Would iterate `cols × rows` cells (e.g., 200×50 = 10,000 cells), calling ~8 methods per cell. That's ~80,000 method calls per viewport read. At 60fps tokenization this matters.

**Mitigation:** The GUI engine already uses dirty-row tracking to avoid full viewport reads on every frame. With xterm.js, you'd:
- Use `terminal.onRender(({start, end}) => ...)` to know which rows changed
- Only re-pack dirty rows into the DataView
- Cache clean rows from previous frame

This should make the performance acceptable, though it adds complexity.

### Dirty row tracking

ghostty-web exposes `getDirtyRows()` and `markClean()` natively. xterm.js has `onRender({start, end})` which fires after writes with the row range that was affected. You'd track dirty rows by accumulating these ranges and clearing them after tokenization.

### Missing: hyperlinkId and graphemeLen

xterm.js's `IBufferCell` does not expose `hyperlinkId` or `graphemeLen` directly:
- **hyperlinkId**: xterm.js handles hyperlinks via `registerLinkProvider()` — a different paradigm. The tokenizer uses `hyperlinkId` to tag cells as hyperlinked. You'd need to either:
  - Use xterm.js's link detection API and map links back to cell ranges
  - Always set `hyperlinkId = 0` in the adapter (losing hyperlink detection in the GUI view)
- **graphemeLen**: Not directly exposed. `cell.getChars()` returns the full grapheme string, so `graphemeLen` could be derived from `cell.getChars().length` or byte length.

### Verdict: wasmBridge migration is feasible but non-trivial

The adapter layer adds ~100–150 lines. The main risks are:
1. Performance of per-cell iteration vs WASM memcpy (mitigated by dirty-row tracking)
2. Color mode translation (palette → RGB lookup table needed)
3. Loss of `hyperlinkId` (probably acceptable — hyperlinks in the GUI view aren't critical)
4. Behavioral differences in edge cases (wide chars, grapheme clusters, alternate screen transitions)

---

## 4. Migration Scope

### Files that change

| File | Change Type | Effort |
|---|---|---|
| `package.json` | Remove `ghostty-web`, add `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-serialize`, `@xterm/addon-webgl`, `@xterm/headless` | Trivial |
| `src/index.tsx` | Remove `import { init } from 'ghostty-web'` and `init()` call | Trivial |
| `src/components/Terminal/TerminalView.tsx` | **Rewrite** — swap to xterm.js Terminal + FitAddon + SerializeAddon. Delete all monkey-patching. Add ResizeObserver for fit. | Medium — but net simpler |
| `src/types/terminal.types.ts` | Change `import type { ITheme } from 'ghostty-web'` → `import type { ITheme } from '@xterm/xterm'` | Trivial |
| `src/constants/terminal.ts` | Same `ITheme` import change | Trivial |
| `src/components/Terminal/TerminalThemeSettings.tsx` | Same `ITheme` import change | Trivial |
| `src/services/gui/engine/wasmBridge.ts` | **Rewrite** — replace ghostty WASM with `@xterm/headless` + adapter that packs cells into DataView | High — most complex change |
| `src/constants/tokenizer.ts` | Keep `GhosttyVTCellSize = 16` and `CellFlags` — the adapter will produce data in this format | None (adapter conforms to existing format) |
| `src/services/gui/tokenizer/decode.ts` | **No change** — adapter produces compatible DataView | None |
| `src/services/gui/tokenizer/*.ts` | **No change** — they consume DataView via `decodeCell()` | None |
| `src/actions/sessions/openSession.ts` | **No change** — raw buffer management is session-layer, not terminal-layer | None |
| `src/utils/terminal/estimateDimensions.ts` | **No change** — still useful for initial PTY size estimation | None |
| `src/utils/terminal/preloadFonts.ts` | **No change** — font preloading is terminal-agnostic | None |
| `src/constants/values.ts` | **No change** | None |
| CSS/styles | Add `@xterm/xterm/css/xterm.css` import | Trivial |

### What breaks

1. **ghostty-web `init()` at startup** — xterm.js has no equivalent global init. Just remove it.
2. **WASM asset loading** — `ghostty-web/ghostty-vt.wasm?url` goes away. xterm.js headless is pure JS (no WASM).
3. **`ITheme` type** — Same shape but different import path. Quick find-replace.
4. **wasmBridge WASM interop** — Entire WASM memory management (alloc/free/pointers) is replaced by JS object API.

### What gets simpler

1. **TerminalView.tsx** — Drops from 230 lines to ~120. No monkey-patching, no manual render loop, no SIGWINCH toggle.
2. **Tab switching** — With keep-alive terminals: zero replay, zero color bugs, instant switch.
3. **Theme changes** — xterm.js applies theme changes to existing terminals (`terminal.options.theme = newTheme`). No need to destroy and recreate.
4. **No WASM init** — Faster cold start (no WASM fetch/compile step for the interactive terminal). The headless terminal in the GUI engine is also pure JS.
5. **WebGL addon** — Optional GPU acceleration, drop-in.
6. **Ecosystem** — VS Code's terminal, millions of weekly downloads, extensive addon ecosystem.

### What gets harder

1. **wasmBridge adapter** — Translating xterm.js cell API to the 16-byte DataView format. ~100–150 lines of adapter code.
2. **Dirty row tracking** — Must be built from `onRender` events instead of native `getDirtyRows()`.
3. **Performance validation** — Need to benchmark the adapter's per-cell iteration vs ghostty's WASM memcpy.
4. **Color palette resolution** — xterm.js reports palette indices, not raw RGB. Need a 256-color lookup table.
5. **hyperlinkId** — Not directly available per-cell. Must decide whether to drop or implement alternative.

---

## 5. Recommendation

**Migrate to xterm.js.** The benefits clearly outweigh the costs:

### Why migrate

1. **Eliminates all three fragile workarounds** in TerminalView.tsx (render loop patches, SIGWINCH toggle, replay-at-PTY-dims ordering)
2. **Tab switching becomes trivial** — keep terminals alive, no replay needed, no color bugs
3. **Theme changes don't require terminal recreation** — xterm.js updates themes in place
4. **Stable public API** — no monkey-patching of private properties that could break on any update
5. **Massive ecosystem** — VS Code's terminal, well-documented, active maintenance, addons for WebGL/serialize/fit/search/unicode
6. **No WASM dependency for interactive terminal** — faster cold start, simpler build pipeline
7. **Net code reduction** — TerminalView shrinks by ~110 lines despite adding ResizeObserver

### Why the wasmBridge cost is acceptable

- The tokenizer/parser/AST pipeline (~2000+ lines) doesn't change at all
- The adapter is a well-defined boundary: produce a DataView in the existing 16-byte format
- Dirty-row tracking via `onRender` is actually more efficient than polling `getDirtyRows()`
- Loss of `hyperlinkId` is acceptable (GUI view doesn't rely on it heavily)
- Performance can be validated with a benchmark before committing to the migration

### Rough migration plan

**Phase 1: TerminalView.tsx swap (low risk, high reward)**
- Install `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-serialize`
- Rewrite TerminalView with xterm.js — keep-alive terminals, no monkey-patching
- Update ITheme imports across 3 files
- Remove `init()` from index.tsx
- Test: tab switching, theme changes, resize, input, scrollback
- **This phase alone eliminates all the rendering bugs**

**Phase 2: wasmBridge adapter (medium risk, medium reward)**
- Install `@xterm/headless`
- Write `XtermAdapter` that implements `TBrowserVTerminal` using `@xterm/headless`
- Build 256-color palette lookup table
- Implement dirty-row tracking via `onRender`
- Benchmark: compare viewport read performance vs ghostty WASM
- Test: GUI engine produces identical AST output

**Phase 3: Cleanup**
- Remove `ghostty-web` from package.json
- Delete WASM-related code (wasmBridge.ts singleton, backoff logic)
- Optionally add `@xterm/addon-webgl` for GPU rendering
- Update `GhosttyVTCellSize` / `GhosttyVTConfigSize` constant names (cosmetic)

**Phases 1 and 2 are independent** — Phase 1 can ship alone. The GUI engine can continue using ghostty-web's WASM for parsing while the interactive terminal uses xterm.js. This gives a safe incremental migration path.
