# Generative UI — Implementation Handoff

## Context

We just completed a deep research + design session for the Generative UI system. This system adds an AI interpretation layer to the Threads Sandbox UI that converts raw terminal output from AI tools (Claude Code, Codex, Gemini CLI) into interactive React component trees.

## What Was Done This Session

1. **Research** — Deep analysis of 4 open-source repos (Happy, Remodex, CloudCLI, HAPI) that solve the AI tool output → interactive UI problem. Key finding: all 4 bypass terminal parsing entirely and use structured SDKs/APIs. Report at `docs/research/ai-tool-output-parsing-report.md`.

2. **Design Decision** — Instead of the SDK/adapter approach (fragile CLI flags, per-tool maintenance burden), we designed a **generative UI system** that pipes raw terminal output through an AI interpreter to produce a JSON component tree matching `React.createElement`. This is runtime-agnostic — works with any tool that writes to stdout.

3. **Spec** — Complete design spec at `docs/superpowers/specs/2026-04-13-generative-ui-design.md`.

4. **Plan** — 20-task implementation plan across 7 phases at `docs/superpowers/plans/2026-04-13-generative-ui.md`.

## Key Architecture Decisions

- **Two-phase delivery**: Raw events broadcast instantly (unchanged pipeline). AI interpreter runs async, sends upgrade events that clients match by `chunkId` and swap in with fade animation.
- **Interpreter runs server-side** (backend, between parser and broadcastEvent) — one LLM call per chunk, shared across all connected clients. Uses pi-ai `streamSimple()` for provider-agnostic calls.
- **Config**: Org-level `organizations.config.guiConfig` with per-sandbox override in `sandboxProjects.config.guiConfig`. Reuses existing org providers (providerId + model + maxRetries + optional systemPrompt override).
- **Chunk detection**: Prompt-ready primary trigger, 200ms debounce fallback.
- **Skip heuristic**: Regex patterns detect interactive markers (numbered lists, cursor markers, y/n prompts). Plain text and code fences skip the interpreter entirely.
- **V1 component registry**: Select, Confirm, TextInput, Alert, ProgressBar.
- **Interaction types**: Implicit from component type (Confirm → YesNo, TextInput → TextInput) or explicit in props (Select → ArrowSelect/NumberSelect). No separate interaction map.
- **Constants**: PascalCase (e.g., `InterpreterSystem`, `InteractivePatterns`) — NOT SCREAMING_SNAKE.
- **System prompt field**: Monaco editor in Admin UI for custom prompt override.
- **Model field**: Autocomplete filtered by selected provider (existing admin pattern).

## What Needs to Happen Next

Execute the implementation plan using **subagent-driven-development** (recommended). The plan has 20 tasks in 7 phases:

- **Phase 1** (Tasks 1-3): Domain types and constants
- **Phase 2** (Task 4): Database — add `config` JSONB column to organizations
- **Phase 3** (Tasks 5-9): Backend interpreter infrastructure (ChunkBuffer, SkipHeuristic, Validator, InterpreterService, wire into onShellConnect)
- **Phase 4** (Tasks 10-11): Backend config endpoints
- **Phase 5** (Tasks 12-13): Admin UI (OrgSettings + SandboxDrawer)
- **Phase 6** (Tasks 14-19): Threads frontend (state, event handling, renderer, components, stdin translation, ChatView integration)
- **Phase 7** (Task 20): Full verification (types, tests, builds)

## Prerequisites

1. **Markdown rendering improvements in ChatView** — AiBubble needs syntax highlighting for code blocks and proper table rendering (more content flows through markdown since code fences skip the interpreter).
2. **Database push** — After Task 4, must manually run `cd repos/database && pnpm push`.

## Prototype Reference

A working prototype exists at `.temp/prompts/threads/generative-ui-prototype.jsx` — it demonstrates the core loop (raw text → AI interpreter → JSON tree → recursive React renderer) with progressive rendering (raw text shown first, swapped to interactive UI).
