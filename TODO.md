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

(No confirmed issues)


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


### ALL

* **[P4] Plans and Subscriptions — switch from Polar.sh to Stripe**
  * Current implementation uses Polar.sh for payments. Backend `PolarService.fetchPlans()` fails when Polar credentials are invalid or products aren't configured. The admin `Billing.tsx` page structure is sound but receives empty/error data
  * This is a full payment stack replacement:
    1. **Backend**: Replace `PolarService` with `StripeService` in `repos/backend/src/services/payments/strategies/`
    2. **Backend**: Update webhook handler from Polar events to Stripe events
    3. **Backend**: Update `getPlans.ts`, `getCurrentSubscription.ts`, `createCheckoutSession.ts` for Stripe
    4. **Domain**: Update plan/subscription models for Stripe-specific fields
    5. **Admin**: Update checkout redirect (Stripe Checkout Session URL)
    6. **Config**: New env vars for `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, product/price IDs
  * **This is a large standalone task that should be planned separately**
  * **Files**: `repos/backend/src/services/payments/strategies/polar.ts` → `stripe.ts`, `repos/backend/src/services/payments/payments.ts`, `repos/backend/src/endpoints/subscriptions/`, `repos/domain/src/models/subscription.ts`, `repos/admin/src/pages/Billing/Billing.tsx`


### Priority Summary

| Priority | Issues | Count |
|----------|--------|-------|
| **P0** — Broken functionality | Endpoints spinner, function-select error, Usage "Org Owner", project agent filtering, secret resolver fallback | 5 |
| **P1** — UX blockers | Secrets UUID, providers empty tag, functions not loaded, provider missing in list, thread click, org members | 6 |
| **P2** — UI polish | Search bg, quickstart UI (4 sub), messages squished (2), thread drawer, provider selector, sidebar (2), users table | 11 |
| **P3** — New features | Agent endpoint overrides, OpenRouter/Ollama, reusable selectors | 3 |
| **P4** — Major refactor | Stripe migration | 1 |
