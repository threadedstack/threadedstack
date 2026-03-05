## TASKS

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor

---

## Execution Plan

Tasks are organized into batches based on file-level dependencies. Batches with no shared files can run in parallel. Tasks within a batch may be serial (noted) or parallel.

### Wave 1 (up to 13 concurrent agents, zero conflicts)

| Batch | Task | Priority |
|-------|------|----------|
| 1 | Git tool for sandbox | P3 |
| 1 | Chat app | P3 |
| 1 | Website | P3 |
| 1 | Playwright tests | P3 |

### Wave 2 (after Wave 1 finishes)

| Batch | Task | Priority |
|-------|------|----------|
| 6 | Agent autonomous tools (serial within batch) | P3 |
| 7 | S3 storage (start of serial chain) | P3 |

### Wave 3 (after relevant Wave 2 items)

| Batch | Task | Priority |
|-------|------|----------|
| 7 | RAG system (after S3) | P3 |
| 6 | Continue remaining autonomous tools | P3 |

### Wave 4 (after Wave 3)

| Batch | Task | Priority |
|-------|------|----------|
| 7 | Agent long-term memory (after RAG) | P3 |

### Shared File Conflict Map

| Shared File | Tasks That Touch It |
|-------------|---------------------|
| `agent/tools/tools.ts` | orchestration, task queue, planning, memory, scheduling, cost tracking, testing, HITL, S3 (artifact), RAG, GitHub |
| `agent/runner/runner.ts` | memory, cost tracking, RAG |
| `backend/services/websocket/websocket.ts` | orchestration, cost tracking, HITL, RAG |
| `domain/types/ai.types.ts` | various agent tools |
| `backend/endpoints/threads/uploadFile.ts` | S3, RAG |

---

## Batch 1 — Fully Independent (all run in parallel)

These tasks touch completely different files with zero overlap. All can run in Wave 1.

### [P3] Add Git tool for agents — virtual filesystem git operations via sandbox

* **Repos**: sandbox, (agent optional)
* **Key files**: `sandbox/src/commands/git.ts`, `sandbox/src/local.ts`
* Agents currently have no git capabilities. A git tool should be added so agents can perform git operations (init, add, commit, branch, checkout, diff, log, status, merge, etc.) entirely within the sandbox's virtual filesystem (`InMemoryFs`). It must NOT touch the real filesystem
* **Two implementation approaches**:
  * **Option A — just-bash custom command** (recommended): Register a `git` custom command via `defineCommand("git", ...)` and pass it to the `Bash` constructor's `customCommands` array in `repos/sandbox/src/local.ts`. This makes `git` available as a native shell command in the sandbox (e.g., `git init && git add . && git commit -m "msg"`). The `CommandContext` provides `ctx.fs` (virtual FS) and `ctx.cwd` for all file operations
  * **Option B — standalone AgentTool**: Add git-specific tools (`gitInit`, `gitAdd`, `gitCommit`, etc.) alongside existing tools in `repos/agent/src/tools/definitions/` with corresponding `AgentTool` implementations in `repos/agent/src/tools/tools.ts`. This exposes git as discrete LLM tool calls rather than shell commands
* **Implementation**: Use `isomorphic-git` (pure JS, no native binary) with a custom FS adapter that bridges to the sandbox's `IFileSystem` interface. `isomorphic-git` accepts a pluggable `fs` object — adapt `InMemoryFs` (read/write/stat/readdir/mkdir/unlink) to match isomorphic-git's fs requirements. For HTTP operations (clone, fetch, push), either disable them or route through the sandbox's network config
* **Key considerations**:
  * The `IFileSystem` interface from just-bash already supports the POSIX operations isomorphic-git needs (readFile, writeFile, mkdir, readdir, stat, unlink, etc.)
  * Option A is preferred because it integrates naturally with `shellExec` — agents already use shell commands, and `git` would work inline with other commands
  * Option B is better if fine-grained LLM tool-call control is needed per git operation
  * Both options can coexist — a custom command for shell use + dedicated tools for structured calls
  * All git operations must stay within the virtual FS boundary — no system `git` binary, no real disk access
* **Files**:
  * New: `repos/sandbox/src/commands/git.ts` — isomorphic-git adapter wrapping `IFileSystem`, `defineCommand("git", ...")` implementation
  * `repos/sandbox/src/local.ts` — register git custom command in `Bash` constructor's `customCommands`
  * If Option B also: `repos/agent/src/tools/definitions/git/` — LLM tool definitions for git operations
  * If Option B also: `repos/agent/src/tools/tools.ts` — add git `AgentTool` implementations
  * `repos/domain/src/types/sandbox.types.ts` — possibly extend `ISandbox` if git needs dedicated methods beyond `exec()`
  * New dependency: `isomorphic-git` in `repos/sandbox/package.json`

### [P3] Standalone chat application — web and desktop interface for agent interaction

* **Repos**: NEW `repos/chat/`, components, domain
* **Key files**: Entirely new repo
* The REPL CLI (`repos/repl/`) is currently the primary user-facing interface for agent interaction, but it requires terminal proficiency. The admin dashboard (`repos/admin/`) has a basic embedded chat UI (`ChatView`, `MessageBubble`, `ToolCallDisplay`), but it's a secondary feature inside an org management app — not a dedicated chat experience. A standalone chat-first application is needed for non-terminal users, deployed and operated independently from the admin dashboard
* This is a **separate application** from the admin UI — its own repo, its own build, its own deployment. While it may share dependencies (`@tdsk/domain`, `@tdsk/components`), it has its own routing, auth flow, and UX optimized entirely for conversation
* **Feature parity with REPL** (minimum):
  * Login via API key (same `tdsk_*` bearer token flow as REPL's `login` command)
  * Agent selection — list and switch between available agents
  * Thread management — create new threads, list existing threads, switch between threads, view thread history
  * Real-time streaming chat — WebSocket connection using the same protocol as REPL/admin (`POST /_/ai/sessions` to WS `/ai/ws?token=`)
  * Tool call visibility — show tool calls, progress, and results inline (equivalent to REPL's verbose mode)
  * Thread branching/forking — fork a conversation at any message point (equivalent to REPL's `/fork` command)
  * Context file attachment — upload files to threads, view attached context (equivalent to REPL's `/add` command)
  * Provider/model switching — change LLM provider or model mid-session (equivalent to REPL's `/switch-provider` command)
  * Session info — display current org, agent, thread, model (equivalent to REPL's `/info` command)
* **Beyond REPL — web-native features**:
  * Rich message rendering — markdown with syntax highlighting, rendered HTML/SVG artifacts inline, image display, collapsible tool call details
  * Multi-thread sidebar — persistent thread list with search, grouped by agent, showing last message preview and timestamp
  * Artifact gallery — view and interact with agent-generated artifacts (HTML previews, code blocks with copy, SVG rendering)
  * File drag-and-drop upload — visual upload with progress, preview for images/PDFs
  * Keyboard shortcuts — Cmd/Ctrl+Enter to send, Cmd+K for quick agent/thread switch, Cmd+N for new thread
  * Responsive design — works on desktop browsers and mobile viewports
  * Dark/light theme — user preference, persisted locally
  * Notification support — browser notifications for agent completion when tab is backgrounded
* **Deployment options**:
  * **Web app**: Static SPA served from its own domain/subdomain (e.g., `chat.threadedstack.app`). Deployed to S3+CDN, Vercel, or a dedicated K8s pod — separate from the admin app's deployment
  * **Desktop app (Electron/Tauri)**: Wrap the same web app in Electron or Tauri for a native desktop experience. Tauri preferred (smaller binary, Rust-based, lower memory). Desktop app can add: system tray icon, global hotkey to open, native file picker for uploads, offline thread history cache
  * Both targets share the same core React codebase — platform-specific code isolated to a thin shell layer
* **Tech stack (must use shared components repo for UI consistency)**:
  * React + Vite (consistent with existing repos)
  * **`@tdsk/components`** — must use the shared component library (`repos/components/`) as the foundation for all UI components, including the MUI theme, design tokens, palette, and typography. The theme is defined in `@tdsk/components` and consumed by all user-facing apps — nothing should depend on `@tdsk/admin`
  * **MUI component library** — consumed via `@tdsk/components`, same library used across all UIs
  * Jotai for state management (consistent with admin)
  * Shared `@tdsk/domain` for types — the chat app must not depend on `@tdsk/admin`
  * WebSocket client — reuse the same WS event types from `repos/domain/src/types/ws.types.ts`
* **Auth flow**:
  * API key login (primary — same as REPL): user enters `tdsk_*` key, app validates via `GET /_/orgs` through proxy, stores key locally
  * Optional: Neon Auth social login (same as admin) for users who prefer browser-based OAuth. Both auth methods produce a valid bearer token for the proxy
  * Session token for WebSocket: `POST /_/ai/sessions` with agentId to receive session token to connect WS
* **Fix**:
  1. Create a new repo `repos/chat/` in the workspace with Vite + React + TypeScript scaffold. Configure aliases (`@TCH/*`), biome linting, and `@tdsk/domain` + `@tdsk/components` as workspace dependencies
  2. Implement auth layer — API key login screen, credential storage (localStorage or secure cookie), auth state management
  3. Build core chat UI — message list with streaming, input bar with multiline support, send/cancel buttons, tool call display
  4. Build thread management — sidebar with thread list, create/switch/delete threads, thread search
  5. Build agent selection — agent picker (list from `GET /_/agents`), agent switching, display current agent info
  6. Implement WebSocket service — connect to backend WS, handle all 12 server-to-client event types, send all 7 client-to-server message types. Reuse `TWSClientMsg` / `TWSServerMsg` types from `@tdsk/domain`
  7. Add file upload — drag-and-drop zone, file preview, upload via thread file endpoint
  8. Add artifact rendering — inline HTML preview (sandboxed iframe), code blocks with syntax highlighting, SVG rendering
  9. Add thread branching UI — message context menu with "Fork from here", branch visualization
  10. Desktop wrapper (Phase 2) — Tauri or Electron shell around the web app, with native features (tray, hotkey, file picker)
* **Key considerations**:
  * This is a separate deployment from admin — its own CI/CD, its own URL, its own K8s pod or static hosting. Must not couple to admin's build or routing
  * The WebSocket protocol is already stable and used by both REPL and admin — no backend changes needed for the chat app to connect
  * Start with web-only, add desktop wrapper as a follow-up once the web UI is stable
  * The admin app's existing chat and artifact components (i.e. `ChatView`, `MessageBubble`, `ToolCallDisplay`, `ArtifactRenderer`, `FilePreview`, etc.) should be extracted into `@tdsk/components` for reuse — no app should depend on `@tdsk/admin`
  * The MUI theme, design tokens, palette, and typography must be defined in `@tdsk/components` — all user-facing apps (admin, chat, website) consume the theme from there
  * Consider PWA capabilities (service worker, installable, offline thread cache) as a lighter alternative to a full desktop app
* **Files**:
  * New: `repos/chat/` — entire new repo (Vite + React + TypeScript)
  * New: `repos/chat/src/services/ws.ts` — WebSocket client using `@tdsk/domain` event types
  * New: `repos/chat/src/services/api.ts` — REST API client for auth, agents, threads
  * New: `repos/chat/src/components/Chat/` — message list, input bar, tool display, artifact renderer
  * New: `repos/chat/src/components/Sidebar/` — thread list, agent picker, search
  * New: `repos/chat/src/components/Auth/` — login screen, API key input
  * `repos/components/` — potentially extract shared chat components from admin for reuse
  * `repos/domain/src/types/ws.types.ts` — already defines all WS event types (no changes needed)
  * `deploy/` — add Helm templates or static hosting config for the chat app deployment

### [P3] Landing page and documentation website

* **Repos**: NEW `repos/website/`
* **Key files**: Entirely new repo
* ThreadedStack has no public-facing website — no marketing/landing page, no signup flow, no hosted documentation. Users have no way to discover the platform, understand its features, or learn how to use it. This is a separate repo and deployment from both the admin dashboard and the chat app — a simple, fast, SEO-friendly marketing and docs site on its own domain (e.g., `threadedstack.app` or `threadedstack.com`)
* **Landing page sections**:
  * Hero — tagline, value proposition, CTA (signup / get started)
  * Features overview — auth proxy, FaaS, AI agents, secrets management, sandbox. Visual diagrams of the request flow and architecture
  * How it works — step-by-step: create org, configure agent, connect provider, start chatting
  * Pricing/plans — free/basic/developer/pro tiers (from existing Polar.sh subscription system). Feature comparison table
  * Use cases — autonomous AI agents, API orchestration, serverless compute, secure proxy
  * Social proof / testimonials (placeholder initially)
  * Footer — links to docs, GitHub, status page, contact
* **Signup flow**:
  * CTA links to the admin dashboard's Neon Auth login (`admin.threadedstack.app`) — the website itself doesn't handle auth, it redirects to admin for account creation
  * Alternatively, embed a simple signup form that calls a backend endpoint to create an org + user via Neon Auth, then redirects to admin
* **Documentation site**:
  * Getting started guide — account setup, first agent, first chat
  * API reference — all REST endpoints (`/_/orgs`, `/_/agents`, `/_/threads`, etc.) with request/response examples, auth requirements, error codes
  * WebSocket protocol — all client-to-server and server-to-client event types with payload schemas
  * Concepts — organizations, projects, agents, threads, providers, secrets, endpoints, functions, skills, schedules
  * Guides — REPL CLI usage, admin dashboard walkthrough, chat app setup, integration testing, self-hosting (K8s deployment)
  * SDK / client library docs (when available)
  * Changelog — versioned release notes
* **Tech stack (must use shared components repo for UI consistency)**:
  * **React + Vite** — consistent with all other repos in the workspace
  * **`@tdsk/components`** — must use the shared component library (`repos/components/`) for all UI components, including the MUI theme, design tokens, palette, and typography. The theme is defined in `@tdsk/components` and consumed by all user-facing apps — nothing should depend on `@tdsk/admin`
  * **MUI component library** — consumed via `@tdsk/components`, same library used across all UIs for a consistent look and feel
  * Shared `@tdsk/domain` for types — the website must not depend on `@tdsk/admin`
  * For docs content, use MDX or a docs-oriented routing pattern within the React app (e.g., file-based MDX content with a docs layout component). Alternatively, investigate React-compatible docs frameworks that support MUI theming (e.g., Docusaurus with MUI plugin, or a custom docs layout)
* **Fix**:
  1. Create a new repo `repos/website/` with Vite + React + TypeScript scaffold. Configure aliases, biome linting, and `@tdsk/domain` + `@tdsk/components` as workspace dependencies
  2. Build landing page — hero, features, how-it-works, pricing sections. Use `@tdsk/components` and MUI for all layout and styling. Optimize for Core Web Vitals
  3. Set up docs structure — sidebar navigation, MDX content pages, code block syntax highlighting, auto-generated table of contents. Use a docs layout component built with MUI
  4. Write initial docs content: getting started guide, API reference (can be partially auto-generated from backend route definitions and domain types), WebSocket protocol reference, concepts overview
  5. Add search — integrate a client-side search solution (e.g., Pagefind, Lunr, or Algolia DocSearch)
  6. Deployment — static build output to S3 + CloudFront/Cloudflare CDN, or Vercel/Netlify for zero-config hosting. Separate CI/CD from admin/chat apps
  7. Analytics — lightweight, privacy-respecting (Plausible, Fathom, or Simple Analytics) rather than Google Analytics
  8. OpenGraph / SEO — meta tags, social preview images, structured data (JSON-LD), sitemap.xml, robots.txt
* **Key considerations**:
  * This is primarily a static/content site — no runtime backend dependency. It links to admin/chat apps but doesn't call the ThreadedStack API directly (except possibly for a signup form)
  * The MUI theme, design tokens, palette, and typography must come from `@tdsk/components` — this ensures the website visually matches the admin dashboard and chat app
  * Docs should be version-aware if the API changes across releases
  * API reference docs could be auto-generated from OpenAPI/Swagger spec if one is added to the backend, or maintained manually as MDX
  * The site should be independently deployable — pushing a docs update shouldn't require redeploying the backend
  * Start simple — landing page + getting started guide + API reference. Expand docs as features mature
  * Consider a blog section for announcements, tutorials, and engineering deep-dives
* **Files**:
  * New: `repos/website/` — entire new repo (Vite + React + TypeScript)
  * New: `repos/website/src/pages/` — landing page, pricing page, about page
  * New: `repos/website/src/content/docs/` — MDX documentation files (getting-started, api-reference, concepts, guides)
  * New: `repos/website/vite.config.ts` — Vite configuration with React and MDX plugins
  * `repos/components/` — shared MUI theme, design tokens, and reusable components consumed by the website
  * `deploy/` — add static hosting config or Helm templates for CDN deployment

### [P3] Playwright integration test coverage is minimal — only page navigation/rendering

* **Repos**: integration
* **Key files**: `integration/src/` only
* Current coverage only validates that pages load and render without console errors
* Missing: full CRUD operations for all entity types through the UI
* **Entities needing coverage**:
  * Organization level: Agents, Secrets, Domains, Providers, Member Invites, Projects
  * Project level: Endpoints, Functions, Secrets, Agents, Members, Domains
  * Agent level: Threads, Chats
* **Fix**: Build a comprehensive Playwright test suite using the existing auth bypass pattern (mock Neon Auth `get-session`, set API key as session token). Each entity type needs Create, Read, Update, Delete test flows through the UI
* **Files**: New test files in `repos/integration/src/` for each entity CRUD flow

---

## Batch 6 — Agent Autonomous Tools (8 tasks, HIGH overlap on `agent/tools/tools.ts`)

All 8 tasks add new entries to `agent/tools/tools.ts`. **Recommended approach**: Refactor `tools.ts` first to import tool implementations from per-feature modules (e.g., `tools/orchestration.ts`, `tools/tasks.ts`). After that refactor, each task only needs to create its own module file and add one import + registration line to `tools.ts`.

Without refactoring, these must be sequential. Suggested order (respecting dependencies):

### Task 1: [P3] Agent task queue and work tracking *(foundation for others)*

* **Repos**: database, backend, agent, domain
* Agents have no structured way to track tasks, progress, or dependencies beyond conversation history. For multi-step work, agents need persistent task state they can create, update, and query
* **Fix**:
  1. Add `agent_tasks` table — `id`, `agentId`, `threadId`, `orgId`, `parentTaskId`, `title`, `description`, `status` (pending/in_progress/completed/failed/blocked), `dependencies` (array of task IDs), `assignedAgentId`, `result`, `createdAt`, `updatedAt`
  2. Add CRUD endpoints under `/_/agents/:agentId/tasks` — list, create, update status, query by status/dependency
  3. Add agent tools: `createTask`, `updateTask`, `listTasks`, `getTask` — agents can manage their own task lists
  4. Dependency resolution: when a task is marked complete, auto-unblock dependent tasks. Agent can query "what tasks are ready to start?"
  5. Task hierarchy: tasks can have subtasks via `parentTaskId`, enabling goal decomposition
* **Files**:
  * New: `repos/database/src/schemas/agentTasks.ts` — task table schema
  * New: `repos/database/src/services/agentTask.ts` — task CRUD service
  * New: `repos/backend/src/endpoints/agents/agentTasks.ts` — task endpoints
  * `repos/agent/src/tools/definitions/tasks/` — task management tool definitions
  * `repos/agent/src/tools/tools.ts` — task tool implementations
  * `repos/domain/src/types/` — task types and status enums
  * `repos/domain/src/models/` — AgentTask model

### Task 2: [P3] Agent planning and goal decomposition tool *(depends on task queue)*

* **Repos**: agent
* Agents currently plan inline in conversation with no structured output. For autonomous work, agents need a planning tool that produces structured task lists from high-level goals, with automatic subtask creation and re-planning on failure
* **Fix**:
  1. Create a `planWork` agent tool that accepts a high-level goal description and produces a structured plan (ordered list of tasks with dependencies, estimated complexity, acceptance criteria)
  2. The tool's implementation prompts the LLM with a planning-specific system prompt (separate from the main agent prompt) to decompose the goal, then auto-creates tasks in the task queue
  3. Add a `replan` tool — when a task fails, the agent can call `replan` with the failure context to adjust remaining tasks
  4. Create a "planner" skill (`repos/domain` skill definition) with planning-specific instructions, triggerKeywords like "plan", "implement", "build", "design"
  5. Plan output should be inspectable — store plans as thread messages with structured metadata (not just free text)
* **Files**:
  * `repos/agent/src/tools/definitions/planning/` — `planWork`, `replan` tool definitions
  * `repos/agent/src/tools/tools.ts` — planning tool implementations
  * `repos/agent/src/utils/` — planning prompt templates, plan-to-task converter

### Task 3: [P3] Agent testing and validation tools *(agent-only, small)*

* **Repos**: agent
* Agents implementing features need to run tests, builds, and type checks to validate their work. Currently no agent tools exist for test running or result interpretation
* **Fix**:
  1. Add a `runTests` agent tool — runs a test command (e.g., `vitest run path/to/test.ts`) in the sandbox via `shellExec`, captures stdout/stderr, parses results into structured output (pass/fail counts, failure messages)
  2. Add a `runBuild` tool — runs build commands, parses output for errors/warnings, returns structured result
  3. Add a `runTypeCheck` tool — runs `tsc --noEmit` or equivalent, parses type errors into structured output
  4. Create a "test-and-fix" skill that instructs the agent to: run tests, if failures then read failing test + source, fix, re-run, repeat until green (with max iteration limit)
  5. Result parsing should be tool-agnostic — handle vitest, jest, playwright output formats via configurable parsers
* **Files**:
  * `repos/agent/src/tools/definitions/testing/` — `runTests`, `runBuild`, `runTypeCheck` tool definitions
  * `repos/agent/src/tools/tools.ts` — testing tool implementations
  * `repos/agent/src/utils/` — test output parsers (vitest, playwright)

### Task 4: [P3] Agent-to-agent orchestration — spawn and coordinate sub-agents *(independent)*

* **Repos**: backend, database, agent, domain
* No mechanism exists for agents to spawn sub-agents, delegate subtasks, or coordinate parallel work. A coordinator agent should be able to decompose work and dispatch it to specialized worker agents
* **Fix**:
  1. Add an agent spawning API — `POST /_/agents/:agentId/spawn` — creates a child agent run with inherited or overridden config (model, tools, system prompt). Returns a handle (child thread ID) for tracking
  2. Define parent-child communication: parent sends prompt to child via thread, child runs autonomously, parent polls or subscribes to child's `Done` event via WebSocket
  3. Add a `spawnAgent` tool to the agent tool set — agents can call it to create sub-agents with specific instructions, then use a `checkAgentStatus` tool to poll results
  4. Track parent-child relationships in the thread model (add `parentThreadId` field) for audit and result aggregation
  5. Add concurrency controls — max parallel children per parent, total active agent limit per org (quota-based)
* **Files**:
  * `repos/backend/src/endpoints/agents/` — spawn endpoint, child status endpoint
  * `repos/agent/src/tools/definitions/orchestration/` — `spawnAgent`, `checkAgentStatus`, `cancelAgent` tool definitions
  * `repos/agent/src/tools/tools.ts` — orchestration tool implementations
  * `repos/database/src/schemas/threads.ts` — add `parentThreadId` column
  * `repos/domain/src/types/` — orchestration types (spawn config, child status)
  * `repos/backend/src/services/websocket/websocket.ts` — child completion notifications to parent

### Task 5: [P3] Dynamic scheduling — agents create their own triggers *(independent)*

* **Repos**: backend, agent, domain
* Current schedules have fixed prompts set at creation time. Autonomous agents need to create, modify, and delete their own schedules, including one-shot delayed runs and event-driven triggers
* **Fix**:
  1. Add agent tools: `createSchedule`, `updateSchedule`, `deleteSchedule`, `listSchedules` — agents can manage schedules for themselves or other agents (permission-gated)
  2. Support one-shot schedules — `runAt` timestamp instead of cron expression, auto-deletes after run
  3. Support dynamic prompts — schedule stores a prompt template with variable interpolation (e.g., `"Check status of PR {{prNumber}}"` with variables resolved at run time)
  4. Add event-driven triggers beyond cron — e.g., "run when task X completes", "run when webhook Y fires". Store trigger conditions in schedule metadata
  5. Extend the existing scheduler service (`repos/backend/src/services/scheduler/`) to handle one-shot and event-driven triggers alongside cron
* **Files**:
  * `repos/agent/src/tools/definitions/scheduling/` — schedule management tool definitions
  * `repos/agent/src/tools/tools.ts` — scheduling tool implementations
  * `repos/backend/src/services/scheduler/scheduler.ts` — one-shot runs, event triggers, dynamic prompts
  * `repos/backend/src/endpoints/schedules/` — extend existing endpoints for agent-initiated CRUD
  * `repos/domain/src/types/schedule.types.ts` — add one-shot and event trigger types

### Task 6: [P3] Agent cost tracking and budget awareness *(independent)*

* **Repos**: backend, database, agent, domain
* Token usage is currently hardcoded to zeros in the agent runner. Autonomous agents making many LLM calls need cost visibility and budget limits to operate responsibly
* **Fix**:
  1. Wire `AssistantMessage.usage` from pi-mono's response into the `TurnEnd` WebSocket event — extract `inputTokens`, `outputTokens`, `thinkingTokens` from the pi-mono Agent's response
  2. Calculate cost per turn using model pricing tables (store as config, not hardcoded). Accumulate per-thread and per-agent totals
  3. Add `tokenUsage` and `cost` columns to messages table (or a separate `usage` table) for audit trail
  4. Add budget ceiling to agent config — `maxCostPerRun`, `maxCostPerDay`. When ceiling is hit, agent gracefully degrades: switch to cheaper model, pause and notify, or terminate with a summary
  5. Expose cost data via API — `GET /_/agents/:agentId/usage` for dashboards and monitoring
  6. Add an agent tool `checkBudget` so agents can self-monitor remaining budget and make cost-aware decisions
* **Files**:
  * `repos/agent/src/runner/runner.ts` — extract usage from pi-mono, calculate cost, enforce budget
  * `repos/backend/src/services/websocket/websocket.ts` — wire real usage into `TurnEnd` event
  * `repos/database/src/schemas/` — usage tracking table or columns
  * `repos/domain/src/constants/` — model pricing tables
  * `repos/backend/src/endpoints/agents/` — usage query endpoint
  * `repos/agent/src/tools/definitions/budget/` — `checkBudget` tool definition

### Task 7: [P3] GitHub integration service for agents *(independent)*

* **Repos**: backend, database, agent, domain
* No GitHub API integration exists today. Agents need authenticated access to GitHub for repo operations, PR workflows, and event-driven triggers. Could be implemented as custom functions (FaaS) or a dedicated integration service
* Depends on: Git tool for sandbox (Batch 1)
* **Capabilities needed**:
  * **Read**: Clone repos into sandbox VFS, read file contents, list branches/tags, view PR diffs and comments, list issues
  * **Write**: Create branches, push commits, open/update PRs, comment on PRs and issues, set PR status checks
  * **Events**: Webhook ingestion to trigger agents on GitHub events (PR comments, issue creation, push events, review requests)
* **Fix**:
  1. Add `octokit` (or `@octokit/rest`) as a dependency. Create a GitHub service that wraps authenticated API calls with org-level GitHub token management (stored as secrets)
  2. Expose GitHub operations as custom functions or agent tools — agents call them by name with typed parameters (e.g., `githubCreatePR({ owner, repo, title, body, head, base })`)
  3. Add a webhook endpoint (`/_/webhooks/github`) that receives GitHub events, maps them to agent triggers (e.g., PR comment prompts the assigned agent with the comment text)
  4. For repo cloning, use `isomorphic-git` HTTP transport to clone into the sandbox VFS — reuse the git tool's FS adapter
  5. Security: GitHub tokens stored as org secrets (encrypted via existing secrets system), never exposed to agents directly — the service injects auth on behalf of the agent
* **Files**:
  * New: `repos/backend/src/services/github/` — Octokit wrapper, token management, webhook handler
  * New: `repos/backend/src/endpoints/webhooks/github.ts` — webhook ingestion endpoint
  * `repos/database/src/schemas/` — optional: store GitHub app installation state if using GitHub App auth
  * `repos/agent/src/tools/definitions/github/` — agent tool definitions for GitHub operations
  * `repos/domain/src/types/` — GitHub-related types (webhook payloads, PR models)

### Task 8: [P3] Human-in-the-loop checkpoints for autonomous agents *(touches most repos, do last)*

* **Repos**: database, backend, agent, domain, admin
* Fully autonomous agents need configurable approval gates, progress reporting, and abort capabilities so humans stay in control
* **Fix**:
  1. Add approval gate model — `agent_approvals` table with `id`, `agentId`, `threadId`, `action` (e.g., "create_pr", "push_code", "delete_file"), `status` (pending/approved/rejected), `requestedAt`, `resolvedAt`, `resolvedBy`
  2. Add a `requestApproval` agent tool — agent pauses and creates an approval request. Runs only when a human approves (via API or admin UI)
  3. Add approval configuration to agent settings — list of actions that require approval (e.g., always require approval for PR creation, never for file reads)
  4. Progress reporting — agents periodically emit `ProgressUpdate` WebSocket events with structured status (current task, % complete, blockers). Also support webhook notifications (POST to configurable URL) and email digests
  5. Kill switch — admin UI button and API endpoint to immediately abort an autonomous agent run, with cleanup (close sandbox, persist partial results, mark tasks as aborted)
  6. Audit trail — log all agent decisions and tool invocations to a queryable `agent_audit_log` table for post-hoc review
* **Files**:
  * New: `repos/database/src/schemas/agentApprovals.ts` — approval gate table
  * New: `repos/database/src/schemas/agentAuditLog.ts` — audit log table
  * New: `repos/backend/src/endpoints/agents/agentApprovals.ts` — approval CRUD + resolve endpoint
  * `repos/agent/src/tools/definitions/approval/` — `requestApproval` tool definition
  * `repos/backend/src/services/websocket/websocket.ts` — `ProgressUpdate` event type
  * `repos/domain/src/types/ws.types.ts` — progress update and approval event types
  * `repos/admin/src/` — approval queue UI, agent activity dashboard

---

## Batch 7 — Storage Chain (3 tasks, sequential dependency)

Hard dependency chain — each builds on the previous. Can run in parallel with Batches 1-5. Has overlap with Batch 6 on `agent/tools/tools.ts` (RAG adds `searchKnowledge`, memory adds `remember`/`recall`/`forget`).

### Task 1: [P3] S3-compatible object storage — investigate and integrate *(run first)*

* **Repos**: backend, database, deploy
* All file storage is currently inline in PostgreSQL (Neon). Uploaded files (25MB max) are base64-encoded into JSONB `meta` columns on the `assets` table. Agent artifacts are ephemeral (memory-only, not persisted). Sandbox VFS is in-memory with no persistence. No cloud storage dependencies exist anywhere in the codebase (no AWS SDK, MinIO, GCS, etc.). No CDN, no backup scripts, no persistent volumes in K8s
* This approach works at small scale but will hit pain points: DB bloat from binary data in JSONB, Neon storage quotas, slow queries on large `meta` objects, no artifact persistence, no sandbox state snapshots, no static asset CDN
* **Investigation needed — provider options**:
  * **Managed S3** (AWS S3, Cloudflare R2, Backblaze B2): Zero ops, pay-per-use, S3-compatible API. R2 has no egress fees. Best for production with minimal infrastructure overhead
  * **Self-hosted MinIO**: S3-compatible, deploys as a K8s pod alongside existing services. Full control, no external dependency, free. Adds ops burden (storage provisioning, backup, monitoring). Good fit since we already run K8s
  * **Neon Blob/Large Object**: PostgreSQL large objects or TOAST — avoids new infra but still limited by DB constraints. Not recommended for binary assets
  * **Supabase Storage**: S3 wrapper with built-in auth policies. Adds external dependency but handles access control
* **Use cases for object storage**:
  * **File uploads**: Move binary data out of DB `meta.imageData` / `meta.extractedText` to S3, keep metadata + S3 key in DB. Pre-signed URLs for download
  * **Agent artifacts**: Persist rendered artifacts (HTML, SVG, code) to S3 instead of discarding after session. Link back to thread/message via asset record
  * **Backups**: Database dumps, config snapshots, audit logs archived to S3 with lifecycle policies (30/90-day retention, glacier tier)
  * **Sandbox VFS snapshots**: Serialize sandbox `InMemoryFs` state to S3 for persistence across sessions — enables "resume where I left off" for agents. Key enabler for autonomous agent workflows
  * **Admin SPA static assets**: Production builds uploaded to S3 + CDN (CloudFront/Cloudflare) for edge delivery instead of serving from K8s pod
* **Fix** (implementation plan once provider is chosen):
  1. Add S3 client library (`@aws-sdk/client-s3` or `minio` — both speak S3 protocol) as a dependency in `repos/backend`
  2. Create a storage service (`repos/backend/src/services/storage/`) that abstracts S3 operations: `upload(key, data, contentType)`, `download(key)`, `delete(key)`, `getSignedUrl(key, expiresIn)`, `list(prefix)`. Use interface so provider can be swapped
  3. Update `assets` schema — add `storageKey` (S3 object key), `storageBucket`, `storageProvider` columns. Keep `url` for backward compat (can point to signed URL or inline data)
  4. Migrate file upload flow (`repos/backend/src/endpoints/threads/uploadFile.ts`): upload binary to S3, store S3 key in asset record, remove inline base64 from `meta`
  5. Update file download/access: generate pre-signed URLs with expiry (15 min default), pass to agents and admin UI
  6. Add artifact persistence: when `createArtifact` tool produces output, store to S3 and create asset record linked to the thread
  7. If self-hosting MinIO: add Helm chart/values for MinIO pod deployment, PVC for storage, K8s service, configure via `values.yaml` (`storage.endpoint`, `storage.accessKey`, `storage.secretKey`, `storage.bucket`)
  8. Configuration: S3 endpoint, credentials, bucket name, region loaded via existing `@keg-hub/parse-config` from `deploy/values.*.yaml`
* **Key considerations**:
  * MinIO is the simplest path for dev/local — single binary, S3-compatible, runs in existing K8s cluster. Production could swap to R2/S3 by changing endpoint config
  * Pre-signed URLs keep auth simple — no need to proxy downloads through backend, but URLs must be short-lived (15 min) to prevent link sharing
  * Migration: existing inline assets need a one-time migration script to extract from DB and upload to S3
  * The storage service interface should be provider-agnostic — `IStorageService` with `S3StorageService` and `LocalStorageService` (for tests) implementations
  * Sandbox VFS snapshots could be large (depending on cloned repos) — set per-org storage quotas
* **Files**:
  * New: `repos/backend/src/services/storage/` — `IStorageService` interface, `S3StorageService` implementation
  * `repos/backend/src/endpoints/threads/uploadFile.ts` — upload to S3 instead of inlining in DB
  * `repos/database/src/schemas/assets.ts` — add `storageKey`, `storageBucket` columns
  * `repos/agent/src/tools/tools.ts` — update `createArtifact` to persist via storage service
  * `deploy/values.yaml` — storage configuration (endpoint, bucket, credentials reference)
  * If MinIO: `deploy/templates/` — MinIO deployment, service, PVC Helm templates
  * New: migration script for existing inline assets to S3

### Task 2: [P3] RAG system — retrieval-augmented generation for AI context enrichment *(after S3)*

* **Repos**: backend, database, agent, domain, admin
* No RAG infrastructure exists. Thread messages, artifacts, uploaded files, and external documents are not indexed or searchable by semantic similarity. Agents have no way to pull in relevant context beyond their current conversation history. This system serves two purposes: (1) long-term memory infrastructure for agents (the "Agent long-term memory" task builds tools on top of this), and (2) a way to add external context to any AI interaction — users or agents can attach knowledge sources that get automatically retrieved and injected into prompts
* Depends on: S3-compatible object storage (Task 1) for storing raw source documents. Can start with DB-only for small content, but S3 needed for files/artifacts at scale
* **Content sources to index**:
  * **Thread messages**: Agent and user messages from conversation history. Enables "what did we discuss about X?" across threads
  * **Artifacts**: Persisted agent outputs (HTML, SVG, code, reports). Enables reuse of prior work
  * **Uploaded files**: PDFs, DOCX, text files uploaded to threads. Currently extracted text is stored inline in DB `meta.extractedText` (50KB limit) — RAG should chunk and embed the full extracted content
  * **External documents**: User-provided knowledge base documents (markdown, text, code). Uploaded via admin UI or API, indexed for retrieval. Scoped to org/project/agent
  * **Agent memories**: Discrete facts stored by agents via `remember` tool (from the memory task). Stored as indexed chunks with category metadata
* **Fix**:
  1. **Vector store**: Enable `pgvector` extension in Neon (supported natively). Add an `embeddings` table — `id`, `sourceType` (message/artifact/file/document/memory), `sourceId`, `orgId`, `projectId`, `agentId` (nullable scope filters), `chunkIndex`, `chunkText`, `embedding` (vector(1536) for OpenAI ada-002 or vector(768) for smaller models), `metadata` (JSON — filename, category, tags), `createdAt`
  2. **Chunking pipeline**: Create a chunking service that splits content into overlapping chunks (default 512 tokens, 64 token overlap). Support different strategies per content type: recursive text splitting for documents, message-boundary splitting for threads (keep individual messages as chunks when short enough), code-aware splitting for code artifacts
  3. **Embedding pipeline**: Create an embedding service that generates vectors for chunks. Use the existing provider system — call the org's configured AI provider with an embedding model (e.g., `text-embedding-3-small` via OpenAI-compatible API). Queue-based processing for bulk indexing (don't block upload/message creation). Batch embeddings (up to 100 chunks per API call) for efficiency
  4. **Automatic indexing triggers**: Index content automatically when created — hook into message persistence (after agent turn), file upload endpoint, artifact creation. Use async processing (queue or background job) to avoid blocking the request path
  5. **Retrieval service**: Semantic search via cosine similarity (`<=>` operator in pgvector). Accept query text, embed it, search top-K nearest chunks with scope filtering (orgId, projectId, agentId). Return ranked chunks with source metadata and relevance score. Support hybrid search: vector similarity + keyword matching (pg full-text search) for better precision
  6. **Context injection**: Before each agent turn, run a retrieval query against the user's prompt. Inject top-K relevant chunks into the system prompt or as a separate context block. Configurable per agent: enable/disable RAG, set max context tokens for RAG results, configure which content sources to search
  7. **Agent search tool**: Add a `searchKnowledge` agent tool that lets the AI explicitly query the RAG system on-demand. Accepts a query string, optional scope filters (sourceType, projectId, tags), and top-K limit. Returns ranked chunks with source metadata. This complements automatic context injection — auto-injection handles the common case (relevant context for the current prompt), while the tool lets the agent pull in additional context when it decides it needs more information mid-task
  8. **Admin UI — knowledge management**: Add a "Knowledge Base" section to the org/project dashboard. Upload documents (drag-and-drop), view indexed content, delete sources, see indexing status. Show which content sources are enabled for each agent
  9. **API endpoints**: `POST /_/knowledge/documents` (upload + index), `GET /_/knowledge/documents` (list), `DELETE /_/knowledge/documents/:id` (remove + delete embeddings), `POST /_/knowledge/search` (semantic search — for debugging/testing), `GET /_/knowledge/status` (indexing queue status)
* **Key considerations**:
  * pgvector in Neon supports HNSW and IVFFlat indexes — use HNSW for better recall at the cost of slightly more memory. Create index after initial bulk import for efficiency
  * Embedding model choice affects vector dimensions and cost. Start with a small/cheap model (e.g., `text-embedding-3-small` at 1536 dims) and make it configurable per org via provider settings
  * Chunk overlap prevents losing context at chunk boundaries — 64 tokens is a good default
  * Scope filtering is critical — an agent should only retrieve content it has access to (same org, optionally same project/agent). Use WHERE clauses on orgId/projectId/agentId, not post-filtering
  * Re-indexing: when a document is updated, delete old embeddings and re-chunk/re-embed. Use `sourceId + sourceType` as the key for cleanup
  * Cost control: embedding API calls cost money. Track embedding token usage alongside LLM usage (from the cost tracking task). Set quotas on indexed content per org
  * The retrieval service is the shared infrastructure that both the agent memory task (`recall` tool) and the broader RAG context injection use — design it as a reusable service, not agent-specific
  * For thread messages, don't index every message immediately — batch-index at thread close or on a schedule to avoid overhead during active conversations
* **Files**:
  * New: `repos/backend/src/services/rag/` — chunking service, embedding service, retrieval service, indexing queue
  * New: `repos/database/src/schemas/embeddings.ts` — embeddings table with pgvector column
  * New: `repos/database/src/services/embedding.ts` — embedding CRUD + vector search queries
  * New: `repos/backend/src/endpoints/knowledge/` — document upload, search, status endpoints
  * `repos/backend/src/endpoints/threads/uploadFile.ts` — trigger async indexing after file upload
  * `repos/backend/src/services/websocket/websocket.ts` — trigger async indexing after message persistence
  * `repos/agent/src/runner/runner.ts` — RAG context injection before each turn
  * `repos/agent/src/tools/definitions/knowledge/` — `searchKnowledge` tool definition
  * `repos/agent/src/tools/tools.ts` — `searchKnowledge` tool implementation, `createArtifact` triggers async indexing
  * `repos/domain/src/types/` — RAG types (chunk, embedding, search result, indexing status)
  * `repos/admin/src/pages/` — Knowledge Base management page
  * `repos/database/src/schemas/schemas.ts` — register embeddings table, enable pgvector extension

### Task 3: [P3] Agent long-term memory and knowledge persistence *(after RAG)*

* **Repos**: agent, backend
* Context compaction is lossy, and agents have no memory across sessions. Agents need to recall architectural decisions, past failures, codebase patterns, and learned rules across runs
* Depends on: RAG system (Task 2) provides the vector storage, embedding pipeline, and search infrastructure. This task builds the agent-facing tools on top of it
* **Fix**:
  1. Add agent tools: `remember` (store a discrete memory — decision, pattern, rule, failure), `recall` (semantic search over agent memories + RAG-indexed content), `forget` (delete a memory)
  2. `remember` stores content via the RAG indexing pipeline — chunk, embed, store with agent/org/project scope and category metadata
  3. `recall` queries the RAG vector store with scope filtering (agent-specific memories first, then org/project knowledge base, then broader indexed content)
  4. Auto-inject relevant memories into agent context at turn start — run a recall query against the current prompt and prepend top-K results to system prompt
  5. Add a project-level knowledge base — structured documents (like CLAUDE.md) that agents can read and update, indexed through RAG with a `knowledge_base` category
* **Files**:
  * `repos/agent/src/tools/definitions/memory/` — `remember`, `recall`, `forget` tool definitions
  * `repos/agent/src/tools/tools.ts` — memory tool implementations (delegate to RAG service)
  * `repos/agent/src/runner/runner.ts` — auto-inject recalled memories at turn start
  * `repos/backend/src/endpoints/agents/agentMemories.ts` — memory CRUD endpoints (thin wrapper over RAG service with agent scope)

---

## Deferred Items

### [P4] Sandbox: Pool process exit cleanup

* **Repos**: sandbox
* **Key files**: `repos/sandbox/src/local.ts`
* The sandbox pool (`LocalSandboxProvider`) has no SIGTERM handler to drain idle sandboxes on process exit. V8 cleans up on exit so this is low risk, but a graceful shutdown handler would be cleaner
* **Fix**: Add a process exit handler that calls `close()` on all idle pool sandboxes
* **Files**: `repos/sandbox/src/local.ts`


### [P3] REPL: `FileRequest` and `FileChanged` events — unimplemented stubs (Phase 8 placeholder)

* `repos/repl/src/services/executor.ts` lines 143-147: both are empty `break` stubs
* The backend also has them as stubs — `wsHandler.ts` "Phase 8 — workspace file sync (placeholder)"
* These events are defined in `repos/domain/src/types/ws.types.ts` (lines 17-18) as `TWSFileRequestMsg` and `TWSFileChangedMsg` under the `// Server to Client` section
* No fix needed until the backend implements the workspace file sync feature. The empty stubs are correct placeholders
* **Fix**: No action required — track as future feature when backend Phase 8 is implemented
* **Files**: `repos/repl/src/services/executor.ts` (stubs), `repos/backend/src/endpoints/ai/wsHandler.ts` (stubs)
