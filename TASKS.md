## TODO

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


### Admin

#### General

* **[P1] Auth token not automatically refreshed — session expires silently**
  * `AuthProvider.tsx:32-48` calls `initAuth()` once on mount, which calls `auth.session()` → `apiService.bearer(data)` to set the `Authorization` header. This token is **never refreshed** after initialization
  * `TAuthSession` type (`repos/admin/src/types/auth.types.ts:23`) includes an `expiresAt` field, but it is never checked or used
  * `ApiService.fetch()` (`repos/admin/src/services/api.ts:98-119`) has no retry logic or 401 interceptor — once the token expires, all API requests fail silently
  * The only recovery is a manual page refresh, which re-runs `initAuth()` and gets a fresh token
  * **Fix (hybrid approach)**:
    1. In `AuthProvider.tsx`, add a `useEffect` with `setInterval` that re-fetches the session and updates the bearer token before expiration (e.g., every 5 minutes or based on `expiresAt`)
    2. In `ApiService.fetch()`, add 401 status handling that automatically refreshes the token and retries the failed request
    3. Clear the interval on unmount
  * **Files**: `repos/admin/src/contexts/AuthProvider.tsx`, `repos/admin/src/services/api.ts`, `repos/admin/src/actions/auth/local/init.ts`

* **[P2] Search inputs should have white background**
  * `SearchBar` (`repos/admin/src/components/SearchBar/SearchBar.tsx`) renders a `TextInput` without explicit background styling
  * The input inherits the default theme background, which blends into the page container
  * **Fix**: Add `sx={{ bgcolor: 'background.paper' }}` to the `TextInput` in `SearchBar.tsx`
  * **Files**: `repos/admin/src/components/SearchBar/SearchBar.tsx`

#### Endpoints

* **[P0] Endpoints page sometimes doesn't load (spinner forever)**
  * In `useEndpoints.ts:25-37`, the `useEffect` only fetches when `!exists(endpoints)`. If the Jotai `endpoints` atom was previously populated (from another project), the `exists()` check passes and the effect skips the fetch — but `loading` was initialized as `true` (line 20) and never set to `false`
  * When switching between projects, the atom retains stale data from the previous project
  * **Fix**: Remove the `!exists(endpoints)` guard so endpoints are always fetched when `orgId`/`projectId` change. Reset `loading` to `false` if the effect doesn't trigger a fetch
  * **Files**: `repos/admin/src/hooks/endpoints/useEndpoints.ts`

* **[P0] EndpointDrawer MUI out-of-range value error for function-select**
  * `EndpointDrawer.tsx:74-75` reads functions from Jotai state via `useFunctions()`. When editing a FaaS endpoint, its `functionId` (e.g., `b0000000-...`) is set as the MUI Select value, but `availableFunctions` is empty (not yet fetched or from wrong project). MUI throws because the value isn't in the options list
  * **Fix**: In `FaasEndpoint` component, guard the select value — if `functionId` isn't in `availableFunctions`, use `''`. Also trigger `fetchFunctions` when EndpointDrawer opens
  * **Files**: `repos/admin/src/components/Endpoints/Faas/EndpointFass.tsx`, `repos/admin/src/components/Endpoints/EndpointDrawer.tsx`

* **[P3] Agent type endpoint — expose all AgentDrawer options to Agent Overrides**
  * `EndpointAgent` component (`repos/admin/src/components/Endpoints/Agent/`) has limited overrides — only system prompt, model, max tokens, and tools. Missing: custom function tools, AI provider override, exposed secrets
  * Agent ID is a raw text input instead of a selector
  * **Fix**: Replace agent ID text input with `Autocomplete` that loads available agents. Add ProviderSelector, FunctionsSelector, SecretsSelector to the Agent Overrides section (reuse existing components from AgentDrawer)
  * **Files**: `repos/admin/src/components/Endpoints/Agent/EndpointAgent.tsx`, `repos/admin/src/components/Endpoints/Agent/AgentInputs.tsx`

* **[P2] Proxy type endpoint — too many options, hard to configure**
  * `EndpointProxy.tsx` / `ProxyInputs.tsx` has ~30 fields across 6 sections (URL/method, headers, retry, auth, OAuth, transform, whitelist) all visible at once
  * **Fix**: Wrap sections in collapsible MUI `Accordion` components. Show URL/method/headers expanded by default; collapse advanced sections (retry, auth, OAuth, transform, whitelist)
  * **Files**: `repos/admin/src/components/Endpoints/Proxy/ProxyInputs.tsx`, `repos/admin/src/components/Endpoints/Proxy/EndpointProxy.tsx`

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

#### Usage Page

* **[P0] Usage page shows error — "Org Owner not found"**
  * `getOrgLimits.ts:26-29` calls `db.services.role.getOrgOwner(orgId)` which queries the `roles` table for `type='owner'`. If no owner role exists (e.g., org created through quickstart, or role wasn't assigned during org creation), `ownerRole.data` is `undefined` and the endpoint throws `Exception(500, 'Org owner not found')`
  * Same issue in `checkQuota.ts:39`
  * **Fix (Option C — both data and code)**:
    1. Ensure `createOrg` endpoint automatically creates an `owner` role for the creating user
    2. In `getOrgLimits.ts` and `checkQuota.ts`, fall back to the requesting user's subscription when no org owner role is found
  * **Files**: `repos/backend/src/endpoints/quotas/getOrgLimits.ts`, `repos/backend/src/endpoints/quotas/checkQuota.ts`, `repos/backend/src/endpoints/orgs/createOrg.ts`

#### Agent Drawer

* **[P1] Secrets selector shows UUID instead of name**
  * `AgentDrawer.tsx:147-149` maps agent secrets to `s.id || s.name || s.hashKey` for display. The `SecretsSelector` resolves display labels by looking up IDs in `secretsList`. If the agent's secrets weren't fully hydrated by the backend (missing `name` field), or `secretsList` hasn't loaded yet when the drawer pre-populates, the raw UUID is displayed
  * **Fix**: In `SecretsSelector`, always look up the ID in `secretsList` for display. If not found (still loading), show "Loading..." placeholder instead of the raw UUID
  * **Files**: `repos/admin/src/components/Agents/SecretsSelector.tsx`, `repos/admin/src/components/Agents/AgentDrawer.tsx`

* **[P1] Providers selector showing empty tag instead of provider name**
  * `ProviderPriorityList.tsx:33` `getProviderName(id)` looks up ID in `aiProviders`. But `aiProviders` is populated by an async fetch (`AgentDrawer.tsx:92-101`) that hasn't completed when provider IDs are pre-populated from agent data (line 130). The component shows raw ID or empty string
  * **Fix**: Defer provider pre-population until `aiProviders` has loaded. OR show a loading indicator in `ProviderPriorityList` when `aiProviders` is empty but `providerIds` has values
  * **Files**: `repos/admin/src/components/Agents/ProviderPriorityList.tsx`, `repos/admin/src/components/Agents/AgentDrawer.tsx`

* **[P1] Functions not loaded in function selector**
  * `AgentDrawer.tsx:104-108` only fetches functions when `projectId` exists. Org-level agents (opened from `OrgAgents` page at line 271-278) don't pass `projectId`, so functions never load. The agent may have functions from a project assignment, but the selector shows empty
  * **Fix**: When `projectId` is missing, fetch functions from the agent's assigned projects (`agent.projects`). Or fetch all org-level functions
  * **Files**: `repos/admin/src/components/Agents/AgentDrawer.tsx`

* **[P0] Removing secrets from agent does not persist (cross-repo)**
  * In `AgentDrawer.tsx:210-214`, secrets are included in the update payload as `secrets: Secret[]`. The admin correctly sends the updated secrets list to the backend via `agentsApi.update()` (`repos/admin/src/services/agentsApi.ts:118-120`)
  * However, `updateAgent.ts:19-25` in the backend destructures the request body but **does NOT extract `secrets`** — it only handles `projectIds`, `functionIds`, `providerIds`, and `providers`. The `secrets` field ends up in the `...agent` rest spread and is silently discarded because it's not a column on the `agents` table
  * Secrets use the Exclusive Arc pattern (`repos/database/src/schemas/secrets.ts:26-35`) — each secret has an `agentId` FK, not stored on the agent table. The database agent service (`repos/database/src/services/agent.ts:105-146`) handles junction tables for projects/functions/providers via `#relations()` but has **no secret handling**
  * **Fix (backend — `updateAgent.ts`)**:
    1. Extract `secrets` (or `secretIds`) from `req.body` destructuring alongside `projectIds`/`functionIds`/`providerIds`
    2. Validate each secret exists and belongs to the agent's org
    3. Pass `secretIds` to the database service
  * **Fix (database — `agent.ts` service)**:
    1. Add `secretIds?: string[]` to `TAgentInsertOpts` and `TAgentRelations` types
    2. In `#relations()`, handle `secretIds`: clear existing agent-scoped secrets (`UPDATE secrets SET agentId=NULL WHERE agentId=id`), then set new ones (`UPDATE secrets SET agentId=id WHERE id IN secretIds`)
    3. In `update()` and `create()`, extract `secretIds` and pass to `#relations()`
  * **Files**:
    * `repos/backend/src/endpoints/agents/updateAgent.ts:19-25, 73-77`
    * `repos/backend/src/endpoints/agents/createAgent.ts:20-26`
    * `repos/database/src/services/agent.ts:26-30, 52-57, 105-146, 259-301`

* **[P4] Project-level agent overrides — prevent projects from modifying shared agent config (cross-repo)**
  * The `AgentDrawer` component is shared between org and project contexts. When opened from `ProjectAgents.tsx:288-296`, `projectId` is passed but the drawer still allows **full modification** of the org-scoped agent (name, model, system prompt, tools, secrets, providers). Changes impact ALL projects using that agent
  * Functions are project-scoped (`functions.projectId`) but tied to org-scoped agents via `agentFunctions` junction table — no project context in the relationship. The `agentProjects` table (`repos/database/src/schemas/agentProjects.ts`) only stores membership (agentId + projectId + alias), with no override data
  * **Fix (database — new schema)**:
    1. Create `agentProjectConfigs` table with override fields: `agentId`, `projectId`, optional `model`, `maxTokens`, `temperature`, `systemPrompt`, `tools`, `functionIds`, `envVars`, `environment`, `enabled`
    2. Add optional `projectId` to `agentFunctions` table to support project-scoped function assignments
  * **Fix (backend — new endpoints)**:
    1. Add CRUD endpoints for agent project overrides: `POST/GET/PUT/DELETE /orgs/:orgId/projects/:projectId/agents/:agentId/overrides`
    2. Update `listAgents` to merge base agent config with project overrides when `projectId` is provided
    3. When update is called from project context, route to override endpoints instead of modifying base agent
  * **Fix (domain — model update)**:
    1. Add `overrides?: TAgentOverride` field to Agent model
    2. Add `getEffectiveConfig(projectId?)` method that merges base config with project overrides
  * **Fix (admin — UI update)**:
    1. When `projectId` is set in `AgentDrawer`, show "Project Override Mode" — disable base fields, only allow overrides
    2. Show which fields are overridden vs. using defaults, with "Reset to default" per field
    3. Only show function selector in project context (where project-scoped functions can be added)
    4. Hide project assignment section in project context
  * **Files**:
    * New: `repos/database/src/schemas/agentProjectConfigs.ts`
    * Modify: `repos/database/src/schemas/agentFunctions.ts` (add optional `projectId`)
    * Modify: `repos/database/src/services/agent.ts` (load overrides)
    * New: `repos/database/src/services/agentProjectConfig.ts`
    * Modify: `repos/domain/src/models/agent.ts` (add overrides, getEffectiveConfig)
    * New: `repos/domain/src/types/agent.types.ts` (TAgentOverride)
    * New: `repos/backend/src/endpoints/agents/agentProjectConfig.ts`
    * Modify: `repos/backend/src/endpoints/agents/listAgents.ts`, `updateAgent.ts`
    * Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx` (conditional UI)
    * Modify: `repos/admin/src/services/agentsApi.ts` (add override methods)

#### Thread / Chat Pages

* **[P2] AI messages are squished in Thread history and Chat**
  * Message display components use `maxWidth: '75%'` and container `maxWidth: 900` which constrains content too aggressively. AI messages with code blocks or explanations need more horizontal space
  * **Fix**: Increase message bubble `maxWidth` to `'90%'` for assistant messages. Increase container max-width or make responsive. Ensure code blocks scroll horizontally
  * **Files**: `repos/admin/src/components/AI/MessagesTab.tsx`, `repos/admin/src/components/AI/MessageBubble.tsx`

* **[P2] Edit Thread Drawer — UI all squished together**
  * Parent container constraints or missing `fullWidth` props on form elements in `EditThreadDrawer.tsx`
  * **Fix**: Ensure all TextField/Select components have `fullWidth` prop. Set adequate drawer width
  * **Files**: `repos/admin/src/components/AI/EditThreadDrawer.tsx`

* **[P2] Threads page has Agent selector — should be Provider selector**
  * `ThreadsTab.tsx` uses `activeAgentId` from state to filter threads. The intent is to allow easy switching of AI providers attached to an agent
  * **Fix**: Add (or replace with) a provider selector dropdown showing providers attached to the active agent. When selected, it becomes the active provider for agent interactions
  * **Files**: `repos/admin/src/components/AI/ThreadsTab.tsx`

#### Agents Page

* **[P1] Provider not showing in Agents list**
  * Both `OrgAgents.tsx:151` and `ProjectAgents.tsx:169` render `agent.primaryProvider?.name`. The `primaryProvider` getter (`domain/src/models/agent.ts:53-55`) returns `this.providers?.[0]`. But when the backend returns agent data, the `providers` array may not be hydrated (returned as IDs only, not full Provider objects with names)
  * **Fix (backend)**: Ensure `listAgents` and `getAgent` endpoints join/include provider data (name, brand) in the response
  * **Fix (admin fallback)**: Look up provider names from the Jotai `providers` atom using the agent's `providerIds`
  * **Files**: `repos/backend/src/endpoints/agents/listAgents.ts`, `repos/admin/src/pages/Orgs/OrgAgents.tsx`, `repos/admin/src/pages/Projects/ProjectAgents.tsx`

#### Threads Page

* **[P1] Clicking on thread does not navigate to Thread page**
  * `ThreadsTab.tsx` table rows have no `onClick` handler. The "View" action button calls `onViewThread` which sets `activeThreadId` and calls `onSwitchToMessages()` — this just switches to the messages tab within the same page, not a dedicated thread page
  * **Fix**: Add `onClick` to table rows that navigates to the thread detail URL. Make the "View" action button also navigate instead of just switching tabs
  * **Files**: `repos/admin/src/components/AI/ThreadsTab.tsx`

#### Sidebar Nav

* **[P2] Sub Agent items under Agents nav get cut off**
  * Sidebar nav item for "Agents" has sub-items (Threads, Chat) defined in `nav.tsx:131-142`. Sub-item text overflows without proper text handling at normal sidebar width
  * **Fix**: Add `textOverflow: 'ellipsis'`, `overflow: 'hidden'`, `whiteSpace: 'nowrap'` to nav sub-item text. Add tooltip showing full name on hover
  * **Files**: `repos/admin/src/components/Sidebar/SBNavList.tsx` (or the nav item render component)

* **[P2] Sidebar has too many items — needs simplification**
  * OrgNavItems has 9 items, ProjectNavItems has 7+ items. When both visible, the sidebar is very long
  * **Fix**: Group into collapsible sections:
    * Org level: "Resources" (Projects, Agents, Users), "Security" (Secrets, Providers, API Keys, Domains), "Management" (Usage, Settings)
    * Project level: "Development" (Endpoints, Functions), "AI" (Agents + sub-items), "Security" (Secrets, Domains), "Management" (Members, Settings)
  * **Files**: `repos/admin/src/constants/nav.tsx`, sidebar rendering components

#### Project Agent Filtering

* **[P0] All org agents loaded for all projects**
  * `ProjectAgents.tsx:60-71` filters agents by `orgId` only: `.filter((agent) => agent.orgId === orgId)`. Does NOT filter by `projectId`. Even though `fetchAgents` is called with `{ orgId, projectId }`, the Jotai `agents` atom stores ALL fetched agents — stale agents from other projects bleed through
  * **Fix**: Add project-level filtering: `.filter((agent) => agent.orgId === orgId && agent.projects?.some(p => p.id === projectId))`
  * **Files**: `repos/admin/src/pages/Projects/ProjectAgents.tsx:60-71`

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


### Agent

* **[P3] Add OpenRouter and Ollama support**
  * `ELLMProviderBrand` enum in `repos/domain/src/types/ai.types.ts:69-75` only includes `zai`, `openai`, `google`, `custom`, `anthropic`. OpenRouter and Ollama are missing
  * Agent runtime uses `getModel()` from `@mariozechner/pi-ai` (`repos/agent/src/runner/runner.ts:74`). Both OpenRouter and Ollama are OpenAI-compatible APIs (same wire format)
  * **Fix**:
    1. Add `openrouter` and `ollama` to `ELLMProviderBrand` enum in `repos/domain/src/types/ai.types.ts`
    2. Add entries in `PROVIDER_TEMPLATES` (`repos/domain/src/utils/providers/providerTemplates.ts`) with default base URLs: OpenRouter `https://openrouter.ai/api/v1`, Ollama `http://localhost:11434/v1`
    3. Update `resolveProviderType.ts` in backend to handle new brands
    4. Verify `pi-ai`'s `getModel()` works with these (OpenAI-compatible; may need `custom` fallback)
    5. Update admin QuickstartWizard provider templates
  * **Files**: `repos/domain/src/types/ai.types.ts`, `repos/domain/src/utils/providers/providerTemplates.ts`, `repos/backend/src/utils/providers/resolveProviderType.ts`, `repos/agent/src/runner/runner.ts`, `repos/admin/src/components/Quickstart/ProviderStep.tsx`


### Repl

#### Prompt Input

* **[P0] Delete key deletes character at cursor instead of before cursor**
  * `useEditorState.ts:123-129` implements `deleteForward()` which deletes the character AT the cursor position (`prev.slice(0, cursor) + prev.slice(cursor + 1)`) and keeps the cursor in place. Standard terminal/input behavior is to delete the character BEFORE the cursor and move the cursor back (identical to backspace)
  * `Prompt.tsx:142-149` handles `key.delete` by calling `editor.deleteForward()` and then computing `newText` assuming deletion at cursor (`editor.text.slice(0, c) + editor.text.slice(c + 1)`) — this is also wrong for the desired behavior
  * For comparison, `deleteBackward()` (`useEditorState.ts:113-121`) correctly deletes before cursor and moves cursor back: `prev.slice(0, cursor - 1) + prev.slice(cursor)` with `setCursor(prev => prev - 1)`
  * **Fix (`useEditorState.ts:123-129`)**:
    1. Change `deleteForward()` to behave like `deleteBackward()`: guard `if (cursor <= 0) return`, delete char before cursor (`prev.slice(0, cursor - 1) + prev.slice(cursor)`), move cursor back (`setCursor(prev => prev - 1)`)
  * **Fix (`Prompt.tsx:142-149`)**:
    1. Update the `syncMenu` text calculation to match: `editor.text.slice(0, Math.max(0, c - 1)) + editor.text.slice(c)` (same pattern as backspace at line 137)
  * **Files**: `repos/repl/src/hooks/useEditorState.ts:123-129`, `repos/repl/src/components/Prompt/Prompt.tsx:142-149`

#### Startup Flow

* **[P3] Interactive project and agent selection on startup**
  * Currently `App.tsx:74-106` flows through phases: `login` → `loading` → `pickAgent` → `chat`. There is no `pickProject` phase. If `initialAgentId` is provided, `pickAgent` is skipped entirely
  * The config system (`repos/repl/src/services/config.ts`) supports `project?: string` in `TReplConfig` (`repos/repl/src/types/config.types.ts:43-53`) but it is never used
  * The API client (`repos/repl/src/services/api.ts`) has `listAgents(orgId)` but **no `listProjects(orgId)` method**
  * The `SelectPrompt` component (`repos/repl/src/components/Prompt/SelectPrompt.tsx:1-47`) already supports interactive keyboard selection (↑↓ + Enter + number keys) — it can be reused
  * **Fix**:
    1. Add `listProjects(orgId)` method to `ApiClient` (`repos/repl/src/services/api.ts`)
    2. Add `pickProject` phase to `App.tsx` between `loading` and `pickAgent`
    3. Create `ProjectPicker` component (similar to `AgentPicker.tsx:1-42`) using `SelectPrompt`
    4. If `config.project` is set, skip project selection; otherwise show interactive list
    5. Once project is selected, filter `pickAgent` list to only agents from that project
    6. Pass `initialProjectId` from CLI params through `chat.ts` → `App.tsx`
  * **Files**:
    * Modify: `repos/repl/src/services/api.ts` (add `listProjects`)
    * Modify: `repos/repl/src/components/App/App.tsx` (add `pickProject` phase)
    * New: `repos/repl/src/components/ProjectPicker/ProjectPicker.tsx`
    * Modify: `repos/repl/src/tasks/chat.ts` (pass `initialProjectId`)
    * Modify: `repos/repl/src/components/AgentPicker/AgentPicker.tsx` (filter by project)

#### Slash Commands

* **[P3] Add `/projects` slash command — interactive project selection**
  * No `/projects` command exists in the registry (`repos/repl/src/commands/registry.ts:1-36`). The `TSlashCommandContext` (`repos/repl/src/types/commands.types.ts:1-32`) has no `projectId`, `setProjectId`, or `listProjects` methods
  * **Fix**:
    1. Add `projectId: string | null`, `setProjectId: (id: string) => void`, and `listProjects: () => Promise<TSelectItem[]>` to `TSlashCommandContext`
    2. Create `repos/repl/src/commands/projects.ts` slash command that shows an interactive `SelectPrompt` of projects for the current org
    3. Register in `repos/repl/src/commands/registry.ts`
  * **Files**:
    * New: `repos/repl/src/commands/projects.ts`
    * Modify: `repos/repl/src/commands/registry.ts`
    * Modify: `repos/repl/src/types/commands.types.ts` (extend context)

* **[P3] Enhance `/threads` command — interactive thread selection with delete support**
  * `listThreads.ts:1-21` currently outputs a text list of threads via `ctx.output()` with no interactivity. The `/switch` command (`switchThread.ts:1-20`) requires a `threadId` argument — no interactive fallback
  * **Fix**:
    1. Replace text output in `listThreads.ts` with interactive `SelectPrompt` component
    2. Enter loads the selected thread (calls `ctx.loadThreadMessages(threadId)` + `ctx.setThreadId(threadId)`)
    3. Esc exits the selection menu
    4. Cmd-D on highlighted thread shows delete confirmation (Yes/No prompt)
    5. Enhance `/switch` (`switchThread.ts`) — if no `threadId` arg, show the same interactive thread menu
  * **Files**:
    * Modify: `repos/repl/src/commands/listThreads.ts`
    * Modify: `repos/repl/src/commands/switchThread.ts`

* **[P3] Enhance `/clear` command — create new thread on clear**
  * `clear.ts:1-10` currently only clears the screen (calls `ctx.clearMessages()` or equivalent). It does not create a new thread
  * **Fix**:
    1. After clearing the screen, create a new thread via the API (same config as current thread but no context/messages)
    2. Set the new thread as active via `ctx.setThreadId(newThreadId)`
  * **Files**: `repos/repl/src/commands/clear.ts`

* **[P3] Enhance `/agent` command — interactive agent selection filtered by project**
  * `switchAgent.ts:1-14` requires an `agentId` argument. If no arg is provided, it should show an interactive `SelectPrompt` of agents filtered to the currently active project
  * **Fix**:
    1. If no `agentId` arg, fetch agents for current project and show `SelectPrompt`
    2. Only show agents from `ctx.projectId` (if set), otherwise show all org agents
  * **Files**: `repos/repl/src/commands/switchAgent.ts`

#### Chat Session UI

* **[P2] Show session metadata below prompt input**
  * The `Prompt` component (`repos/repl/src/components/Prompt/Prompt.tsx:188-209`) renders a `SlashMenu` above the input and the bordered input box, but nothing below it. Session metadata (org, agent, project, thread, connection status, context file count, message count) is only available via the `/info` slash command or partially in the `StatusBar` at the top
  * `ChatSession.tsx:24-68` passes `connection`, `agentName` to `Prompt` but not `modelName`, `providerName`, `threadName`, or `projectName`
  * **Fix**:
    1. Create a `MetadataBar` component that displays key session info in a compact single-line or two-line format below the prompt input
    2. Essential metadata: Organization name, Agent name, Thread name (or "new"), Connection status indicator, Context files count
    3. Optional: Provider/Model, Message count, Verbose mode
    4. Update `ChatSession.tsx` to pass additional metadata props (threadName, modelName, providerName, projectName)
    5. Add `MetadataBar` to `Prompt.tsx` render output after the input `<Box>`
  * **Files**:
    * New: `repos/repl/src/components/Prompt/MetadataBar.tsx`
    * Modify: `repos/repl/src/components/Prompt/Prompt.tsx:188-209`
    * Modify: `repos/repl/src/components/ChatSession/ChatSession.tsx`
    * Modify: `repos/repl/src/components/App/App.tsx` (pass additional metadata)


### Backend

* **[P0] Provider API secret resolution should not fallback to other secrets**
  * `SecretResolver.resolveApiKey()` in `repos/backend/src/services/secrets/secretResolver.ts:162-233` implements a 4-tier fallback:
    * Tier 0: Direct `provider.secretId` lookup (O(1))
    * Tier 1: Agent-scoped secrets matching provider
    * Tier 2: Provider-scoped secrets
    * Tier 3: Org-scoped secrets
  * Only Tier 0 should be used. `provider.secretId` is the required, explicit secret assignment. Tiers 1-3 allow unintended secret resolution and break explicit secret management
  * **Fix**:
    1. Remove tiers 1-3 from `resolveApiKey()`
    2. If `provider.secretId` is set, use only that secret. If decryption fails, throw an error
    3. If `provider.secretId` is NOT set, throw an error indicating the provider needs a secret configured
    4. Update tests in `secretResolver.test.ts`
  * **Files**: `repos/backend/src/services/secrets/secretResolver.ts:162-233`, `repos/backend/src/services/secrets/secretResolver.test.ts`


### Work (Cross-Cutting)

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



### Priority Summary

| Priority | Issues | Count |
|----------|--------|-------|
| **P0** — Broken functionality | Endpoints spinner, function-select error, Usage "Org Owner", project agent filtering, secret resolver fallback, agent secrets removal, REPL delete key | 7 |
| **P1** — UX blockers | Auth token refresh, secrets UUID, providers empty tag, functions not loaded, provider missing in list, thread click, org members | 7 |
| **P2** — UI polish | Search bg, quickstart UI (4 sub), messages squished (2), thread drawer, provider selector, sidebar (2), users table, REPL session metadata | 12 |
| **P3** — New features | Agent endpoint overrides, OpenRouter/Ollama, reusable selectors, REPL project selection, REPL /projects command, REPL /threads interactive, REPL /clear new thread, REPL /agent interactive | 8 |
| **P4** — Major refactor | Project-level agent overrides | 1 |

