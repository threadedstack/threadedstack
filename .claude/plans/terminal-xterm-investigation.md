# Terminal: Investigate xterm.js Migration

## Context

The threads SPA (`repos/threads`) uses `ghostty-web@0.4.0` for its terminal emulator in `TerminalView.tsx`. After extensive work fixing rendering bugs on tab switch, the current implementation has three layers of reliability:

### What's Working Now (Phase 1 + Phase 2 changes, all unstaged on `main`)

**Garbling fix (solid):**
- `sessionDims` map tracks last known terminal dimensions per session
- Terminal is created at PTY dimensions (`sessionDims.get(id) ?? estimateTerminalDimensions()`) so buffer replay matches the data's column/row formatting
- Buffer replay happens BEFORE `fitAddon.fit()`, not after
- This prevents the overlapping/garbled text that occurred when replaying escape sequences formatted for one dimension into a terminal at different dimensions

**Color fix (reliable workaround):**
- After buffer replay + fit + subscribe, two `sendControl` resize messages toggle the PTY rows (`rows+1` then `rows`) on the BACKEND ONLY (local terminal stays at fitted dimensions)
- This triggers SIGWINCH → remote process (Claude Code, vim, etc.) repaints with fresh escape sequences
- Colors fix within ~1 second of tab switch
- Root cause: raw buffer replay into a fresh WASM terminal loses escape-sequence context, producing incorrect cell colors (proven via WASM cell color dump — colors were literally swapped between sessions)

**Demand-driven rendering (fragile, monkey-patches ghostty-web internals):**
- `startRenderLoop` patched to no-op before `term.open()`
- `animationFrameId` cancelled after `open()`
- `render(full)` helper calls `renderer.render(wasmTerm, full, viewportY, term, scrollbarOpacity)` directly
- `scheduleRender()` batches partial renders via RAF for live writes, scroll, and selection events
- This replaces ghostty-web's built-in RAF render loop which did partial redraws that cleared dirty flags prematurely

### Why Consider xterm.js

1. **Monkey-patching fragility** — The demand-driven rendering patches private ghostty-web properties (`startRenderLoop`, `animationFrameId`, `renderer.render()`). Any ghostty-web update could break this silently.

2. **Buffer replay limitations** — Raw byte buffer replay is fundamentally lossy. xterm.js has a [serialize addon](https://github.com/xtermjs/xterm.js/tree/master/addons/addon-serialize) that can capture and restore terminal state snapshots, eliminating both the color and dimension mismatch problems at the source.

3. **Ecosystem & stability** — xterm.js has millions of weekly npm downloads, is used by VS Code's integrated terminal, and has a stable documented public API. ghostty-web is newer with fewer users.

4. **WebGL renderer** — xterm.js has a WebGL addon for GPU-accelerated rendering, which could improve performance for high-throughput terminal output.

5. **No render loop issues** — xterm.js manages its own rendering correctly. The `fit` addon handles resize. The `serialize` addon handles state capture/restore. No monkey-patching needed.

### Key Files (all in `repos/threads/`)

| File | Role |
|------|------|
| `src/components/Terminal/TerminalView.tsx` | Main terminal component — ghostty-web Terminal + FitAddon, demand-driven rendering, buffer replay, resize toggle |
| `src/actions/sessions/openSession.ts` | WebSocket connection, raw buffer management (`rawBuffers` Map), `subscribeTerminalData()`, `getRawBuffer()` |
| `src/actions/sessions/sendInput.ts` | `sendInput()` (binary stdin), `sendControl()` (JSON control messages) |
| `src/services/gui/engine/wasmBridge.ts` | Creates `TBrowserVTerminal` (ghostty-web WASM terminal) for the AST-based GUI engine — processes terminal data for the GUI view |
| `src/utils/terminal/estimateDimensions.ts` | `estimateTerminalDimensions()` — hardcoded cell metrics for initial PTY size |
| `src/utils/terminal/preloadFonts.ts` | Font preloading utility |
| `src/constants/values.ts` | `DefaultCellWidth`, `DefaultCellHeight`, `FontLoadTimeoutMs` |
| `src/types/terminal.types.ts` | Terminal settings types |
| `src/types/engine.types.ts` | `TBrowserVTerminal` type used by GUI engine's wasmBridge |

### Investigation Questions

1. **Can xterm.js replace ghostty-web in TerminalView.tsx?** — Map the ghostty-web API surface used (Terminal, FitAddon, onData, onResize, write, resize, open, dispose, options) to xterm.js equivalents.

2. **What about the GUI engine's wasmBridge?** — The GUI engine creates a headless ghostty-web WASM terminal (`TBrowserVTerminal`) to parse terminal data into cell grids for the AST pipeline. Does xterm.js provide a headless terminal or parser that can produce cell-level data (codepoint, fg/bg colors, flags)?

3. **Does the serialize addon solve buffer replay?** — Can we serialize terminal state before tab switch (instead of raw buffer recording) and deserialize on tab switch? This would eliminate both color and dimension issues.

4. **What's the migration scope?** — Is this a drop-in swap of TerminalView.tsx, or does it require changes to the GUI engine, session management, and types?

5. **Performance comparison** — ghostty-web uses WASM for VT parsing. xterm.js uses JavaScript. Is there a meaningful performance difference for the throughput levels in this app?

### Rules
- Load `tdsk-threads` skill before making changes
- NEVER run `git commit`, `git push`, or any git history modification
- K8s services are ALWAYS running
- Run `pnpm types` in `repos/threads` to verify TypeScript after changes
- Threads dev server runs on port 5886
