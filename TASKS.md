## TODO

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


### Admin

#### General


#### Organization

* **[P3] Extract Quick Actions card into reusable component**
  * The Quick Actions card in `repos/admin/src/pages/Orgs/Org.tsx` lines 183-297 is hardcoded inline with 3 action cards (Projects, Invite Users, Manage Secrets). Each card has an icon, title, description, and onClick handler. This should be a generic component that accepts a list of actions
  * **Fix**:
    1. Create a `QuickActionsCard` component that accepts an array of action configs (`{ icon, title, description, onClick }[]`) and a card title
    2. Render the Grid layout and individual action cards from the config array
    3. Update `Org.tsx` to use the new component with the existing 3 actions passed as config
  * **Files**:
    * New: `repos/admin/src/components/QuickActions/QuickActionsCard.tsx`
    * `repos/admin/src/pages/Orgs/Org.tsx` — replace lines 183-297 with `<QuickActionsCard>` usage

#### Organization Members

* **[P2] Merge EditRoleDrawer and UserApiKeysDrawer into a single User management drawer**
  * Two separate drawers exist for managing the same user: `EditRoleDrawer` (`repos/admin/src/components/Roles/EditRoleDrawer.tsx`, 135 lines) for role editing, and `UserApiKeysDrawer` (`repos/admin/src/components/Users/UserApiKeysDrawer.tsx`, 249 lines) for API key management. Users must close one drawer to open the other, and duplicate user identification/display logic exists in both
  * In `repos/admin/src/components/Users/Users.tsx`, two separate buttons exist (lines 172-211): "API Keys" and "Edit Role", managing two separate state variables (`apiKeysUser` line 53, `selectedUser`/`editRoleDialogOpen` lines 49-52)
  * **Fix**:
    1. Create a single `EditUserDrawer` component with two tabs or sections: "Role" (from EditRoleDrawer) and "API Keys" (from UserApiKeysDrawer)
    2. Consolidate the two state variables in `Users.tsx` into a single `selectedUser` state
    3. Replace the two separate action buttons with a single "Edit" button that opens the unified drawer
    4. Remove the old `EditRoleDrawer` and `UserApiKeysDrawer` components
  * **Files**:
    * New: `repos/admin/src/components/Users/EditUserDrawer.tsx`
    * `repos/admin/src/components/Users/Users.tsx` — consolidate state and buttons
    * Remove: `repos/admin/src/components/Roles/EditRoleDrawer.tsx`
    * Remove: `repos/admin/src/components/Users/UserApiKeysDrawer.tsx`

#### Organization API Keys

* **[P3] Add User selector to CreateApiKeyDrawer**
  * The `CreateApiKeyDrawer` (`repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx`) already accepts `userId` and `userName` props (lines 27-30) and displays the user name if provided (lines 200-210), but the parent `OrgApiKeys` page (`repos/admin/src/pages/Orgs/OrgApiKeys.tsx` lines 272-278) never populates these props
  * The `createApiKey` action (line 83 of CreateApiKeyDrawer) already supports passing `userId` in the data payload
  * **Fix**:
    1. In `OrgApiKeys.tsx`, add org user loading (fetch via `usersApi.listByOrg(orgId)`) and state for available users
    2. In `CreateApiKeyDrawer.tsx`, replace the static `userName` display (lines 200-210) with an `Autocomplete` or `Select` component that lists org users. When a user is selected, set the `userId` in the form data
    3. Pass the user list to the drawer, or have the drawer load users itself
  * **Files**:
    * `repos/admin/src/components/Orgs/CreateApiKeyDrawer.tsx` — replace lines 200-210 with user selector
    * `repos/admin/src/pages/Orgs/OrgApiKeys.tsx` — add user loading and pass to drawer (lines 272-278)

#### Project Page


#### Endpoints


* **[P3] Agent type endpoint — expose all AgentDrawer options to Agent Overrides**
  * `EndpointAgent` component (`repos/admin/src/components/Endpoints/Agent/`) has limited overrides — only system prompt, model, max tokens, and tools. Missing: custom function tools, AI provider override, exposed secrets
  * Agent ID is a raw text input instead of a selector
  * **Fix**: Replace agent ID text input with `Autocomplete` that loads available agents. Add ProviderSelector, FunctionsSelector, SecretsSelector to the Agent Overrides section (reuse existing components from AgentDrawer)
  * **Files**: `repos/admin/src/components/Endpoints/Agent/EndpointAgent.tsx`, `repos/admin/src/components/Endpoints/Agent/AgentInputs.tsx`

* **[P3] Endpoint Drawer Test Tab improvements**
  * The `EndpointTestPanel` (`repos/admin/src/components/Endpoints/EndpointTestPanel.tsx`) has several UX issues:
    * **Method selector is user-configurable** (lines 71-87) but should be read-only — the method should be derived from the endpoint type: Proxy endpoints use the endpoint's `method` property, FaaS and Agent endpoints are always `POST`
    * **No query params editor** — when the method is `GET`, a Key/Value editor for query params should appear (similar to the existing headers editor at lines 97-131)
    * **No body type selector** — non-GET requests only support raw JSON via Monaco (line 138 `language='json'`). Should offer a selector for JSON (Key/Value → JSON object), FORM (Key/Value → FormData), or RAW (current Monaco editor)
    * **Send Request button is left-aligned** (line 147 `display: 'flex'`) but should be right-aligned
  * **Fix**:
    1. Replace the Method `Select` (lines 71-87) with a read-only `Chip` displaying the method derived from the endpoint
    2. Pass the `endpoint` object from `EndpointDrawer.tsx` (lines 354-359) to the test panel via props
    3. Add query params state and Key/Value editor in `useEndpointTest.ts` (following the existing header pattern at lines 44-59). Convert to query string on send
    4. Add a body type selector (`JSON` / `FORM` / `RAW`) above the body editor, and switch the editor accordingly
    5. Change the actions Box (line 147) to `justifyContent: 'flex-end'`
  * **Files**:
    * `repos/admin/src/components/Endpoints/EndpointTestPanel.tsx` — method display, query params, body type, button alignment
    * `repos/admin/src/hooks/endpoints/useEndpointTest.ts` — add query params state, body type state
    * `repos/admin/src/components/Endpoints/EndpointDrawer.tsx` — pass endpoint object to test panel (lines 354-359)



### Repl

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
