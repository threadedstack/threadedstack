## TODO

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


### Admin

#### General

* **[P2] Search inputs should have white background**
  * `SearchBar` (`repos/admin/src/components/SearchBar/SearchBar.tsx`) renders a `TextInput` without explicit background styling
  * The input inherits the default theme background, which blends into the page container
  * **Fix**: Add `sx={{ bgcolor: 'background.paper' }}` to the `TextInput` in `SearchBar.tsx`
  * **Files**: `repos/admin/src/components/SearchBar/SearchBar.tsx`

#### Endpoints

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

#### Agent Drawer

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
| **P1** — UX blockers | Thread click, org members | 2 |
| **P2** — UI polish | Search bg, quickstart UI (4 sub), proxy endpoint UX, messages squished (2), thread drawer, provider selector, sidebar (2), users table | 12 |
| **P3** — New features | Agent endpoint overrides, OpenRouter/Ollama, reusable selectors | 3 |
| **P4** — Major refactor | Project-level agent overrides | 1 |

