## TODO

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


### Admin

#### General

* **[P2] Search inputs should have white background in light-mode**
  * `SearchBar` (`repos/admin/src/components/SearchBar/SearchBar.tsx`) renders a `TextInput` without explicit background styling
  * The input inherits the default theme background, which blends into the page container
  * **Fix**: Add `sx={{ bgcolor: 'background.paper' }}` to the `TextInput` in `SearchBar.tsx`
  * **Files**: `repos/admin/src/components/SearchBar/SearchBar.tsx`

* **[P3] Create reusable Selector components**
  * Several entity selectors exist but aren't standardized:
    * `FunctionsSelector` — `repos/admin/src/components/Agents/FunctionsSelector.tsx`
    * `SecretsSelector` — `repos/admin/src/components/Agents/SecretsSelector.tsx`
    * `ToolsSelector` — `repos/admin/src/components/Agents/ToolsSelector.tsx`
  * All follow the same pattern (MUI Autocomplete, multiple selection, custom render option). Missing selectors: **ProviderSelector**, **AgentSelector**, **EndpointSelector**
  * **Fix**:
    1. Extract a generic `EntitySelector` base component with the common Autocomplete pattern
    2. Build missing selectors: `ProviderSelector`, `AgentSelector`, `EndpointSelector`
    3. Move selectors from `components/Agents/` to `components/Selectors/` for shared use
    4. Reuse across: AgentDrawer, EndpointDrawer (Agent type), ThreadsTab
  * **Files**:
    * New: `repos/admin/src/components/Selectors/EntitySelector.tsx`
    * New: `repos/admin/src/components/Selectors/ProviderSelector.tsx`
    * New: `repos/admin/src/components/Selectors/AgentSelector.tsx`
    * Refactor: Move `FunctionsSelector`, `SecretsSelector`, `ToolsSelector`

#### Project Agents — Chat

* **[P0] Chat input disabled after first message — `isStreaming` stuck at `true`**
  * `repos/admin/src/hooks/chat/useAgentChat.ts` line 46: `setIsStreaming(true)` is called when `sendMessage` starts
  * Line 43: `if (isStreaming || !prompt.trim()) return` blocks all subsequent sends
  * `setIsStreaming(false)` is only called in `ws.onclose` (line 110) and `ws.onerror` (line 115) — never on the `Done` event
  * Lines 173-175: the `EWSEventType.Done` case is an empty stub with comment "WS will close" — but the backend (`wsHandler.ts` line 218) sends `Done` and **never calls `ws.close()`**, so `onclose` never fires
  * `ChatView.tsx` line 218: `disabled={isStreaming}` keeps the TextField disabled; line 225: send button also disabled
  * **Fix**: Add `setIsStreaming(false)` in the `EWSEventType.Done` case of `processWSEvent` in `useAgentChat.ts`. Do NOT close the WebSocket — leave it open for multi-turn conversation within the same session
  * **Files**: `repos/admin/src/hooks/chat/useAgentChat.ts`

* **[P1] Past threads cannot be continued — no "Continue in Chat" action**
  * **ThreadsTab only navigates to Messages tab (read-only)**: `repos/admin/src/components/AI/ThreadsTab.tsx` lines 210-213 — `onViewThread` calls `setCurrentTab(EAgentThreadTab.messages)` which switches to the read-only Messages tab. No "Chat" or "Continue" action button exists
  * **ChatView never receives a threadId**: `repos/admin/src/components/AI/ChatView.tsx` lines 52-55 — `useAgentChat` is called without a `threadId` prop, so every session starts a new thread
  * **No thread history loading**: `useAgentChat.ts` line 33 initializes `messages` as an empty array. Even if `opts.threadId` is passed, the hook never fetches previous messages via `threadsApi.listMessages()`
  * **No route for chat+threadId**: The chat route `agents/:agentId/chat` (Routes.tsx line 180) has no threadId parameter — would need to use query param `?thread=<id>`
  * **Fix** (4 parts):
    1. In `ThreadsTab.tsx`, add a "Chat" icon button alongside View/Edit/Delete that navigates to `/orgs/:orgId/projects/:projectId/agents/:agentId/chat?thread=<threadId>`
    2. In `ChatView.tsx`, read `threadId` from `useSearchParams()` and pass it to `useAgentChat`
    3. In `useAgentChat.ts`, when `opts.threadId` is set on mount, call `threadsApi.listMessages()` and populate the `messages` state with mapped `TChatMessage[]` objects
    4. In `ProjectThreads.tsx`, add a `handleChatWithThread(threadId)` handler using the thread's `agentId`
  * **Files**:
    * `repos/admin/src/hooks/chat/useAgentChat.ts` — load history when threadId provided
    * `repos/admin/src/components/AI/ChatView.tsx` — read threadId from query params
    * `repos/admin/src/components/AI/ThreadsTab.tsx` — add "Continue in Chat" action button
    * `repos/admin/src/pages/Projects/ProjectThreads.tsx` — add chat navigation handler

#### API Key Management

* **[P3] Admin UI for org/project member API key management**
  * **What exists**: `OrgApiKeys` page (`repos/admin/src/pages/Orgs/OrgApiKeys.tsx`) with full CRUD for org-level keys; `CreateApiKeyDrawer` (`repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx`) supports `orgId` and `projectId` props. Backend `POST /orgs/:orgId/api-keys` already accepts `userId` in request body and validates membership/ownership. DB schema already has `userId` column + FK + index on `api_keys` table
  * **What's missing**:
    * `CreateApiKeyDrawer` has no `userId` prop or user selector dropdown — cannot create keys for other users
    * No "Manage API Keys" entry point from OrgUsers/Members page — `UserCard` only has Edit Role and Remove buttons
    * No per-user API key list view — `OrgApiKeys` page shows all org keys without user filtering
    * `apiKeysApi.list()` doesn't pass `userId` as a query param
    * `listApiKeys` backend endpoint doesn't filter by `userId` (see Backend section above)
    * Minor: `searchCount` hardcoded to `0` at `OrgApiKeys.tsx` line 246
  * **Fix**:
    1. Add optional `userId` prop to `CreateApiKeyDrawer` with a user selector dropdown (populated from org members via roles API). When `userId` is pre-set (from Members page context), show it as read-only
    2. Add a "Manage API Keys" icon button (`VpnKeyIcon`) to `UserCard.tsx` that opens `CreateApiKeyDrawer` with `userId` pre-set
    3. Add `userId` query param support to `apiKeysApi.list()` for per-user key filtering
    4. Fix `searchCount` hardcoded to `0` in `OrgApiKeys.tsx`
  * **Files**:
    * `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` — add `userId` prop + user selector
    * `repos/admin/src/components/Users/UserCard.tsx` — add "Manage API Keys" action button
    * `repos/admin/src/components/Users/Users.tsx` / `UsersGrid.tsx` — wire `onManageApiKeys` handler
    * `repos/admin/src/services/apiKeysApi.ts` — add `userId` param to `list()`
    * `repos/admin/src/pages/Orgs/OrgApiKeys.tsx` — fix `searchCount` hardcoded to `0`
    * `repos/backend/src/endpoints/apiKeys/listApiKeys.ts` — add `userId` query filter (see Backend section)


#### Endpoints

* **[P2] Proxy type endpoint — too many options, hard to configure**
  * `EndpointProxy.tsx` / `ProxyInputs.tsx` has ~30 fields across 6 sections (URL/method, headers, retry, auth, OAuth, transform, whitelist) all visible at once
  * **Fix**: Wrap sections in collapsible MUI `Accordion` components. Show URL/method/headers expanded by default; collapse advanced sections (retry, auth, OAuth, transform, whitelist)
  * **Files**: `repos/admin/src/components/Endpoints/Proxy/ProxyInputs.tsx`, `repos/admin/src/components/Endpoints/Proxy/EndpointProxy.tsx`

* **[P3] Agent type endpoint — expose all AgentDrawer options to Agent Overrides**
  * `EndpointAgent` component (`repos/admin/src/components/Endpoints/Agent/`) has limited overrides — only system prompt, model, max tokens, and tools. Missing: custom function tools, AI provider override, exposed secrets
  * Agent ID is a raw text input instead of a selector
  * **Fix**: Replace agent ID text input with `Autocomplete` that loads available agents. Add ProviderSelector, FunctionsSelector, SecretsSelector to the Agent Overrides section (reuse existing components from AgentDrawer)
  * **Files**: `repos/admin/src/components/Endpoints/Agent/EndpointAgent.tsx`, `repos/admin/src/components/Endpoints/Agent/AgentInputs.tsx`

* **[P3] Add Test button to Proxy Endpoints**
  * Currently `EndpointDrawer.tsx` renders `EndpointProxy` or `FaasEndpoint` based on type; `DrawerActions` only has Save/Cancel/Delete
  * The backend proxy route `ANY /proxy/:projectId/:endpointId` (`repos/backend/src/endpoints/proxy/endpoint.ts`) handles both proxy and FaaS types — the same URL works for both
  * Monaco Editor is already available: `@tdsk/components` has `Monaco.tsx` component, admin has a `Code` wrapper (`repos/admin/src/components/Code/Code.tsx`) with `MonacoOptions`
  * Calling the test endpoint requires a request to `{proxyBaseUrl}/proxy/{projectId}/{endpointId}` (goes through Caddy → Proxy → Backend). The admin `ApiService` has `path: '_'` by default, so the test call needs to bypass that prefix (raw `fetch` or new `ApiService({ path: '' })`)
  * **Fix**: Create `EndpointTestPanel.tsx` component with a read-only Monaco Editor. Create `useEndpointTest.ts` hook with test invocation logic, loading state, and content-type → Monaco language mapping (`application/json` → `json`, `text/html` → `html`, etc.). Add a "Test" button to `EndpointDrawer.tsx` (only visible in edit mode when endpoint has an ID). Add a `test()` method to `endpointsApi.ts`
  * **Files**:
    * New: `repos/admin/src/components/Endpoints/EndpointTestPanel.tsx`
    * New: `repos/admin/src/hooks/endpoints/useEndpointTest.ts`
    * Modify: `repos/admin/src/components/Endpoints/EndpointDrawer.tsx` — add Test button + panel
    * Modify: `repos/admin/src/services/endpointsApi.ts` — add `test()` method

* **[P3] Add Test button to Function Endpoints**
  * Same implementation as Proxy test above — the backend uses the same route (`/proxy/:projectId/:endpointId`) for both types, dispatching to `FaaSEndpoint` for function types
  * The `EndpointTestPanel` and `useEndpointTest` hook should work for both Proxy and Function endpoint types — no separate implementation needed
  * **Fix**: Covered by the Proxy test button implementation above — both types share the same test infrastructure
  * **Files**: Same as Proxy test button above


#### Quickstart Drawer

* **[P2] Quickstart drawer UI cleanup**

  * **Provider-specific icons**: `ProviderStep.tsx` renders provider cards with only text — no logos/icons
    * **Fix**: Import icons for Anthropic/OpenAI/Google/Custom and render them in the provider card grid
    * **Files**: `repos/admin/src/components/Quickstart/ProviderStep.tsx`

  * **Input backgrounds match container**: The `ConfigSection` styled component and inputs share the same background color
    * **Fix**: Set `bgcolor: 'background.paper'` on inputs or `bgcolor: 'background.default'` on container sections to create visual contrast
    * **Files**: `repos/admin/src/components/Quickstart/ProviderStep.tsx`, `AgentStep.tsx`

  * **Missing Cancel button**: Drawer actions don't include a cancel button in the bottom left like other drawers
    * **Fix**: Add cancel button matching the pattern used in `EndpointDrawer` and `AgentDrawer` (via `useDrawerActions` hook)
    * **Files**: `repos/admin/src/components/Quickstart/QuickstartWizard.tsx`

  * **Padding on last step**: `ReviewStep.tsx` content area lacks bottom padding before action buttons
    * **Fix**: Add `pb: 3` or `pb: 4` to review step content container
    * **Files**: `repos/admin/src/components/Quickstart/ReviewStep.tsx`


#### Sidebar Nav
  * **[P2]: Context-Sensitive Sub-Navigation Panel**
    * **Issues**
      * Sub Agent items under Agents nav get cut off
        * Sidebar nav item for "Agents" has sub-items (Threads, Chat) defined in `nav.tsx:131-142`. Sub-item text overflows due to limited sidebar width
      * Sidebar has too many items — needs simplification
        * OrgNavItems has 9 items, ProjectNavItems has 7+ items. When both visible, the sidebar is very long

    * **What Exists**
      * The admin app already has a primary sidebar navigation — a vertical icon-only rail on the far left edge of the screen. Each icon represents a top-level section (e.g., Home, Projects, Agents, Settings, etc.). Clicking an icon navigates to that section.
    * **What to Add**
      * Add a secondary sub-navigation panel that renders immediately to the right of the existing icon sidebar. This panel is context-sensitive — its content changes based on which item is currently active in the primary icon nav.
      * Grouped sections:
        * Org level: "Resources" (Projects, Agents, Users), "Security" (Secrets, Providers, API Keys, Domains), "Management" (Usage, Settings)
        * Project level: "Development" (Endpoints, Functions), "AI" (Agents + sub-items), "Security" (Secrets, Domains), "Management" (Members, Settings)
    * **Sub-Nav Panel Behavior**
      1. **Visibility**: The sub-nav panel appears when a primary nav item has sub-pages to show. If a primary nav item has no sub-pages (e.g., a simple
  dashboard landing), the sub-nav panel should not render, and the main content area should take the full remaining width.
      1. **Header**: At the top of the sub-nav panel, display the name of the active primary nav section (e.g., "Settings", "Project", "Agents") as a title.
      2. **Grouped Links**: Below the header, display navigation links organized into labeled groups. Each group has:
        * A section header in uppercase small text (e.g., "PROJECT SETTINGS", "CONFIGURATION", "BILLING")
        * A list of clickable nav items beneath it, each routing to a sub-page within that section
      3. **Active State**: The currently active sub-nav item should be visually highlighted (e.g., background highlight or bold text) similar to the existing Sidebar navigation to indicate which sub-page the user is on.
    * **Layout**

      ┌──────┬──────────────────┬──────────────────────────────────┐
      │ Icon │  Sub-Nav Panel   │         Main Content Area        │
      │ Rail │                  │                                  │
      │      │  [Section Title] │                                  │
      │  🏠  │                  │                                  │
      │  📁  │  GROUP HEADER    │                                  │
      │  ⚙️  │    Link 1        │                                  │
      │  ... │    Link 2        │                                  │
      │      │    Link 3        │                                  │
      │      │                  │                                  │
      │      │  GROUP HEADER    │                                  │
      │      │    Link 4  ↗     │                                  │
      │      │    Link 5        │                                  │
      │      │                  │                                  │
      └──────┴──────────────────┴──────────────────────────────────┘

    * **Data-Driven Configuration**
      * The sub-nav items for each primary nav section should be defined as a configuration object/map — not hardcoded JSX. This makes it easy to add/remove/reorder items per section. Something like:

    * **Key Constraints**
      * The sub-nav panel should have a fixed width and remain visible (not collapsible) when active.
      * The panel should be scrollable independently if the list of links exceeds the viewport height.
      * Routing should use the existing router — clicking a sub-nav item updates the URL and renders the corresponding page in the main content area.
      * The sub-nav panel replaces no existing UI — it is a new addition inserted between the icon rail and the main content.


#### Org Page

* **[P1] Org page doesn't show members — just empty list**
  * `Org.tsx` has a placeholder "Visit the Users page to invite and manage organization members" instead of rendering actual member data. The members data is available through the Users/roles API
  * **Fix**: Fetch org members (using roles service or users endpoint) and display as a compact table/list. Show first 5 members with a "View all" link to OrgUsers page
  * **Files**: `repos/admin/src/pages/Orgs/Org.tsx`

#### Users Page

* **[P2] Users should be a table instead of UserCard**
  * `Users.tsx` renders a `UsersGrid` component with a card/grid layout. Other list pages (Agents, Endpoints) use `DataTable`
  * **Fix**: Replace `UsersGrid` with `DataTable` component (already used elsewhere) with columns for name, email, role, status, and actions
  * **Files**: `repos/admin/src/components/Users/Users.tsx`, `repos/admin/src/components/Users/UsersGrid.tsx`


### Backend

* **[P2] [IN PROGRESS] List endpoint pagination not applied to members data array**
  * `listOrgMembers.ts` (line 23) parses `limit`/`offset` via `parsePagination(req)` but line 25 calls `db.services.role.getOrgMembers(orgId)` passing only `orgId` — no pagination params
  * `listProjectMembers.ts` (line 25) has the identical problem — calls `db.services.role.getProjectMembers(projectId)` without limit/offset
  * Both endpoints echo `limit`/`offset` in the response JSON (`{ data, limit, offset }`) but the data array is always the full unfiltered result set
  * The DB service methods `getOrgMembers` and `getProjectMembers` in `repos/database/src/services/role.ts` (lines 71-79, 101-112) accept only the ID param — no limit/offset signature
  * Every other list endpoint (agents, apiKeys, orgs, etc.) passes `{ limit, offset }` to the DB `list()` call — members are the only outlier
  * **Fix**: Add `limit?: number` and `offset?: number` params to `getOrgMembers()` and `getProjectMembers()` in `repos/database/src/services/role.ts`, apply `.limit()` / `.offset()` to the Drizzle query. Update both endpoint handlers to pass `limit, offset` through to the DB calls
  * **Files**:
    * `repos/backend/src/endpoints/orgs/listOrgMembers.ts` — pass `limit, offset` to DB call
    * `repos/backend/src/endpoints/projects/listProjectMembers.ts` — pass `limit, offset` to DB call
    * `repos/database/src/services/role.ts` — add `limit`/`offset` params to `getOrgMembers()` and `getProjectMembers()`

* **[P2] [IN PROGRESS] `listApiKeys` endpoint missing `userId` query filter**
  * `repos/backend/src/endpoints/apiKeys/listApiKeys.ts` line 34 builds a `where` filter that checks only for `projectId` from query params — no `userId` filter
  * The DB schema already has `userId` column + FK + index on `api_keys` table, and the DB service `list()` supports arbitrary `where` filters
  * Needed for the admin "per-user API keys" feature below
  * **Fix**: Add `if (userId) where.userId = userId as string` to the where-building block in `listApiKeys.ts`
  * **Files**: `repos/backend/src/endpoints/apiKeys/listApiKeys.ts`


### Repl

* **[P0] Executor `ToolExecutionStart` reads wrong field name — tool names always `undefined`**
  * `repos/repl/src/services/executor.ts` line 113: reads `msg.name` but the `TWSToolExecStartMsg` type (defined in `repos/domain/src/types/ws.types.ts` lines 65-70) has the field as `toolName`
  * The `as any` cast on the `onEvent()` call masks this type error at compile time
  * At runtime, `msg.name` is always `undefined`, so tool names never appear in REPL output
  * The backend sends `{ toolCallId, toolName, args }` in `wsHandler.ts` lines 241-244
  * **Fix**: Change `name: msg.name` to `name: msg.toolName` at `executor.ts` line 113
  * **Files**: `repos/repl/src/services/executor.ts`

* **[P1] [IN PROGRESS] Executor Promise resolves via WebSocket `close` event instead of `Done` — fragile resolution**
  * `repos/repl/src/services/executor.ts` lines 134-137: the `Done` handler calls `ws.close()` which eventually fires `ws.on('close')` (lines 154-157) to resolve the Promise
  * If the connection drops before `Done` arrives, the Promise resolves silently with an empty `threadId: ''`, masking errors
  * The resolution path is indirect: `Done` → `ws.close()` → `close` event → resolve. Should resolve directly in the `Done` handler
  * **Fix**: Resolve the Promise directly in the `EWSEventType.Done` case instead of relying on the subsequent `close` event. Keep `ws.close()` for cleanup but don't depend on it for resolution
  * **Files**: `repos/repl/src/services/executor.ts`

* **[P2] [IN PROGRESS] Executor `TurnEnd` event silently discarded — usage data lost**
  * `repos/repl/src/services/executor.ts` lines 131-132: `case EWSEventType.TurnEnd: break` — empty stub
  * The backend sends `TurnEnd` with `{ usage: { input, output } }` token counts (`wsHandler.ts` line 267) but the executor drops them
  * No `TStreamEvent` variant exists for `turn_end`, so forwarding requires adding one to domain or handling separately
  * **Fix**: Either add a `turn_end` variant to `TStreamEvent` in domain and forward usage data, or log it locally in the REPL for user feedback (e.g., "Tokens used: X input, Y output")
  * **Files**: `repos/repl/src/services/executor.ts`, optionally `repos/domain/src/types/` for `TStreamEvent`

* **[P2] Executor `onEvent()` calls all use `as any` type casts — masks type errors**
  * `repos/repl/src/services/executor.ts` lines 107-140: every `onEvent()` call constructs a plain object and casts to `any` to bypass TypeScript
  * This directly caused the `msg.name` bug above — the cast suppressed the compile-time error
  * **Fix**: Remove `as any` casts and properly type the event objects to match `TStreamEvent` union. May require extending the `TStreamEvent` type in domain to include all event variants the executor constructs
  * **Files**: `repos/repl/src/services/executor.ts`, `repos/domain/src/types/`

* **[P3] `FileRequest` and `FileChanged` events — unimplemented stubs (Phase 8 placeholder)**
  * `repos/repl/src/services/executor.ts` lines 143-147: both are empty `break` stubs
  * The backend also has them as stubs — `wsHandler.ts` "Phase 8 — workspace file sync (placeholder)"
  * These events are defined in `repos/domain/src/types/ws.types.ts` (lines 17-18) as `TWSFileRequestMsg` and `TWSFileChangedMsg` under the `// Server → Client` section
  * No fix needed until the backend implements the workspace file sync feature. The empty stubs are correct placeholders
  * **Fix**: No action required — track as future feature when backend Phase 8 is implemented
  * **Files**: `repos/repl/src/services/executor.ts` (stubs), `repos/backend/src/endpoints/ai/wsHandler.ts` (stubs)


### Integration

* **[P3] Playwright integration test coverage is minimal — only page navigation/rendering**
  * Current coverage only validates that pages load and render without console errors
  * Missing: full CRUD operations for all entity types through the UI
  * **Entities needing coverage**:
    * Organization level: Agents, Secrets, Domains, Providers, Member Invites, Projects
    * Project level: Endpoints, Functions, Secrets, Agents, Members, Domains
    * Agent level: Threads, Chats
  * **Fix**: Build a comprehensive Playwright test suite using the existing auth bypass pattern (mock Neon Auth `get-session`, set API key as session token). Each entity type needs Create, Read, Update, Delete test flows through the UI
  * **Files**: New test files in `repos/integration/src/` for each entity CRUD flow
