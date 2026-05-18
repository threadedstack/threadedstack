## TASKS

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


## Threads

_(All threads tasks completed — see audit at `.claude/plans/there-are-a-number-flickering-giraffe.md`)_

---

## Admin


---

## Backend

---

## Website

### [P3] Documentation: 19 missing content pages referenced in sidebar

* **Repos**: website
* **Key files**: `repos/website/src/components/Docs/DocsSidebar.tsx`, `repos/website/src/content/docs/`
* The docs sidebar references 25+ pages but only 6 MDX files exist. Missing pages: `getting-started/installation`, `concepts/projects`, `concepts/providers`, `concepts/endpoints`, `concepts/secrets`, `api-reference/organizations`, `api-reference/agents`, `api-reference/threads`, `websocket/connection`, `websocket/client-events`, `websocket/server-events`, `guides/admin-dashboard`, `guides/tsa-cli`, `guides/self-hosting`, `changelog`
* Existing pages: `getting-started/introduction.mdx`, `getting-started/quick-start.mdx`, `concepts/agents.mdx`, `concepts/organizations.mdx`, `concepts/threads.mdx`, `api-reference/authentication.mdx`
* **Fix**:
  1. Create each missing MDX file under `repos/website/src/content/docs/` with proper frontmatter and content
  2. API reference pages should document endpoints, request/response schemas, and auth requirements
  3. WebSocket pages should document the connection protocol, client event types (`TWSClientMsg`), and server event types (`TWSServerMsg`) from `repos/domain/src/types/ws.types.ts`
  4. Guide pages should cover admin dashboard usage, TSA CLI commands, and self-hosting setup
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
  * New: `repos/website/src/content/docs/guides/tsa-cli.mdx`
  * New: `repos/website/src/content/docs/guides/self-hosting.mdx`
  * New: `repos/website/src/content/docs/changelog.mdx`


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


### [P3] TSA: `FileRequest` and `FileChanged` events — unimplemented stubs (Phase 8 placeholder)

* `repos/tsa/src/services/executor.ts` lines 143-147: both are empty `break` stubs
* The backend also has them as stubs — `wsHandler.ts` "Phase 8 — workspace file sync (placeholder)"
* These events are defined in `repos/domain/src/types/ws.types.ts` (lines 17-18) as `TWSFileRequestMsg` and `TWSFileChangedMsg` under the `// Server to Client` section
* No fix needed until the backend implements the workspace file sync feature. The empty stubs are correct placeholders
* **Fix**: No action required — track as future feature when backend Phase 8 is implemented
* **Files**: `repos/tsa/src/services/executor.ts` (stubs), `repos/backend/src/endpoints/ai/wsHandler.ts` (stubs)


## Sandbox File Sync: Deferred Items

### [P3] Sandbox File Sync: `tsa cp` command for one-off file copy

* **Repos**: tsa
* **Key files**: New `repos/tsa/src/tasks/cp.ts`
* **Depends on**: Sandbox file sync v1 (tsa sync)
* One-off file copy in/out of sandbox via SCP over existing SSH tunnel. Complements `tsa sync` for cases where continuous sync is not needed — e.g., downloading build artifacts or uploading a single config file.
* **Implementation**:
  1. Add `tsa cp <local-path> <sandbox-id>:<remote-path>` for upload
  2. Add `tsa cp <sandbox-id>:<remote-path> <local-path>` for download
  3. Use SCP over existing `tsa proxy` ProxyCommand tunnel
  4. Support glob patterns for multi-file operations
* **Files**:
  * New: `repos/tsa/src/tasks/cp.ts` — copy task implementation

### [P3] Sandbox File Sync: Admin UI sync configuration panel

* **Repos**: admin, components
* **Key files**: New `repos/admin/src/components/Sandboxes/SyncDrawer.tsx`
* **Depends on**: Sandbox file sync v1 (tsa sync), syncDefaults API
* Sync configuration drawer in admin sandbox management — set sync direction, default ignores, target paths per sandbox. Uses existing `syncDefaults` JSONB field on sandbox records.
* **Implementation**:
  1. Create `SyncDrawer` component with accordion sections for general settings, ignore patterns (Monaco editor), and path configuration
  2. Add "Configure Sync" action button to sandbox table
  3. Add sync status column to sandbox table (reads from syncDefaults, not live status)
  4. Wire to existing `updateSandbox` API endpoint for saving syncDefaults
* **Files**:
  * New: `repos/admin/src/components/Sandboxes/SyncDrawer.tsx`
  * Modify: `repos/admin/src/components/Sandboxes/Sandboxes.tsx` — add sync column + action

### [P3] Sandbox File Sync: Threads app sync integration

* **Repos**: threads
* **Depends on**: Threads app baseline, sandbox file sync v1
* Sync controls in the Threads app for non-developer users. Scope TBD based on Threads app architecture once baseline is complete.

### [P3] Sandbox File Sync: Real-time sync status streaming

* **Repos**: backend, admin, threads
* **Depends on**: Admin UI sync config, Threads app sync
* Real-time sync status via WebSocket or SSE for UI consumers. Backend tracks sync session state and pushes updates to connected clients.

### [P3] Sandbox File Sync: MutagenClient GrpcDriver

* **Repos**: tsa
* **Key files**: New `repos/tsa/src/services/sync/grpcDriver.ts`
* **Depends on**: Sandbox file sync v1 stable
* Replace CliDriver with gRPC integration to Mutagen daemon for structured protobuf data and long-polling status updates. Compile Mutagen proto files to TypeScript, connect to daemon socket via `@grpc/grpc-js`.
* **Implementation**:
  1. Compile Mutagen proto files (`pkg/service/synchronization/synchronization.proto` and dependencies) to TypeScript
  2. Implement `GrpcDriver` class implementing `IMutagenClient` interface
  3. Connect to `~/.mutagen/daemon/daemon.sock` via `@grpc/grpc-js`
  4. Use `List` RPC with `previousStateIndex` for long-polling status updates
  5. Swap CliDriver for GrpcDriver in SyncManager (configuration-based selection)
* **Files**:
  * New: `repos/tsa/src/services/sync/grpcDriver.ts`
  * New: `repos/tsa/src/services/sync/proto/` — compiled proto definitions

### [P3] Sandbox File Sync: File browser UI

* **Repos**: admin, threads, backend
* **Depends on**: Admin UI sync config, Threads app sync
* Browse and download sandbox files from admin and Threads UIs. Uses existing `ISandbox.readFile/listDir` via a new backend endpoint or the existing exec endpoint.

### [P3] Sandbox File Sync: Sync session persistence

* **Repos**: backend, database, domain
* **Depends on**: GrpcDriver or sync status streaming
* Track active sync sessions in backend DB for cross-client visibility. Enables admin/Threads UIs to show which sandboxes have active sync sessions without querying the user's local Mutagen daemon.

