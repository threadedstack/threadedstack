## Context: Terminal AST GUI — Implementation Planning

  I have an approved design spec for a Terminal AST GUI system that needs an implementation plan. The
   spec is at:

  **`docs/superpowers/specs/2026-04-15-terminal-ast-gui-design.md`**

  Read that spec first — it contains the complete approved design.

  ### What This Is

  A deterministic Terminal AST Parser that replaces the ChatView in the threads app
  (`repos/threads/`). It reads cell data from a hidden ghostty-web WASM instance, parses it into a

  ### Key Design Decisions (all approved)

  1. **Target user**: Non-technical (PMs, designers, execs) — the GUI must be approachable without
  terminal knowledge
  2. **No LLM**: Fully deterministic. The existing InterpreterService and generative UI system are
  removed entirely.
  3. **AST-based architecture**: `Cells → Tokenizer → Tokens → Parser → AST (Document) → Visitors →
  React`
  4. **16 AST node types**: Document, Panel, Group, TextLine, Span, SelectList, SelectItem, Confirm,
  TextInput, ActionTarget, StatusBar, Table, TableRow, DiffBlock, Link, Separator. Finite closed set,
   strict parent-child typing, 1:1 React component mapping.
  5. **Tokenizer**: 5-step pipeline — Palette detection, cell classification, border tracing, block
  segmentation, run extraction. Produces 6 token types.
  6. **Parser**: Recursive descent scoped by border frames. Pattern matching in specificity order
  (SelectList > Table > DiffBlock > Confirm > TextInput > ActionTarget > StatusBar > Link > Separator
   > TextLine). Unmatched content becomes TextLine+Span — the correct parse, not a fallback.
  7. **4 Visitors**: RenderVisitor (React components), FeedVisitor (activity feed events from AST
  diffs), InteractionVisitor (click → keystroke mapping), AccessibilityVisitor (ARIA annotations).
  8. **Activity feed**: Vertical timeline dashboard. Card types: action, prompt (interactive), output
   (collapsible streaming), TUI (full-viewport takeover), user input, idle markers.
  9. **4 viewport modes**: interactive, tui, streaming, idle — detected automatically, controls feed
  behavior.
  10. **TerminalView stays**: Ghostty canvas renderer unchanged, available via toggle. Shares WASM
  instance with GUI view. Switching is instant.
  11. **Backend simplifies to raw byte pipe + storage**: All parsing, event batching, interpreter,
  and generative UI code removed.
  12. **No edge cases in navigation**: Cell grid is a coordinate system — cursor position known,
  target bounds known, navigation always computable.
  13. **Existing theme**: All components use threads MUI theme + @tdsk/components. No hardcoded
  colors.
  14. **All new code in repos/threads/**: Domain parser code removed, not relocated.

  ### What Gets Removed
  - `repos/domain/src/parser/` (terminalParser, changeDetector, contentFilter, patternMatcher, and
  their tests)
  - `repos/domain/src/types/gui.types.ts`, `repos/domain/src/constants/gui.ts` + test
  - `repos/backend/src/services/interpreter/` (entire directory)
  - `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` (simplified, not removed)
  - `repos/threads/src/components/ChatView/` (replaced by new GUI view)

  ### What Stays
  - `repos/threads/src/components/TerminalView/` (unchanged)
  - `repos/domain/src/parser/ghosttyVT.ts` (shared WASM wrapper)
  - WebSocket connection logic (simplified to binary frames only)

  ### Visual References
  Approved mockups saved at `docs/superpowers/visuals/`:
  - `2026-04-15-terminal-ast-gui-design-direction.html` — Rich Dashboard aesthetic
  - `2026-04-15-terminal-ast-gui-activity-feed.html` — Activity Feed timeline layout

  ### What I Need Now
  Write an implementation plan for this spec. Use the `superpowers:writing-plans` skill.