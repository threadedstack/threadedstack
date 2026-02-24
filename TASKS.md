## TODO

Priority: P0 = broken functionality, P1 = UX blockers, P2 = UI polish, P3 = new features, P4 = major refactor


### Admin

#### General

* **[P3] Create reusable Selector components**
  * Several entity selectors exist but aren't standardized:
    * `FunctionsSelector` — `repos/admin/src/components/Agents/FunctionsSelector.tsx`
    * `SecretsSelector` — `repos/admin/src/components/Agents/SecretsSelector.tsx`
    * `ToolsSelector` — `repos/admin/src/components/Agents/ToolsSelector.tsx`
  * All follow the same pattern (MUI Autocomplete, multiple selection, custom render option). Missing selectors: **ProviderSelector**, **AgentSelector**, **EndpointSelector**
  * **Fix**:
    1. Extract a generic `EntitySelector` base component with the common Autocomplete pattern
    2. Build missing selectors: `ProviderSelector`, `AgentSelector`, `EndpointSelector`, `UserSelector`.
    3. Move selectors from `components/Agents/` to `components/Selectors/` for shared use
    4. Reuse across: AgentDrawer, EndpointDrawer (Agent type), ThreadsTab
  * **Files**:
    * New: `repos/admin/src/components/Selectors/EntitySelector.tsx`
    * New: `repos/admin/src/components/Selectors/ProviderSelector.tsx`
    * New: `repos/admin/src/components/Selectors/AgentSelector.tsx`
    * New: `repos/admin/src/components/Selectors/UserSelector.tsx`
    * Refactor: Move `FunctionsSelector`, `SecretsSelector`, `ToolsSelector`


#### Endpoints


* **[P3] Agent type endpoint — expose all AgentDrawer options to Agent Overrides**
  * `EndpointAgent` component (`repos/admin/src/components/Endpoints/Agent/`) has limited overrides — only system prompt, model, max tokens, and tools. Missing: custom function tools, AI provider override, exposed secrets
  * Agent ID is a raw text input instead of a selector
  * **Fix**: Replace agent ID text input with `Autocomplete` that loads available agents. Add ProviderSelector, FunctionsSelector, SecretsSelector to the Agent Overrides section (reuse existing components from AgentDrawer)
  * **Files**: `repos/admin/src/components/Endpoints/Agent/EndpointAgent.tsx`, `repos/admin/src/components/Endpoints/Agent/AgentInputs.tsx`



#### Quickstart Drawer


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


### Backend


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
