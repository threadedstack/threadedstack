## TASKS

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


## Fully Independent (all run in parallel)

These tasks touch completely different files with zero overlap. All can run in Wave 1.


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



## Agent Autonomous Tools (8 tasks, HIGH overlap on `agent/tools/tools.ts`)

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

## Storage Chain (3 tasks, sequential dependency)

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

## Admin

### [P2] Login page: replace MUI TextField with TextInput from @tdsk/components

* **Repos**: admin, components
* **Key files**: `repos/admin/src/components/Login/EmailLoginForm.tsx`
* The email input (lines 53-63) and password input (lines 65-75) use MUI `TextField` directly. The project has a custom `TextInput` component at `repos/components/src/components/Inputs/TextInput.tsx` (wraps MUI `OutlinedInput` with consistent styling and `Textarea` support). All form inputs should use the shared component for UI consistency
* **Fix**:
  1. Replace the two MUI `TextField` components in `EmailLoginForm.tsx` with `TextInput` from `@tdsk/components`
  2. Map existing props (`type`, `label`, `size`, `value`, `onChange`) to the `TextInput` prop interface (`TTextInput` type, lines 14-31 of `TextInput.tsx`)
  3. Remove MUI `TextField` import if no longer used
* **Files**:
  * `repos/admin/src/components/Login/EmailLoginForm.tsx` — replace TextField with TextInput
  * `repos/components/src/components/Inputs/TextInput.tsx` — reference for prop interface

### [P1] Login page: light theme mode renders as dark — hardcoded colors throughout

* **Repos**: admin
* **Key files**: `repos/admin/src/components/Login/Login.styles.tsx`
* The Login page has 10+ hardcoded dark-mode colors with no light theme adaptation. In light theme, text is invisible (white on white) and backgrounds are forced dark. The page-level wrapper (`repos/admin/src/pages/Login/Login.styles.tsx:11`) correctly uses `theme.palette.background.default`, but all component-level styles ignore the theme. Should align with the website Hero component's light theme approach
* **Hardcoded dark-only styles**:
  * Line 18: `background-color: ${grey[900]}` — container always dark
  * Line 70: `color: rgba(255, 255, 255, 0.5)` — BrandSubtitle white text
  * Line 252: `.MuiInputBase-root { color: rgba(255, 255, 255, 0.87) }` — form input white text
  * Line 255: `.MuiOutlinedInput-notchedOutline { border-color: rgba(255, 255, 255, 0.2) }` — white border
  * Line 264: `.MuiInputLabel-root { color: rgba(255, 255, 255, 0.5) }` — white label
  * Line 270: `.MuiTypography-root { color: rgba(255, 255, 255, 0.5) }` — white text
  * Line 241: ErrorText `color: rgba(255, 255, 255, 0.6)` — white error text
  * Lines 28-30: BrandGlow gradients dark-only
  * Lines 38: BrandBlob dark-only gradients
* **Fix**:
  1. Replace all hardcoded `rgba(255, 255, 255, *)` values with theme-aware tokens (`theme.palette.text.primary`, `theme.palette.text.secondary`, `theme.palette.divider`, etc.)
  2. Make `LoginContainer` background use `theme.palette.background.default` instead of `grey[900]`
  3. Add `isDark` conditional styling for BrandGlow, BrandBlob, and BrandHeadline gradient — reference `repos/website/src/components/Landing/Hero.tsx` lines 44-46, 69-71 for the pattern
  4. Ensure ErrorText, form labels, inputs, and borders all adapt to light/dark theme
* **Files**:
  * `repos/admin/src/components/Login/Login.styles.tsx` — replace all hardcoded colors with theme-aware values

### [P2] Login page: background blobs should animate like website Hero component

* **Repos**: admin
* **Key files**: `repos/admin/src/components/Login/Login.styles.tsx` (lines 33-45, 72-93), `repos/website/src/components/Landing/Hero.tsx` (lines 37-85)
* The Login page blobs use a simple 3-point keyframe animation (`heroFloat`) with small ±20-30px movements. The website Hero uses richer 6-point keyframe animations (`heroFloat1`, `heroFloat2`) with larger ±100-250px movements and theme-aware gradient colors. The Login blobs should match the Hero's animation style
* **Differences**: Admin uses 3 keyframe points (0%, 33%, 66%) with 20-30px range; Hero uses 6 keyframe points (0%, 15%, 35%, 55%, 75%, 100%) with 100-250px range. Hero has theme-aware blob colors, Admin does not
* **Fix**:
  1. Replace the `heroFloat` keyframe animation in `Login.styles.tsx` (lines 40-44) with the `heroFloat1` and `heroFloat2` animations from `Hero.tsx` (lines 51-83)
  2. Update the two blob instances (lines 72-93) to use the new animations with matching durations (18s, 22s)
  3. Add `isDark` conditional gradient colors matching the Hero pattern (lines 44-46, 69-71)
* **Files**:
  * `repos/admin/src/components/Login/Login.styles.tsx` — update keyframe animations and blob styles

### [P2] AgentDrawer: extract Web Provider settings into standalone component

* **Repos**: admin
* **Key files**: `repos/admin/src/components/Agents/AgentDrawer.tsx`
* The AgentDrawer component contains inline Web Provider settings UI (lines 544-594) with associated state (lines 78-79), data population (lines 214-216), reset logic (lines 237-238), and environment building (lines 279-286). This should be extracted into its own component following the existing pattern of `BasicInfoForm`, `ModelConfigForm`, and `AgentSettingsForm`
* **Fix**:
  1. Create `repos/admin/src/components/Agents/WebProviderSettings.tsx` with props: `webProviderType`, `webProviderSecretId`, `secretsList`, `loading`, `onWebProviderTypeChange`, `onWebProviderSecretIdChange`
  2. Move the JSX from AgentDrawer lines 544-594 (Autocomplete for provider type + conditional Autocomplete for secret) into the new component
  3. Import `TWebProviderBrand` from `@tdsk/domain` (defined at `repos/domain/src/types/ai.types.ts` lines 146-150)
  4. Replace the inline JSX in AgentDrawer with `<WebProviderSettings ... />` call
  5. Export from `repos/admin/src/components/Agents/index.ts`
* **Files**:
  * New: `repos/admin/src/components/Agents/WebProviderSettings.tsx` — extracted component
  * `repos/admin/src/components/Agents/AgentDrawer.tsx` — replace inline code with component usage
  * `repos/admin/src/components/Agents/index.ts` — add export

### [P2] Quick Start Drawer: normalize styles to match other admin drawers

* **Repos**: admin
* **Key files**: `repos/admin/src/components/Quickstart/QuickstartWizard.tsx`, `repos/admin/src/components/Quickstart/ReviewStep.tsx`, `repos/admin/src/components/Quickstart/ProviderStep.tsx`, `repos/admin/src/components/Quickstart/AgentStep.tsx`
* The Quick Start Drawer has multiple style inconsistencies compared to other admin drawers (AgentDrawer, ProjectDrawer, EndpointDrawer, SecretDrawer, ProviderDrawer). These need to be normalized so the application has a consistent look and feel
* **Inconsistencies found**:
  * **Hardcoded hex colors in ReviewStep** (lines 90, 102, 109, 116, 127): Uses raw hex (`#3370DE`, `#D97706`, `#059669`, `#7C3AED`, `#E11D48`) for resource icon colors instead of theme palette tokens — breaks theme consistency and dark mode
  * **Icon container size mismatch**: ProviderStep/AgentStep use 28x28 `SectionIcon`, but ReviewStep uses 30x30 `ResourceIcon` — should be uniform
  * **Mixed `Text` vs `Typography`**: ReviewStep and AgentStep import `Text` from `@tdsk/components`, but ProviderStep and all other drawers use MUI `Typography` directly — should be consistent
  * **Section header `letterSpacing`**: ProviderStep (line 120), AgentStep (line 74), and ReviewStep add `letterSpacing: '0.02em'` to `subtitle2` headers, but no other drawer does this (e.g., AgentDrawer line 452 uses just `fontWeight: 600, mb: 2`)
  * **Form section spacing**: QuickStart steps use `gap: 2.5` and `padding: 2.5` (`ConfigSection` in ProviderStep line 84-85, `FormSection` in AgentStep line 35-36), while other drawers use `gap: 2` (ProjectDrawer, EndpointDrawer, SecretDrawer) or `Stack spacing={3}` (AgentDrawer)
  * **Custom collapsible toggle**: AgentStep (lines 42-53) builds a custom `AdvancedToggle` with manual rotation animation, while ProviderDrawer uses standard MUI `Accordion`/`AccordionSummary` which handles expansion automatically
  * **Hardcoded `minHeight: 200`**: QuickstartWizard `StepContent` (line 58) uses a hardcoded pixel value — no other drawer does this
  * **Stepper font size**: QuickstartWizard `WizardStepper` (line 20) hardcodes `fontSize: 0.75rem` instead of using a Typography variant
  * **Duplicate styled components**: `SectionHeader` and `SectionIcon` are duplicated identically in ProviderStep (lines 21-37) and AgentStep (lines 14-27) — should be shared
* **Fix**:
  1. Replace all hardcoded hex colors in `ReviewStep.tsx` (lines 90, 102, 109, 116, 127) with theme palette tokens (e.g., `theme.palette.primary.main`, `theme.palette.warning.main`, `theme.palette.success.main`, `theme.palette.secondary.main`, `theme.palette.error.main`)
  2. Normalize icon container size to 28x28 across all steps — update `ResourceIcon` in ReviewStep (line 50) from 30 to 28
  3. Pick one text component and use it consistently — either `Typography` (matching other drawers) or `Text` from `@tdsk/components`, but not both. Recommended: use `Typography` to match the rest of the admin app
  4. Remove `letterSpacing: '0.02em'` from section headers in ProviderStep, AgentStep, and ReviewStep to match AgentDrawer's simpler `fontWeight: 600, mb: 2` pattern
  5. Normalize form section spacing to `gap: 2` (matching ProjectDrawer, EndpointDrawer, SecretDrawer) and remove the extra `padding: 2.5` — use the drawer's default padding instead
  6. Replace the custom `AdvancedToggle` in AgentStep with standard MUI `Accordion`/`AccordionSummary` to match ProviderDrawer's pattern
  7. Remove hardcoded `minHeight: 200` from `StepContent` — let content flow naturally
  8. Replace hardcoded `fontSize: 0.75rem` in `WizardStepper` with a MUI Typography variant (e.g., `caption`)
  9. Extract shared `SectionHeader` and `SectionIcon` styled components into a shared file (e.g., `repos/admin/src/components/Quickstart/Quickstart.styles.tsx`) and import in both ProviderStep and AgentStep
* **Files**:
  * `repos/admin/src/components/Quickstart/ReviewStep.tsx` — replace hex colors with theme tokens, normalize icon size, fix Text vs Typography
  * `repos/admin/src/components/Quickstart/ProviderStep.tsx` — remove letterSpacing, normalize spacing, extract shared styles
  * `repos/admin/src/components/Quickstart/AgentStep.tsx` — replace custom toggle with MUI Accordion, remove letterSpacing, normalize spacing, fix Text vs Typography, extract shared styles
  * `repos/admin/src/components/Quickstart/QuickstartWizard.tsx` — remove hardcoded minHeight and fontSize
  * New: `repos/admin/src/components/Quickstart/Quickstart.styles.tsx` — shared styled components (SectionHeader, SectionIcon)

### [P2] Project Endpoints Table — missing table footer (pagination)

* **Repos**: admin
* **Key files**: `repos/admin/src/components/Endpoints/EndpointsTable.tsx` (lines 48-139)
* The `EndpointsTable` component renders all endpoints using raw MUI `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell` components with no pagination. Every other table in the admin app uses the shared `DataTable` component (`repos/admin/src/components/DataTable/DataTable.tsx`) which includes built-in `TablePagination` (lines 105-113) with rows-per-page selector (5, 10, 25, 50) and page navigation. The EndpointsTable is the only table missing this footer
* **Fix**:
  1. Refactor `EndpointsTable` to use the shared `DataTable` component instead of raw MUI Table components — this matches the pattern used by `ProjectApiKeys`, `Domains`, `Secrets`, `Providers`, `Functions`, `Sandboxes`, and all other list views
  2. Define column definitions as `TDataTableColumn<Endpoint>[]` — map existing inline cell rendering (edit icon, endpoint type chip, visibility icon, delete button) into column `render` functions
  3. Move delete confirmation logic to an Actions column renderer, keeping the existing `ConfirmDelete` modal
  4. Remove ~90 lines of custom Table JSX that `DataTable` handles automatically
* **Files**:
  * `repos/admin/src/components/Endpoints/EndpointsTable.tsx` — refactor from raw MUI Table to DataTable component
  * `repos/admin/src/components/DataTable/DataTable.tsx` — reference for column definition format and pagination behavior

### [P1] Project API Keys — user selector not appearing in create drawer

* **Repos**: admin
* **Key files**: `repos/admin/src/pages/Projects/ProjectApiKeys.tsx` (lines 38-72, 304-311), `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` (lines 226-234)
* The `CreateApiKeyDrawer` supports a `users` prop and conditionally renders a `UserSelectorSingle` component when `!userId && users && users.length > 0` (line 226). The Org API Keys page (`OrgApiKeys.tsx`) passes `users={orgUsers}` derived from Jotai state (loaded eagerly via `listOrgUsers`), and the selector works. The Project API Keys page also passes `users={projectUsers}` (line 308), but the `projectUsers` state relies on an async `useEffect` (lines 42-72) that calls both `listProjectMembers` and `listOrgUsers` in parallel. If either call returns no data, or the member-to-user mapping fails, `projectUsers` remains an empty array and the selector never renders. The backend fully supports `userId` on project-scoped API keys (createApiKey.ts lines 54-100) with project member validation
* **Fix**:
  1. Debug the `loadUsers` effect in `ProjectApiKeys.tsx` (lines 46-68) — verify `listProjectMembers` returns members with valid `userId` values and `listOrgUsers` returns matching user data
  2. Add error handling to the `loadUsers` effect — currently failures are silently swallowed (no catch/error state)
  3. Consider loading project users eagerly via Jotai state (like `OrgApiKeys` does with `useOrgUsers()`) instead of local `useState` to ensure data is available before the drawer opens
  4. Verify the user selector renders correctly and the selected `userId` is submitted in the API key creation request
* **Files**:
  * `repos/admin/src/pages/Projects/ProjectApiKeys.tsx` — fix user loading logic (lines 42-72) and ensure `projectUsers` is populated
  * `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` — verify selector rendering condition (line 226)
  * `repos/admin/src/actions/projectMembers/` — verify `listProjectMembers` action returns expected data

### [P1] Project Members — displays "Unknown" instead of member names

* **Repos**: admin, backend, database
* **Key files**: `repos/admin/src/pages/Projects/ProjectMembers.tsx` (lines 85-99, 179)
* The Project Members page renders `{member.displayName || 'Unknown'}` (line 179). The `displayName` is computed in a `useMemo` (lines 85-99) that maps project roles to org user data: it builds a `userMap` from `orgUsers` (Jotai state) and looks up each role's `userId`. When `orgUsers` hasn't been loaded or doesn't contain the project member's user ID, `userMap.get(role.userId)` returns `undefined` and `displayName` falls back to `undefined`, rendering "Unknown". The root cause is a data join issue — `listProjectMembers` (backend: `repos/backend/src/endpoints/projects/listProjectMembers.ts` lines 25-28) returns only Role objects (`userId`, `type`, `projectId`) with no user details, and the frontend depends on separately-fetched org users being present. Compare with the Org Users endpoint (`listUsers.ts` lines 35-54) which explicitly joins roles with user data server-side
* **Fix**:
  1. **Option A (backend fix, recommended)**: Enrich the `listProjectMembers` endpoint to join Role data with User data (name, email) — follow the pattern in `listUsers.ts` lines 37-51 where `getOrgMembers` roles are enriched via `db.services.user.getByIds(userIds)`
  2. **Option B (frontend fix)**: Ensure `orgUsers` is loaded before rendering project members — add a `useEffect` that calls `listOrgUsers(orgId)` when the component mounts, similar to `OrgApiKeys.tsx` line 49-52
  3. If going with Option A, update `repos/database/src/services/role.ts` `getProjectMembers()` method (lines 107-121) to include a user table join, or add a new enriched method
  4. Update the frontend to handle the enriched response format
* **Files**:
  * `repos/admin/src/pages/Projects/ProjectMembers.tsx` — displays "Unknown" fallback (line 179), data merge logic (lines 85-99)
  * `repos/backend/src/endpoints/projects/listProjectMembers.ts` — returns Role-only data (lines 25-28)
  * `repos/database/src/services/role.ts` — `getProjectMembers()` has no user join (lines 107-121)
  * `repos/backend/src/endpoints/users/listUsers.ts` — reference for enriched pattern (lines 35-54)

---

## Backend

### [P3] OpenAI-compatible streaming for Agent endpoints

* **Repos**: backend, agent, domain, integration
* **Key files**: `repos/backend/src/services/endpoints/agentEndpoint.ts` (lines 189-253), `repos/agent/src/adapters/eventBridge.ts` (lines 31-130), `repos/domain/src/types/ai.types.ts`
* Agent endpoints (`POST /agents/:id/run`) stream responses via SSE using a custom ThreadedStack event format: `data: {"type":"text","text":"Hello"}\n\n` with types `text`, `thinking`, `tool_call_start`, `tool_call_args`, `tool_result`, `done`, `turn_end`, `error`. The OpenAI Chat Completions streaming format (`POST /v1/chat/completions` with `stream: true`) is the de facto standard — events use `data: {"id":"chatcmpl-XXX","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n\n`. Many AI products support the `openai` npm package against their APIs. ThreadedStack should offer the same compatibility so users can interact with their custom Agent endpoints using the standard OpenAI client SDK
* **Current format** (ThreadedStack native): `{type, text/thinking/id/name/args/...}` — 9 event types in `EStreamEventType` enum
* **Target format** (OpenAI compatible): `{id, object, created, model, choices: [{index, delta: {content/tool_calls}, finish_reason}]}` with `data: [DONE]` terminator
* **Fix**:
  1. Add a format parameter to agent endpoint options (e.g., `format: 'openai' | 'native'`) — could be a query parameter (`?format=openai`), request body field, or endpoint configuration option in admin
  2. Create an OpenAI response transformer module that maps ThreadedStack `TStreamEvent` objects to OpenAI `chat.completion.chunk` format:
     - `text` → `choices[0].delta.content`
     - `tool_call_start` + `tool_call_args` → `choices[0].delta.tool_calls[{index, id, type, function: {name, arguments}}]`
     - `done` → `choices[0].finish_reason` ("stop" | "tool_calls")
     - `turn_end` → optional `usage` object in final chunk
  3. Update the SSE write logic in `agentEndpoint.ts` (line 234: `res.write('data: ' + JSON.stringify(event) + '\n\n')`) to conditionally apply the transformer
  4. Add the `model` field to agent responses (can use the agent's configured model name)
  5. Generate unique `chatcmpl-*` IDs for each response stream
  6. Add integration tests validating the OpenAI format with the `openai` npm package
* **Files**:
  * `repos/backend/src/services/endpoints/agentEndpoint.ts` — SSE write logic, format selection (lines 189-253)
  * New: `repos/backend/src/services/endpoints/openaiTransformer.ts` — event format transformer
  * `repos/domain/src/types/ai.types.ts` — `EStreamEventType` enum and `TStreamEvent` types (reference)
  * `repos/domain/src/types/epd.types.ts` — `TAgentEndpointConfig` type — add format option (lines 154-181)
  * `repos/agent/src/adapters/eventBridge.ts` — `mapAgentEvent()` function (reference for event mapping)
  * `repos/backend/src/endpoints/agents/runAgent.ts` — agent run route handler (lines 1-40)
  * `repos/integration/src/utils/sse.ts` — SSE test parser — add OpenAI format support
  * New: `repos/integration/src/tier3/openai-compat.test.ts` — OpenAI compatibility integration tests

---

## Website

### [P2] Header: title text styling does not match admin app

* **Repos**: website, admin (reference)
* **Key files**: `repos/website/src/components/Header/Header.tsx` (lines 47-68), `repos/admin/src/components/Sidebar/SBLogo.tsx`, `repos/admin/src/components/Sidebar/Sidebar.styles.tsx` (lines 51-60)
* The website header uses Typography variant `subtitle1` (~16px) with a gradient text effect in dark mode (`gradient-text-dark` class from `GlobalStyles.tsx` lines 70-75) and plain text in light mode. The admin header uses Typography variant `h6` (18px) with `letterSpacing: -1px`, plain `text.primary` color, and 28x28px icon with `colors.primary.main` fill. The website should match the admin's sizing, spacing, and color approach
* **Fix**:
  1. Change Typography variant from `subtitle1` to `h6` in `Header.tsx` line 59
  2. Add `letterSpacing: '-1px'` and `fontSize: '18px'` to match admin `Sidebar.styles.tsx` lines 53-54
  3. Change icon size from 24x24 to 28x28 and apply `colors.primary.main` fill (line 51)
  4. Remove the `gradient-text-dark` class usage — use `color: text.primary` to match admin
* **Files**:
  * `repos/website/src/components/Header/Header.tsx` — update title text variant, size, and styling
  * `repos/website/src/theme/GlobalStyles.tsx` — optionally remove unused `gradient-text-dark` class if no longer referenced

### [P3] Documentation: 19 missing content pages referenced in sidebar

* **Repos**: website
* **Key files**: `repos/website/src/components/Docs/DocsSidebar.tsx`, `repos/website/src/content/docs/`
* The docs sidebar references 25+ pages but only 6 MDX files exist. Missing pages: `getting-started/installation`, `concepts/projects`, `concepts/providers`, `concepts/endpoints`, `concepts/secrets`, `api-reference/organizations`, `api-reference/agents`, `api-reference/threads`, `websocket/connection`, `websocket/client-events`, `websocket/server-events`, `guides/admin-dashboard`, `guides/repl-cli`, `guides/self-hosting`, `changelog`
* Existing pages: `getting-started/introduction.mdx`, `getting-started/quick-start.mdx`, `concepts/agents.mdx`, `concepts/organizations.mdx`, `concepts/threads.mdx`, `api-reference/authentication.mdx`
* **Fix**:
  1. Create each missing MDX file under `repos/website/src/content/docs/` with proper frontmatter and content
  2. API reference pages should document endpoints, request/response schemas, and auth requirements
  3. WebSocket pages should document the connection protocol, client event types (`TWSClientMsg`), and server event types (`TWSServerMsg`) from `repos/domain/src/types/ws.types.ts`
  4. Guide pages should cover admin dashboard usage, REPL CLI commands, and self-hosting setup
* **Files**:
  * New: `repos/website/src/content/docs/getting-started/installation.mdx`
  * New: `repos/website/src/content/docs/concepts/projects.mdx`
  * New: `repos/website/src/content/docs/concepts/providers.mdx`
  * New: `repos/website/src/content/docs/concepts/endpoints.mdx`
  * New: `repos/website/src/content/docs/concepts/secrets.mdx`
  * New: `repos/website/src/content/docs/api-reference/organizations.mdx`
  * New: `repos/website/src/content/docs/api-reference/agents.mdx`
  * New: `repos/website/src/content/docs/api-reference/threads.mdx`
  * New: `repos/website/src/content/docs/websocket/connection.mdx`
  * New: `repos/website/src/content/docs/websocket/client-events.mdx`
  * New: `repos/website/src/content/docs/websocket/server-events.mdx`
  * New: `repos/website/src/content/docs/guides/admin-dashboard.mdx`
  * New: `repos/website/src/content/docs/guides/repl-cli.mdx`
  * New: `repos/website/src/content/docs/guides/self-hosting.mdx`
  * New: `repos/website/src/content/docs/changelog.mdx`

### [P2] Documentation: light theme inline `<code>` elements lack contrast

* **Repos**: website
* **Key files**: `repos/website/src/components/Docs/MDXComponents.tsx` (lines 81-97)
* Inline `<code>` elements use `bgcolor: 'action.hover'` (line 88) for background. In light theme, `action.hover` resolves to a near-white color that provides insufficient contrast against the white page background. The code elements don't stand out
* **Fix**:
  1. Replace `bgcolor: 'action.hover'` with a theme-aware value that provides visible contrast in both themes — e.g., `bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'` or use `grey[100]`/`grey[800]` per theme
  2. Consider adding a subtle border (`1px solid divider`) for additional visual separation in light mode
* **Files**:
  * `repos/website/src/components/Docs/MDXComponents.tsx` — update inline code background styling

### [P2] Documentation: markdown heading colors appear too purple

* **Repos**: website
* **Key files**: `repos/website/src/components/Docs/MDXComponents.tsx` (lines 14-33)
* Markdown h1/h2/h3 elements map to MUI Typography variants (h3, h4, h5) and inherit color from `MuiTypography` styleOverrides (`colors.primaryForeground`). If the heading colors appear too purple, the `primaryForeground` value or the Typography variant color needs adjustment toward a bluer tone
* **Fix**:
  1. Add explicit `color` prop to the heading Typography components in `MDXComponents.tsx` (lines 14-33) using a bluer shade — e.g., `color: 'text.primary'` or a specific blue value from the theme palette
  2. Alternatively, adjust the `primaryForeground` color in the theme if it skews purple
* **Files**:
  * `repos/website/src/components/Docs/MDXComponents.tsx` — adjust heading color
  * Possibly: `repos/components/src/theme/colors.ts` — if `primaryForeground` needs adjustment

### [P3] Documentation: add screenshots and flow images

* **Repos**: website
* The docs lack visual aids — no screenshots of the Admin web app or REPL CLI. Images would significantly improve documentation quality, especially for guides
* **Fix**:
  1. Capture screenshots of key Admin UI views using Playwright (login, org dashboard, agent config, chat view, project settings)
  2. Capture REPL CLI screenshots showing login, agent listing, chat interaction, slash commands
  3. Create flow diagrams showing common workflows (agent setup, chat interaction, API key creation)
  4. Add images to relevant MDX pages using standard markdown image syntax
  5. Store images in `repos/website/src/content/docs/images/` or `repos/website/public/docs/`
* **Files**:
  * New: `repos/website/public/docs/images/` — screenshot directory
  * Various MDX files — add image references

### [P1] "Get Started" buttons should link to admin login page

* **Repos**: website
* **Key files**: Multiple components with `Get Started` buttons
* All "Get Started" buttons link to `/docs/getting-started` (the docs page) instead of the admin app login page. Users clicking "Get Started" expect to sign up / log in, not read documentation
* **Locations**:
  * `repos/website/src/components/Landing/Hero.tsx` line 148: `href='/docs/getting-started'`
  * `repos/website/src/components/Landing/CTABanner.tsx` line 34: `to='/docs/getting-started'`
  * `repos/website/src/components/Header/Header.tsx` line 98: `to='/docs/getting-started'`
  * `repos/website/src/components/Header/MobileMenu.tsx` — same pattern
* **Fix**:
  1. Change all "Get Started" button links to point to the admin app login URL (e.g., `https://app.threadedstack.app` or the appropriate admin login route)
  2. Consider keeping a separate "Read Docs" link for users who want documentation
* **Files**:
  * `repos/website/src/components/Landing/Hero.tsx` — update href
  * `repos/website/src/components/Landing/CTABanner.tsx` — update `to` prop
  * `repos/website/src/components/Header/Header.tsx` — update `to` prop
  * `repos/website/src/components/Header/MobileMenu.tsx` — update `to` prop

### [P3] Add Contact and About pages with footer links

* **Repos**: website
* **Key files**: `repos/website/src/components/Footer/MarketingFooter.tsx` (lines 31-32)
* The footer has "About" and "Contact" links under the "Company" section, but both point to `#` (placeholder). No corresponding pages exist
* **Fix**:
  1. Create `repos/website/src/pages/About.tsx` — company info, mission, team
  2. Create `repos/website/src/pages/Contact.tsx` — contact form or contact info
  3. Add routes for `/about` and `/contact` in the website router
  4. Update `MarketingFooter.tsx` lines 31-32 to point to `/about` and `/contact` respectively
* **Files**:
  * New: `repos/website/src/pages/About.tsx` — About page
  * New: `repos/website/src/pages/Contact.tsx` — Contact page
  * `repos/website/src/components/Footer/MarketingFooter.tsx` — update link targets
  * Website router file — add routes

---

## General

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
