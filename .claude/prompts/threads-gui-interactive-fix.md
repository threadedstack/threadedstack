## Fix Terminal AST GUI Interactive Components — Continuation

### What this is about

The **Threads app** (`repos/threads/`, running at `http://localhost:5886`) has a GUI view for sandbox sessions that renders terminal AST data as interactive React components. The pipeline works (tokenizer → parser → visitors → engine → React), but **all content renders as plain text OutputCards instead of interactive UI components**. The SelectList, Confirm, TextInput, DiffBlock, ActionTarget, Panel, and other AST node types exist in the parser but are either not being detected correctly from Claude Code's terminal output, or the GUI components that render them aren't being exercised.

### The core problem

The GUI should let users interact with Claude Code **entirely through the GUI** — no terminal view needed. Right now:
- Everything shows as collapsed OutputCards with raw text lines
- Interactive elements (CC's theme selector, trust dialog, file edit confirmations, tool approval prompts) should render as clickable PromptCards, Confirm dialogs, SelectLists, DiffBlocks, etc.
- Users should be able to click "Yes" on a trust dialog, select a theme from a dropdown, approve file edits — all through the GUI
- Instead, users have to switch to Terminal view and type, which defeats the purpose

### What was already done (this session)

**Working:**
- Full pipeline: WebSocket → WASM terminal → tokenizer → parser → feed visitor → React components
- SmartInput sends text to CC via WebSocket (confirmed with instrumentation)
- Terminal view renders correctly (xterm.js)
- View toggle, Leave button, back navigation, tab system all work
- Session connect/disconnect lifecycle works
- 267/267 tests pass, types clean, zero console errors

**Fixes applied this session:**
1. `feedVisitor.ts` — Added content-change detection (detects when existing lines change, not just new lines added). This was needed because CC redraws its TUI in-place via cursor positioning.
2. `feedVisitor.ts` — Added separator/decoration filtering for PromptCard options
3. `flatParser.ts` — Tightened SelectList detection to prevent CC's prompt area from being falsely detected as a selection list (requires same indentation, 2+ non-arrow options, similar line lengths)

**Critical discovery: Claude Code does NOT use the alternate screen buffer.** It renders everything on the main screen with cursor positioning. This means `isAlternateScreen()` is always false and `detectMode()` never returns `'tui'`. The mode is always `'interactive'`. This was confirmed with instrumentation — zero `\x1b[?1049h` escape codes in any data from CC.

### What needs to be fixed

**1. The flatParser isn't detecting CC's interactive elements correctly**

The parser (`repos/threads/src/parser/flatParser.ts`) has matchers for SelectList, Confirm, TextInput, DiffBlock, Table, ActionTarget, StatusBar — but they're tuned for generic terminal apps, not CC's specific TUI patterns. CC uses Ink (React for CLI) which renders with specific escape code patterns that the matchers don't recognize well.

Key matchers to fix/test:
- `trySelectList()` — CC's theme selector (numbered list: `1. Dark`, `2. Light`, etc.) and trust dialog (`❯ 1. Yes, I trust`, `2. No, exit`) should be detected
- `tryConfirm()` — CC's tool approval prompts ("Allow this action? (y/n)") should be detected
- `tryTextInput()` — CC's `>` prompt with cursor should be detected as a text input
- `tryDiffBlock()` — CC's file edit diffs should be detected

**2. The feed visitor needs to emit the right event types**

Even when the parser detects a SelectList or Confirm, the feed visitor (`repos/threads/src/visitors/feedVisitor.ts`) may not emit the right events. Currently `diffToFeedEvents()` mostly emits `output` events (plain text). It needs to properly emit:
- `prompt` events when SelectLists or Confirms appear (so PromptCard renders with clickable options)
- `action` events when DiffBlocks appear (so ActionCard renders with accept/reject)

**3. The GUI components need to send responses back**

The `SessionGUIView` has an `onRespond` prop that should wire to `sendInput()` or `sendControl()`. When a user clicks an option in a PromptCard, it needs to send the corresponding input back through the WebSocket. Check:
- `PromptCard` — clicking an option should call `onRespond(optionText)` → `sendInput(sessionId, text)`
- `sendControl()` has `approvePermission()` and `denyPermission()` for y/n responses
- The `SmartInput` component needs to handle slash commands and special inputs

**4. The SessionGUIView isn't wiring onRespond**

Look at `Session.tsx` line 423: `<SessionGUIView sessionId={sessionId} />` — the `onRespond` prop is NOT passed. It needs to be wired to send input back to the session.

### How to test

1. **Start the Threads app** at `http://localhost:5886` (should already be running)
2. **K8s services must be up**: `tdsk dev start --clean`
3. **Use the Claude Code sandbox** (NOT the nodejs one — it will fail)
4. **Auth**: Intercept Neon Auth with API key `tdsk_QIWTcVwFP32X29BDYUigq_G8_gpl0x0swGDxa__BXF0` (see `repos/integration/playwright/fixtures/auth.ts` for the pattern)
5. **Navigate**: Click "Claude Code" in sidebar → "New Session" → GUI view
6. **Test each interactive element by interacting through the GUI only**:
   - CC's trust dialog should render as a PromptCard with "Yes, I trust this folder" / "No, exit" buttons
   - Clicking "Yes" should advance CC (no terminal needed)
   - CC's main prompt should render as a TextInput where you can type
   - When CC proposes a file edit, it should show as a DiffBlock with accept/reject
   - Tool approval prompts should show as Confirm with Yes/No buttons

### Key files

```
Parser/AST pipeline:
  repos/threads/src/parser/flatParser.ts      — Pattern matchers (SelectList, Confirm, TextInput, etc.)
  repos/threads/src/parser/modeDetector.ts     — Mode detection (interactive/tui/streaming/idle)
  repos/threads/src/parser/scopeParser.ts      — Scope detection (panels, groups)
  repos/threads/src/ast/types.ts               — All AST node types

Feed/Events:
  repos/threads/src/visitors/feedVisitor.ts    — Diff-based event generation
  repos/threads/src/visitors/renderVisitor.tsx — AST → React rendering

Engine:
  repos/threads/src/engine/sessionEngine.ts    — WASM terminal + parse loop
  repos/threads/src/engine/wasmBridge.ts       — ghostty-vt WASM bridge

GUI Components:
  repos/threads/src/components/SessionGUIView/SessionGUIView.tsx — Main GUI view
  repos/threads/src/components/ActivityFeed/ActivityFeed.tsx      — Feed renderer
  repos/threads/src/components/ActivityFeed/OutputCard.tsx        — Text output
  repos/threads/src/components/ActivityFeed/PromptCard.tsx        — Interactive prompts
  repos/threads/src/components/ActivityFeed/ActionCard.tsx        — Action cards (edits)
  repos/threads/src/components/ASTNodes/*.tsx                     — Direct AST renderers

Session/WebSocket:
  repos/threads/src/pages/Session/Session.tsx                    — Session page (data subscription)
  repos/threads/src/actions/sessions/openSession.ts              — WebSocket connection
  repos/threads/src/actions/sessions/sendInput.ts                — Send text/control to session
  repos/threads/src/hooks/useSessionEngine.ts                    — Engine lifecycle
  repos/threads/src/components/SmartInput/SmartInput.tsx          — Command input bar
```

### Constraints
- **Threads app is on port 5886**, NOT 5887 (that's admin)
- Never run `git commit/push` — user handles all commits
- Never add TODO comments
- Load `tdsk-threads` skill before working on the threads repo
- Use the **Claude Code sandbox** (sandbox ID: `sb_w3whcxc`), NOT the nodejs sandbox
- All changes are on branch `lt/threads-gui-rethink`
