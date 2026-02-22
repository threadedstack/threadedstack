## TODO

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


### Admin

#### General

* **[P2] Search inputs should have white background in light-mode**
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
| **P1** — UX blockers | Org members | 1 |
| **P2** — UI polish | Search bg, quickstart UI (4 sub), proxy endpoint UX, sidebar (2), users table | 9 |
| **P3** — New features | Agent endpoint overrides, reusable selectors | 2 |
| **P4** — Major refactor | Project-level agent overrides | 1 |

