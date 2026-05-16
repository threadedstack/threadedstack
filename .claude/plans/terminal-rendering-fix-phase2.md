# Terminal Rendering Fix — Phase 2: Demand-Driven Rendering

## Context

The ghostty-web terminal in the Threads SPA has a rendering bug where text overlaps, columns garble, and colors fade on tab switching. Phase 1 (current unstaged changes) fixed the major garbling by passing estimated terminal dimensions to `openSession()` so the PTY starts at the correct size. But tab-switching still shows faded colors because ghostty-web's built-in render loop does partial-redraws that miss some rows.

## What Phase 1 Fixed (Current Unstaged Changes)

**Files changed (all in `repos/threads/`):**

1. **`src/types/sessions.types.ts`** — Added `cols?: number; rows?: number` to `TOpenSessionOpts`
2. **`src/actions/sessions/openSession.ts`** — Uses `opts.cols/rows` instead of hardcoded `80x24` in WebSocket URL
3. **`src/constants/values.ts`** — Added `DefaultCellWidth`, `DefaultCellHeight`, `FontLoadTimeoutMs`
4. **`src/utils/terminal/estimateDimensions.ts`** — NEW: estimates cols/rows from viewport size
5. **`src/utils/terminal/index.ts`** — Re-exports estimateDimensions
6. **7 callers of `openSession()`** — All pass `estimateTerminalDimensions()` result:
   - `src/pages/Session/Session.tsx`
   - `src/components/Session/SessionCommands.tsx`
   - `src/components/Sidebar/NavSessionItem.tsx`
   - `src/contexts/SessionProvider.tsx`
   - `src/pages/Sandbox/Sandbox.tsx`
   - `src/actions/sandboxes/restartSandbox.ts`
   - `src/actions/sandboxes/recreateSandbox.ts`
7. **`src/components/Terminal/TerminalView.tsx`** — Added canvas.width nudge (150ms setTimeout after buffer replay) to force full redraw

**Root cause proven via Playwright WebSocket instrumentation:**
The PTY starts at 80x24 (hardcoded in WebSocket URL). Data arrives at 80-col formatting. The resize control message takes ~1100ms to round-trip to the backend. During that window, 80-col escape sequences (with absolute cursor positioning from Claude Code's TUI) are written to the wider terminal, producing garbled overlapping text. The WASM reflow of 80→156 col data corrupts complex TUI layouts.

**Phase 1 fix:** Pass estimated terminal dimensions (~156x47) to the WebSocket URL so the PTY starts at the correct size. No resize race, no garbled data.

## What Phase 2 Needs to Fix

**Problem:** On tab switch, the terminal is destroyed and recreated (React `key={sessionId}` forces remount). The rawBuffer is replayed into the new terminal. ghostty-web's built-in render loop does partial-redraws (only dirty rows), then calls `wasmTerm.clearDirty()`. Some rows never get painted correctly, causing faded/missing colors.

**Approaches tried and failed:**
- Canvas.width nudge (150ms setTimeout) — inconsistent, sometimes works sometimes doesn't
- Direct `renderer.render(wasmTerm, true, ...)` call — wipes terminal content due to internal state issues
- SIGWINCH via sendControl — disrupts Claude Code's TUI state
- Dimension toggle (cols+1 → cols) — WASM reflow at same dimensions doesn't fix colors

## Phase 2: Implement Demand-Driven Rendering (floeterm approach)

### Architecture

Stop ghostty-web's built-in `requestAnimationFrame` render loop and replace it with explicit on-demand rendering. This is exactly what [floegence/floeterm](https://github.com/floegence/floeterm) does successfully.

### Key Reference: floeterm's Implementation

From `terminal-web/src/core/TerminalCore.ts`:

```typescript
// 1. Before term.open(), patch startRenderLoop to be a no-op
private installDemandRenderPatchBeforeOpen(): void {
  const termAny = this.terminal as any;
  termAny.startRenderLoop = () => {
    this.requestDemandRender(false); // request one render instead of loop
  };
}

// 2. After term.open(), kill the RAF loop that was started
private stopGhosttyRenderLoop(): void {
  const termAny = this.terminal as any;
  cancelAnimationFrame(termAny.animationFrameId);
  termAny.animationFrameId = undefined;
}

// 3. Render on demand with explicit full/partial control
private renderDemandFrame(forceAll: boolean): void {
  const termAny = this.terminal as any;
  termAny.renderer.render(
    termAny.wasmTerm,
    forceAll,
    termAny.viewportY ?? 0,
    termAny,
    termAny.scrollbarOpacity ?? 0
  );
}
```

### Implementation Plan for TerminalView.tsx

1. **Before `term.open(container)`**: Monkey-patch `term.startRenderLoop` to be a no-op (or to schedule a single demand render)

2. **After `term.open(container)`**: Cancel the RAF that `open()` started:
   ```typescript
   const termAny = term as any
   if (termAny.animationFrameId != null) {
     cancelAnimationFrame(termAny.animationFrameId)
     termAny.animationFrameId = undefined
   }
   ```

3. **Create a `forceRender(full: boolean)` helper** that directly calls the renderer:
   ```typescript
   const forceRender = (full: boolean) => {
     const t = term as any
     if (t.renderer && t.wasmTerm) {
       t.renderer.render(t.wasmTerm, full, t.viewportY ?? 0, term, t.scrollbarOpacity ?? 0)
     }
   }
   ```

4. **After buffer replay**: Call `forceRender(true)` for a complete repaint

5. **After each `term.write()` in the subscription callback**: Call `forceRender(false)` for partial update (or batch via RAF)

6. **After `fitAddon.fit()`**: Call `forceRender(true)` since resize changes canvas dimensions

7. **On cleanup**: No RAF to cancel (we killed it)

### Key Considerations

- **Performance**: floeterm uses a `TerminalRenderScheduler` singleton that batches renders into RAF frames with an 8ms budget and max 8 tasks per frame. Start simple (render after each write), optimize with batching if needed.

- **Cursor blink**: The render loop drives cursor blink animation. Without it, cursor blink won't work unless you schedule periodic re-renders. Start with `cursorBlink: false` (which is already the default in the current code).

- **Scrolling**: The render loop handles scroll updates. When the user scrolls, `viewportY` changes and a render is needed. Hook into scroll events to trigger demand renders.

- **Selection**: Selection highlighting requires re-rendering. Hook into selection change events.

### Other Approaches from Reference Implementations

**coder/mux approach** (alternative, requires backend changes):
- Backend sends a `screenState` VT snapshot when a client subscribes
- Client calls `term.clear()` before subscribing
- Loading overlay hides terminal until screenState arrives
- No buffer replay needed — server provides authoritative screen state

**remux approach** (simpler, requires backend changes):
- Server runs ghostty-vt WASM to maintain VT state per session
- On tab attach: `term.reset()` + server sends VT snapshot + `Ctrl+L` (50ms delay)
- Client gets a clean render from server-authoritative state

### Testing

Use the Playwright test script at `.claude/terminal-test/test-fix.mjs` (recreate if needed — it uses Playwright from `/Users/lancetipton/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.js`).

Test pattern:
1. Create 4 sessions
2. Switch between all tabs 3 times
3. Screenshot each switch
4. Compare colors/layout — "Tips for getting started" should be orange, "What's new" should be orange, pig art should be pink on ALL tabs in ALL rounds

Auth mock: intercept Neon Auth `get-session` → return mock session with API key `tdsk_7wIFpXetXWx-lf4blrJNt-FYhh2mRPdRqqJ4Yv9e8EY`. Intercept `px.local.threadedstack.app/**` → add Bearer auth header.

### ghostty-web Internals Reference (v0.4.0)

Key private properties on the Terminal instance (accessed via `term as any`):
- `term.renderer` — CanvasRenderer instance
- `term.wasmTerm` — WASM terminal state
- `term.viewportY` — current viewport scroll position
- `term.scrollbarOpacity` — scrollbar opacity (usually 0)
- `term.animationFrameId` — the RAF ID from startRenderLoop
- `term.startRenderLoop` — function that starts the RAF render loop

Key line numbers in `node_modules/.pnpm/ghostty-web@0.4.0/node_modules/ghostty-web/dist/ghostty-web.js`:
- Line 2323: `open(container)` — creates canvas, renderer, starts render loop
- Line 2373: Initial render + `startRenderLoop()` + `focus()`
- Line 2639: `startRenderLoop()` — `A()` called immediately, then `requestAnimationFrame(A)`
- Line 2642: Render loop body: `renderer.render(wasmTerm, false, ...)` — partial redraw
- Line 1398: `CanvasRenderer.render(wasmTerm, fullRedraw, viewportY, scrollbackProvider, scrollbarOpacity)`
- Line 1479: End of render: `A.clearDirty()`

### Rules

- **NEVER** run `git commit`, `git push`, or any git history modification
- K8s services are ALWAYS running — never suggest starting them
- Run `pnpm types` in `repos/threads` to verify TypeScript after changes
- Load the `tdsk-threads` skill before making changes
- The threads dev server runs on port 5886
