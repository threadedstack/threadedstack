# Terminal Rendering Bug — Continuation Prompt

## The Bug

When sandbox shell sessions render in the threads SPA, the terminal output appears garbled/overlapping — text from the terminal is rendered on top of itself. This happens:
- When switching between multiple session tabs to the same sandbox
- Sometimes even on a brand new session to a new sandbox

**Key user observation**: Resizing the browser window fixes the garbled rendering every time. This proves the WASM terminal state is correct — only the canvas rendering is wrong. A resize triggers `Terminal.resize()` → `CanvasRenderer.render(wasmTerm, true, ...)` (full redraw), which repaints the entire canvas correctly from the WASM state.

## Root Cause (Proven)

**ghostty-web v0.4.0 has a dirty-row rendering bug.** The render loop (`startRenderLoop()`) does partial redraws — only repainting rows where `wasmTerm.isRowDirty(row)` is true — then calls `wasmTerm.clearDirty()`. When content is written to the WASM terminal at one grid size (e.g., default 80×24) and then `fitAddon.fit()` resizes to the container dimensions, the dirty flags have already been cleared by the render loop's tick. The resize triggers a full redraw, but the content was written at the wrong dimensions, causing garbled reflow artifacts.

**The fix direction**: Ensure all buffer content is written at the **final** grid dimensions (after `fit()`), so the render loop's partial redraw paints correct content. Alternatively, force a full canvas repaint after content is written.

## What's Been Tried

### Approach 1: Dimension toggle after fit() — FIXED overlap but caused FLICKER
```js
const rafId = requestAnimationFrame(() => {
  fitAddon.fit()
  const cols = term.cols
  term.resize(cols + 1, term.rows)  // force resize
  term.resize(cols, term.rows)      // restore
})
```
- The two `resize()` calls send resize control messages to the backend, causing the remote PTY to reflow twice → visible content flicker.

### Approach 2: canvas.width = 0 invalidation — BROKE EVERYTHING
```js
const canvas = container.querySelector('canvas')
canvas.width = 0  // destroys canvas bitmap
```
- Setting `canvas.width` clears the bitmap entirely. The renderer can't recover.

### Approach 3: Defer buffer replay into rAF after fit() — IMPROVED but NOT FIXED (current state)
```js
const rafId = requestAnimationFrame(() => {
  fitAddon.fit()
  const buffer = getRawBuffer(sessionId).slice()
  for (const chunk of buffer) { term.write(chunk) }
  unsubscribe = subscribeTerminalData(sessionId, (data) => { if (alive) term.write(data) })
})
```
- Content is now written at correct dimensions (after fit).
- The render loop's next tick does a partial redraw of the newly-dirty rows.
- Issue persists — the partial redraw still produces garbled output in some cases.
- This is the **current code** in `TerminalView.tsx`.

## Current State of Modified Files

### `repos/threads/src/components/Terminal/TerminalView.tsx`
- Buffer replay + subscription deferred into `requestAnimationFrame` callback, after `fitAddon.fit()`
- `alive` guard prevents writes after effect cleanup
- `unsubscribe` is `(() => void) | undefined` since it's set inside the rAF

### `repos/threads/src/actions/sessions/openSession.ts`
- `setupSession` migration now cleans up `terminalWriters` and `engineWriters` for old tempKey (lines 124-125)
- Diagnostic `console.warn` if a session has >1 terminal writer (lines 216-218)
- Both changes are defensive and should be kept

## Approaches NOT Yet Tried

### A. Double-rAF with non-resizing full redraw
ghostty-web's `CanvasRenderer.render()` has this check (line 1401 in the minified source):
```js
(this.canvas.width !== D.cols * this.metrics.width * this.devicePixelRatio ||
 this.canvas.height !== D.rows * this.metrics.height * this.devicePixelRatio) &&
 (this.resize(D.cols, D.rows), B = !0)
```
If the canvas pixel dimensions don't match what the renderer expects, it forces `B = true` (full redraw). We could manipulate `canvas.width` by ±1 pixel (NOT to zero) after the buffer replay, then let the render loop's next tick detect the mismatch and do a full redraw. The 1px corruption happens in a rAF before the browser paints, so it's invisible.

### B. Suppress onResize during dimension toggle
The flicker in Approach 1 was caused by `term.onResize` firing the `handleResize` callback, which sent resize messages to the backend. If we temporarily disconnect `onResize` before the toggle and reconnect after, no backend resize messages are sent.

### C. Write a reset sequence after buffer replay
Send `\x1b[?5h\x1b[?5l` (reverse video on/off) or similar ANSI sequence that forces ghostty-web's WASM terminal to mark all rows dirty without changing visible content. The render loop would then repaint all rows on its next tick.

### D. Abandon ghostty-web's render loop for initial paint
Call `term.write()` with the buffer, then directly invoke the renderer for a full redraw. The renderer is at `term.renderer` (private but accessible). `term.renderer.render(term.wasmTerm, true, viewportY, term)` would force a full repaint. This is fragile (depends on private API of a minified library) but guaranteed to work.

### E. Use `term.reset()` before buffer replay
ghostty-web has `term.reset()` which frees and recreates the WASM terminal. After reset, replay the buffer. The reset might clear dirty state and force the renderer to do a full redraw on next tick.

## ghostty-web Internals Reference (v0.4.0)

Key line numbers in `node_modules/.pnpm/ghostty-web@0.4.0/node_modules/ghostty-web/dist/ghostty-web.js`:

| Line | What |
|------|------|
| 2101 | `Terminal` constructor — creates emitters, sets defaults |
| 2196 | `this.ghostty = A.ghostty ?? CA()` — shared WASM module (singleton `R`) |
| 2323 | `open(container)` — creates canvas, renderer, starts render loop, initial full redraw |
| 2332 | Canvas/textarea creation, renderer instantiation |
| 2373 | Initial render call + `startRenderLoop()` + `focus()` |
| 2422 | `resize(cols, rows)` — early return if same dims, otherwise WASM reflow + renderer.resize + `renderer.render(wasmTerm, true, ...)` |
| 2625 | `dispose()` — cancels rAF, frees addons, calls `cleanupComponents()` |
| 2639 | `startRenderLoop()` — `A()` called immediately (sync), then `requestAnimationFrame(A)` |
| 2642 | Render loop body: `renderer.render(wasmTerm, false, ...)` — partial redraw |
| 2667 | `cleanupComponents()` — frees WASM, removes canvas/textarea, removes event listeners |
| 1335 | `CanvasRenderer` class — owns canvas 2d context |
| 1389 | `CanvasRenderer.resize()` — sets canvas bitmap + CSS dimensions, fills with background |
| 1398 | `CanvasRenderer.render(wasmTerm, fullRedraw, viewportY, scrollbackProvider, scrollbarOpacity)` |
| 1401 | Canvas dimension mismatch check → forces full redraw |
| 1479 | End of render: `A.clearDirty()` |
| 2838 | `FitAddon` class |
| 2837 | `EA = 100` — ResizeObserver debounce ms; `_isResizing` stays true for 50ms after fit |
| 2860 | `fit()` — guards: `_isResizing`, same-dimension check, `proposeDimensions()` |
| 2917 | `observeResize()` — ResizeObserver with debounced `fit()` |
| 2926 | `R = null` (singleton WASM instance), `init()`, `getGhostty()` |

### Render loop execution order per frame:
1. `startRenderLoop()` calls `A()` synchronously inside `open()` (first tick, nothing dirty)
2. `A()` schedules next tick via `requestAnimationFrame(A)`
3. Our code runs synchronously (buffer replay, rAF scheduling)
4. Next animation frame: render loop rAF fires first (registered first), then our rAF
5. Browser paints after all rAF callbacks complete

### FitAddon.fit() flow:
1. Guard: `_isResizing` → return
2. `proposeDimensions()` → measures container, calculates cols/rows from font metrics
3. Guard: if proposed matches `_lastCols/_lastRows` OR matches current `term.cols/term.rows` → return
4. Sets `_isResizing = true`, calls `term.resize(proposed.cols, proposed.rows)` 
5. `setTimeout(() => _isResizing = false, 50)`

### Terminal.resize() flow:
1. Guard: if cols/rows match current → return (no-op)
2. WASM reflow: `wasmTerm.resize(cols, rows)` 
3. Renderer resize: `renderer.resize(cols, rows)` — resets canvas bitmap
4. Canvas CSS resize
5. Fire resize emitter (triggers `onResize` callbacks → sends resize to backend)
6. **Full redraw**: `renderer.render(wasmTerm, true, viewportY, this)`

## Architecture Reference (unchanged)

**Backend**: Each WebSocket connection gets its own `kube.execStream()` → own PTY. `exec.stdout.on('data')` fans out only to `session.attachments` (per-session Set). Session broker keyed by `nanoid(16)`. Data isolation verified correct.

**Frontend data routing**: Module-level Maps in `openSession.ts` (`rawBuffers`, `connections`, `terminalWriters`, `engineWriters`) all keyed by unique `sessionId`. Each `openSession()` call creates its own closure. Data isolation verified correct.

**Frontend rendering**: `key={sessionId}` on TerminalView forces full React unmount/remount on session switch. Each mount creates fresh Terminal + FitAddon + canvas. Verified correct.

**The bug is purely in the canvas rendering layer — the data reaching the terminal is correct.**

## Key Files

- `repos/threads/src/components/Terminal/TerminalView.tsx` — Terminal rendering component (MODIFIED)
- `repos/threads/src/actions/sessions/openSession.ts` — WebSocket connection, data routing (MODIFIED)
- `repos/threads/src/pages/Session/Session.tsx` — Session page, renders TerminalView with `key={sessionId}`
- `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` — Backend shell WebSocket handler
- `node_modules/.pnpm/ghostty-web@0.4.0/node_modules/ghostty-web/dist/ghostty-web.js` — ghostty-web source (minified)

## Rules

- **NEVER** run `git commit`, `git push`, or any git history modification
- K8s services are ALWAYS running
- Run `pnpm types` in `repos/threads` to verify TypeScript after changes
- Load the `tdsk-threads` skill before making changes
