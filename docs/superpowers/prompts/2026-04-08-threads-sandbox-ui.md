I need to implement the Threads Sandbox UI feature. This is a mobile-first web UI in repos/threads that lets non-developers interact with AI tools
  (Claude Code, Codex, etc.) running in Threaded Stack sandboxes via a chat interface + terminal tab.

  Everything is already designed and planned:
  - Spec: docs/superpowers/specs/2026-04-08-threads-sandbox-ui-design.md
  - Plan: docs/superpowers/plans/2026-04-08-threads-sandbox-ui.md

  The plan has 29 tasks across 5 phases:
  1. Domain Parser (Tasks 1-7) — Shared terminal parser in @tdsk/domain that converts raw PTY output into structured events
  2. Database (Task 8) — Add sandboxId FK to threads table
  3. Backend (Tasks 9-14) — WebSocket shell endpoint (/_/sandboxes/:id/shell) with ssh2-based SSH bridge and session broker (multi-tab, reconnect, ring
  buffer)
  4. Frontend (Tasks 15-28) — Session state/actions, SandboxList, ChatView, TerminalView (ghostty-web), SmartInput, responsive layout
  5. Integration (Task 29) — Type checks, tests, builds

  Key architectural decisions:
  - Terminal parsing approach (parse PTY stream, not SDK integration)
  - Client-side parsing for real-time rendering, backend-side parsing for DB persistence (same shared parser)
  - Session broker keeps SSH alive across WebSocket reconnects (5min TTL, 1MB ring buffer)
  - Admin state patterns enforced: Loaders → Actions → Jotai → Components (no useEffect for data)
  - Thread history persisted to existing threads/messages tables

  Please read the spec and plan, then execute using subagent-driven development. Start with Phase 1 (parser in domain).