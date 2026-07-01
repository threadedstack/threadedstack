# Cleanup Plan: Items 4, 5, 6 + Docs Alignment

## Context

Memory cleanup is done. We now execute three remaining Pending Decision items as actual code work, plus aligned docs updates:

- **Item 4:** Finish legacy git field removal (Git Providers tail)
- **Item 5:** Remove client-side AST GUI in `repos/threads/src/services/gui/`
- **Item 6:** Remove the `agents` system across all repos

Order: small to large. Item 4 first, item 5 next, item 6 last. Verification runs after each phase so nothing stacks broken state.

## Decisions Locked

1. Remove `gitUrl`/`branch` getters from Project model. Update callers.
2. Delete `/_/ai/sessions` and `/ai/ws` endpoint entirely.
3. Remove only the agent junction tables. Keep skills system for sandboxes.
4. Remove `threads.agentId` column (destructive DB migration). You handle `pnpm push`.
5. Remove `terminalGui` flag from the registry entirely.
6. Delete the playwright GUI specs entirely.

---

## Phase 1: Item 4, Git Field Cleanup + Doc Alignment

### Code

1. `repos/domain/src/models/project.ts:26-44`: delete `gitProviders`, `primaryGitProvider`, `gitUrl`, `branch` computed getters. Keep `providerLinks` field.
   - If `primaryGitProvider` is reused anywhere besides the getters being removed, leave it but verify.
2. `repos/admin/src/components/Projects/ProjectCard.tsx:76-101`: replace `project.gitUrl` and `project.branch` reads. Pull the first git provider from `project.providerLinks.find(l => l.provider.type === EProvider.git)` and read `.provider.options?.repoUrl` / `.options?.branch`.
3. `repos/threads/src/components/Project/GitInfo.tsx`: this is presentational and receives `gitUrl`/`branch` as props. Update its callers (find via grep) to pass the same provider-link-derived values.
4. `repos/domain/src/models/project.test.ts`: remove test cases for the deleted getters.

### Docs

5. `docs/internal/DATA-MODEL-ARCHITECTURE.md` (read lines 98-107 first): remove the legacy `gitUrl`/`branch` field descriptions on Project; replace with a note that git config lives on linked Provider options.
6. `docs/internal/developer/data-model.md`: same cleanup.
7. `docs/features/providers.md`: read first; update sections that describe the old direct-field setup to describe the new provider linking workflow.
8. Grep the rest of `/docs/` and inline JSDoc for `sandbox.config.gitRepo`, `gitBranch`, `gitTokenSecretId`, or `project.gitUrl`. Fix any matches.

### Verification

- `pnpm types` in domain, admin, threads.
- `pnpm test` in domain, admin, threads.
- From `repos/integration/`: run `pnpm test sandbox-git-providers.test.ts`.

---

## Phase 2: Item 5, Remove Client-Side AST GUI + Doc Alignment

### Code (in order)

1. Replace AST consumers with text fallback so subsequent deletions don't dangle imports:
   - `repos/threads/src/components/ActivityFeed/ActionCard.tsx`: remove `renderDocument` import and AST render block; render a plain text fallback from existing event fields.
   - `repos/threads/src/components/ActivityFeed/TUICard.tsx`: remove `renderDocument`; render a "TUI session, view in terminal" placeholder.
   - `repos/threads/src/components/ActivityFeed/OutputCard.tsx`: same fallback pattern.
2. `repos/threads/src/actions/auth/local/reset.ts:7`: remove the `destroyAllEngines` import and call.
3. `repos/threads/src/state/accessors.ts`: remove the `SessionEngine` type import and `setGuiEngines` accessor.
4. `repos/threads/src/state/selectors.ts:72-73`: remove `useGuiAst` and `useGuiFeed`.
5. `repos/threads/src/hooks/activity/useActivityFeed.ts`: refactor to drop gui atom deps (or delete if only the deleted components used it).
6. Delete in this exact order so imports never dangle:
   - `repos/threads/src/components/SessionGUIView/` (entire directory)
   - `repos/threads/src/components/ASTNodes/` (15 files)
   - `repos/threads/src/actions/gui/` (5 files)
   - `repos/threads/src/hooks/session/useSessionEngine.ts`
   - `repos/threads/src/state/gui.ts` (4 atoms)
   - `repos/threads/src/services/gui/` (42 files)
7. Feature flag: remove `terminalGui` entry from `repos/domain/src/constants/featureFlags.ts`. Also update `repos/domain/src/types/featureFlag.types.ts` if `terminalGui` appears in a union.
8. Delete `repos/integration/playwright/tier2/threads-gui-view.spec.ts` and any sibling GUI specs (grep for `gui` and `ASTNode` in playwright tier2 to be sure).

### Docs

9. Append a "**STATUS: SCRATCHED 2026-06-27** (see memory `project_terminal_ast_gui_progress.md`)" marker at the top of these files. Do not delete, they're historical record:
   - `docs/internal/superpowers/plans/2026-04-15-terminal-ast-gui.md`
   - `docs/internal/superpowers/specs/2026-04-15-terminal-ast-gui-design.md`
   - `docs/internal/superpowers/plans/2026-04-12-terminal-parser-redesign.md`
   - `docs/internal/superpowers/specs/2026-04-12-terminal-parser-redesign-design.md`
10. `docs/internal/superpowers/specs/2026-04-18-feature-flags-design.md`: remove `terminalGui` flag description.
11. `docs/internal/developer/threads-app-internals.md`: remove ChatView/SessionGUIView/AST pipeline references; describe current terminal-only session view.
12. `docs/internal/developer/threads-internals.md`: same cleanup.
13. `docs/internal/business/go-to-market.md`: review beta validation section; remove generative-UI-as-feature claims if present.
14. `.claude/skills/tdsk-threads/SKILL.md`: remove AST GUI / ASTNodes / tokenizer/parser/visitor/engine references; update to reflect terminal-only session UI.
15. Root `CLAUDE.md`: scan for AST GUI references and `terminalGui` flag mentions; update.

### Verification

- `pnpm types` in threads, components, domain, integration.
- `pnpm test` in threads.
- `cd repos/threads && pnpm start`: open a session, verify terminal renders cleanly, activity feed degrades to text fallback with no console errors.

---

## Phase 3: Item 6, Remove Agents System + Doc Alignment

Sequenced bottom-up. After each step run `pnpm types` to catch dangling imports immediately.

### Step 1: Backend endpoints and services

- Delete `repos/backend/src/endpoints/agents/` (entire directory, 18 files).
- Delete `repos/backend/src/endpoints/ai/` (entire directory, both the session creation and WS handler).
- Delete `repos/backend/src/utils/agent/`.
- Delete `repos/backend/src/services/endpoints/agentEndpoint.ts` + test.
- Delete `repos/backend/src/endpoints/orgs/orgAgents.ts`.
- `repos/backend/src/endpoints/orgs/orgs.ts`: remove `orgAgents` import + route registration.
- `repos/backend/src/endpoints/orgs/orgProjects.ts`: remove `featureGate` import if only used for agents, agent endpoint imports (lines 38-42 + 53-55), `projectAgentConfig` and `projectAgents` definitions (lines 140-162), and the `projectAgents` export (line 250).
- `repos/backend/src/services/endpoints/getEPService.ts`: remove `EEndpointType.agent` case + update tests.
- `repos/backend/src/services/websocket/websocket.ts`: remove `handlePrompt`, `resolveSession`, and any `AgentRunner` usage; update tests.
- `repos/backend/src/endpoints/threads/threads.ts`: remove agent-scoped thread routes and any handlers that filter by `agentId`.
- `repos/backend/src/services/sessionToken.ts`: remove agent-specific session token issuance; if the file is entirely agent-only, delete it.
- `repos/backend/src/types/`: delete `agent.types.ts` and `session.types.ts` if agent-only; otherwise strip agent fields.

### Step 2: Admin UI

- Delete pages: `repos/admin/src/pages/Orgs/OrgAgents.tsx`, `pages/Projects/ProjectAgents.tsx`, `pages/Projects/ProjectAgent.tsx`.
- Delete components: `repos/admin/src/components/Agents/` (12 files), `components/Selectors/AgentSelector.tsx` + test, `components/Endpoints/Agent/` (entire dir), `components/Endpoints/Tabs/AgentConfigTab.tsx`.
- Delete actions: `repos/admin/src/actions/agents/` (13 files), `actions/endpoints/local/setAgentFormField.ts`.
- Delete services: `repos/admin/src/services/agentWSService.ts`, `services/agentsApi.ts`.
- Delete state: `repos/admin/src/state/agents.ts`.
- Delete utils: `repos/admin/src/utils/nav/buildAgentNav.tsx`.
- Delete hooks: `repos/admin/src/hooks/chat/useAgentChat.ts` + test, `hooks/endpoints/useAgentFormState.ts`.
- Delete types: `repos/admin/src/types/agent.types.ts`.
- Modify `repos/admin/src/state/selectors.ts`: remove `useProjectAgents`, `useOrgAgents`.
- Modify `repos/admin/src/types/routes.types.ts`: remove the 13 agent route enum entries.
- Modify `repos/admin/src/constants/nav.tsx`: remove `OrgSubNav.Agents` block, `ProjectSubNav.Agents` block, related exports.
- Modify `repos/admin/src/constants/endpoints.ts`: remove `DefAgentState` and the `TAgentFormState` import.
- Modify `repos/admin/src/components/AI/ThreadsTab.tsx`: remove agent list display; update tests.

### Step 3: TSA + Threads sweep

- Delete `repos/tsa/src/tasks/agents.ts`, `repos/tsa/src/types/agent.types.ts`.
- Modify TSA tasks index and API client: remove agent task and methods.
- `repos/threads/src/`: grep for `agent` (excluding "sub-agent" / "subagent" / Antigravity / agentic-tool brand strings). Expected minimal; clean up any matches.

### Step 4: Database, Domain, headless agent package

- Database schema deletes:
  - `repos/database/src/schemas/agents.ts`
  - `repos/database/src/schemas/agentProjects.ts`
  - `repos/database/src/schemas/agentProviders.ts`
  - `repos/database/src/schemas/agentSkills.ts`
- `repos/database/src/schemas/schemas.ts`: remove the 4 agent schema export lines.
- `repos/database/src/schemas/threads.ts`: remove the `agents` import, the `agentId` column, the agentId index, and the `agent` relation entry. Per decision 4, this drops the column.
- `repos/database/src/schemas/secrets.ts`: if there's an `agentId` owner field on secrets, remove it.
- `repos/database/src/services/agent.ts` + test: delete.
- `repos/database/src/services/index.ts`: remove agent service export.
- `repos/database/src/services/thread.ts`: remove any agent-scoped queries / agentId filters.
- Seeds: `repos/database/src/seeds/fullorg.ts` and `ids.seed.ts`: remove agent seed data and `AgentIdPrefix` references.
- Domain deletes:
  - `repos/domain/src/types/agent.types.ts`
  - `repos/domain/src/models/agent.ts` + test
- Domain modify:
  - `repos/domain/src/types/index.ts`: remove agent type export.
  - `repos/domain/src/models/index.ts`: remove agent model export.
  - `repos/domain/src/types/permissions.types.ts`: remove `agent` from `EPermResource`.
  - `repos/domain/src/constants/featureFlags.ts`: remove `agents` flag.
  - `repos/domain/src/constants/values.ts`: remove `[EPermResource.agent]: EPermScope.project` from `ResourceScope`; remove dead agent permissions from `RoleTemplates`.
- Headless agent package: delete `repos/agent/` entirely.
- Dependency cleanup:
  - `repos/backend/package.json`: remove `"@tdsk/agent": "workspace:*"`.
  - `repos/backend/tsconfig.json`: remove `@tdsk/agent` path aliases.
  - `repos/integration/tsconfig.json`: remove `@tdsk/agent` aliases.
  - `repos/tsa/package.json` and `tsconfig.json`: remove if present.
  - Root: run `pnpm install` to regenerate lockfile.

### Step 5: Integration tests

- Delete tier1 specs: `agents.test.ts`, `agent-functions.test.ts`, `agent-providers.test.ts`, `agent-provider-models.test.ts`, `agent-project-config.test.ts`.
- Delete tier3 specs: `run-agent.test.ts`, `sandbox-agent-execution.test.ts`, `agent-custom-functions.test.ts`, `agent-partial-functions.test.ts`, `agent-multi-provider.test.ts`.
- Delete any playwright tier2 specs that test agent UI.
- Modify utilities: `repos/integration/src/utils/fixtures.ts`, `test-context.ts`, `tsa-cleanup.ts`, `setup/global-setup.ts`, `utils/sse.ts`, `utils/ws-client.ts`: remove agent helpers.

### Step 6: Documentation

Delete:
- `docs/internal/AGENT_INSTRUCTIONS.md`
- `docs/internal/developer/agent-endpoints-internals.md`
- `docs/user-guide/images/admin-agent-config.png`
- `repos/website/dist/docs-assets/user-guide/images/admin-agent-config.png` (rebuild website assets after)

Modify (read each file first, then edit):
- `docs/internal/DATA-MODEL-ARCHITECTURE.md`: delete section 2.5 (Agent), section 6.2 (Provider-Agent Relationship), and sections 2.19 / 2.20 (agent_projects, agent_functions junctions).
- `docs/internal/developer/data-model.md`: remove Agent entity sections.
- `docs/internal/developer/request-flow.md`: remove the `/_/agents/*` route on line 193, remove the SSE section 6.1 (lines 337-345), remove `/_/ai/sessions` and `/ai/ws` references.
- `docs/internal/business/go-to-market.md`: remove or reframe step 8 (the platform pitch is now sandboxes, not agents).
- `docs/internal/business/value-proposition.md`: remove agent orchestration claims.
- `docs/internal/developer/security-model-internals.md`: remove agent credential injection sections.
- `docs/internal/developer/platform-overview-internals.md`: remove agent CRUD/execution references.
- `docs/internal/developer/sandbox-architecture.md`: remove agent-sandbox integration sections.
- `docs/internal/developer/sandbox-connect-internals.md`: remove agent connection references.
- `docs/internal/tech-spec.md`: remove `agents` table reference at line 103.
- `docs/internal/endpoints/faas.md`: remove agent endpoint type mention.
- `docs/user-guide/api-reference.md`: remove any residual agent endpoint references.
- `docs/user-guide/sandbox-usage.md`: remove agent setup steps.
- `docs/user-guide/getting-started.md`: remove agent steps.
- `repos/admin/README.md`, `repos/backend/README.md`, `repos/tsa/README.md`: remove agent feature descriptions.

Append "**STATUS: REMOVED 2026-06-27**" marker to historical plan files (do not delete):
- `docs/internal/superpowers/plans/2026-04-09-provider-links-refactor.md`
- `docs/internal/superpowers/plans/2026-04-26-admin-onboarding-wizard.md`
- `docs/internal/superpowers/plans/2026-04-03-design-docs.md`
- `docs/internal/superpowers/plans/2026-04-27-website-docs-improvements.md`

Root `CLAUDE.md`:
- Remove agent endpoint mappings from the Architecture section: `/_/agents/*`, `/_/ai/sessions`, `/ai/ws`.
- Remove `agent/` row from workspace table.
- Remove `tdsk-agent` row from skill table.
- Remove agent references from the Database Schema section.

Skill files:
- Delete `.claude/skills/tdsk-agent/SKILL.md`.
- Modify `.claude/skills/tdsk-backend/SKILL.md`: remove agent endpoint and AI WebSocket descriptions.
- Modify `.claude/skills/tdsk-database/SKILL.md`: remove `agents`, `agent_projects`, `agent_providers`, `agent_skills` from the schema list; correct the table count from 32.
- Modify `.claude/skills/tdsk-admin/SKILL.md`: remove agent UI references.
- Modify `.claude/skills/tdsk-tsa/SKILL.md`: remove agent task references.

### Verification (after Phase 3)

- `pnpm types` across all repos: domain, database, logger, backend, proxy, admin, threads, tsa, components, sandbox, integration, website.
- `pnpm test` across all repos.
- Build chain in order: domain, database, logger, backend, proxy, admin.
- DB push (you handle): `cd repos/database && pnpm push`. Drizzle will prompt about dropped tables and the `threads.agent_id` column. Confirm in the interactive prompt.
- From `repos/integration/`: tier1 minus agent specs, tier3 minus agent specs.
- Live system: `tdsk dev start --clean` is already running. Run `curl -sf https://local.threadedstack.app/health` and `/_/health`. Open the admin UI; verify no agent links surface, no console errors, sandbox flows work.
- Manual: grep for `@tdsk/agent`, `EPermResource.agent`, `featureGate('agents')`, `agentId`. Should return zero results except in historical plan/spec files.

---

## Critical Files Reference

- `repos/domain/src/models/project.ts` (Phase 1 getters)
- `repos/domain/src/constants/featureFlags.ts` (Phases 2 & 3 flags)
- `repos/domain/src/types/permissions.types.ts` (Phase 3 EPermResource)
- `repos/database/src/schemas/schemas.ts` (Phase 3 exports)
- `repos/database/src/schemas/threads.ts` (Phase 3 agentId removal)
- `repos/backend/src/endpoints/orgs/orgProjects.ts` (Phase 3 routes)
- `repos/backend/src/services/websocket/websocket.ts` (Phase 3 agent message handlers)
- `repos/backend/src/services/endpoints/getEPService.ts` (Phase 3 EEndpointType.agent)
- `repos/admin/src/constants/nav.tsx` (Phase 3 nav cleanup)
- `repos/admin/src/types/routes.types.ts` (Phase 3 routes)
- `repos/threads/src/state/gui.ts` (Phase 2 atoms)
- `repos/threads/src/actions/auth/local/reset.ts` (Phase 2 destroyAllEngines)
- `repos/threads/src/components/ActivityFeed/ActionCard.tsx` (Phase 2 renderDocument)
- `repos/threads/src/components/ActivityFeed/TUICard.tsx` (Phase 2 renderDocument)
- `docs/internal/DATA-MODEL-ARCHITECTURE.md` (Phases 1 & 3)
- `docs/internal/developer/request-flow.md` (Phase 3 routes)
- Root `CLAUDE.md` (Phase 3 architecture section)

## Risk Notes

- DB push for Phase 3 is interactive; only you can confirm the destructive prompts. I will stop at that gate.
- Phase 3 is large enough that mid-flight aborts leave the codebase non-compiling. We type-check after each step so a failure is contained to the step.
- After backend deletes, type-check before touching the admin: admin imports backend types via shared domain, so a domain change cascade is the most likely break point.
- A final grep sweep at the end (`@tdsk/agent`, `agentId`, `EPermResource.agent`, `featureGate('agents')`) catches anything missed.
- I will NOT run any git commands per your rules. You handle commits at whatever cadence you prefer.
