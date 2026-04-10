# Sandbox Provider Auth — UI Fix Handoff Prompt

> Paste this into a new Claude Code session to continue where we left off.

## Context

The **Sandbox Provider Auth** feature was implemented by an agent from the plan at `docs/superpowers/plans/2026-04-07-sandbox-provider-auth.md`. A subsequent review session fixed bugs and refactored the shared `ProviderLinkList` component. However, multiple UI issues remain that need to be resolved.

## Known Issues (in priority order)

### Issue 1: Provider endpoints not registered on the actual org-scoped sandbox router (CRITICAL — causes all 404s)

The provider endpoints (`linkProvider`, `unlinkProvider`, `listSandboxProviders`) were added to `repos/backend/src/endpoints/sandboxes/sandboxes.ts`, but **that file is NOT the one actually mounted in the Express app**. The real router is `repos/backend/src/endpoints/orgs/orgSandboxes.ts` — mounted at `/:orgId/sandboxes`. It's missing all three provider endpoints.

**Fix**: Add the three provider imports and endpoints to `repos/backend/src/endpoints/orgs/orgSandboxes.ts`. Use the same route ordering fix — provider routes (`listSandboxProviders`, `linkProvider`, `unlinkProvider`) must be registered BEFORE `getSandbox` (which has path `/:id` and would shadow `/:id/providers` if registered first).

The file `repos/backend/src/endpoints/sandboxes/sandboxes.ts` already has the correct imports and ordering — use it as reference. But `orgSandboxes.ts` is the one that matters.

### Issue 2: `fetchSandboxProviders` has a race condition — returns empty because sandboxes aren't loaded yet

`repos/admin/src/actions/sandboxes/api/fetchSandboxProviders.ts` calls `getSandboxes()` synchronously at line 11. But it's called in parallel with `fetchSandboxes` in the route loader (`repos/admin/src/routes/loaders.ts`), so `getSandboxes()` returns `undefined` and the function exits immediately without fetching any provider data.

**Fix**: The sandbox provider fetch needs to happen AFTER sandboxes are loaded. Options:
- Make the loader sequential: `await safeFetch(() => fetchSandboxes({ orgId }))` first, then `safeFetch(() => fetchSandboxProviders({ orgId }))` 
- OR have `fetchSandboxProviders` accept sandbox IDs directly instead of reading from Jotai

### Issue 3: ProviderLinkList shows only compatible brands text but no dropdown in sandbox drawer

The `ProviderLinkList` component at `repos/admin/src/components/Providers/ProviderLinkList.tsx` has two modes controlled by the `reorderable` prop:
- **Reorderable mode** (agents): Shows add button → Autocomplete on click
- **Non-reorderable mode** (sandboxes): Shows always-visible Autocomplete dropdown

The sandbox drawer does NOT pass `reorderable`, so it uses non-reorderable mode. The Autocomplete at line 229 renders only when `!reorderable && availableProviders.length > 0`. If `availableProviders` is empty (because org providers haven't loaded from Jotai, or because all are filtered as incompatible), the dropdown won't render.

Check that `useProviders()` returns data. If the providers loader hasn't run for the sandbox pages, the `providersMap` will be `undefined` and `orgProviders` will be `[]`. The sandbox page loaders (`orgSandboxesLoader`, `projectSandboxesLoader`) may need to also fetch providers like the agents loader does.

### Issue 4: ConnectModal still has a useEffect that calls an action

`repos/admin/src/components/Sandboxes/ConnectModal.tsx` lines 57-76 still has a `useEffect` calling `getSandboxSessions()`. Sessions are ephemeral pod state and don't have a Jotai atom, so this is harder to move to a loader. This is lower priority but should be addressed eventually.

## Architecture Rules (CRITICAL — user has been very clear about these)

1. **NEVER use useEffect for API calls or data loading in components** — use route loaders + actions + Jotai atoms
2. **Components read data from Jotai selectors** — never call API services directly
3. **Actions call API services and update Jotai state** — components call actions, not services
4. **The data loading pattern is**: Jotai atom → accessors → selector hook → fetch action → route loader via `safeFetch()`
5. **NEVER run git commit, git push, or any git write commands**

## Key Files

### Backend (endpoint registration)
- `repos/backend/src/endpoints/orgs/orgSandboxes.ts` — **THE ACTUAL ROUTER** (missing provider endpoints)
- `repos/backend/src/endpoints/sandboxes/sandboxes.ts` — standalone router (has provider endpoints but is NOT mounted under orgs)
- `repos/backend/src/endpoints/sandboxes/linkProvider.ts` — POST `/:id/providers`
- `repos/backend/src/endpoints/sandboxes/unlinkProvider.ts` — DELETE `/:id/providers/:providerId`
- `repos/backend/src/endpoints/sandboxes/listSandboxProviders.ts` — GET `/:id/providers`

### Admin (state + loaders)
- `repos/admin/src/state/sandboxes.ts` — `sandboxProvidersState` atom
- `repos/admin/src/state/accessors.ts` — `getSandboxProviders`, `setSandboxProvidersState`
- `repos/admin/src/state/selectors.ts` — `useSandboxProviders`
- `repos/admin/src/actions/sandboxes/api/fetchSandboxProviders.ts` — fetch action (has race condition)
- `repos/admin/src/actions/sandboxes/api/linkSandboxProvider.ts` — link action (updates Jotai)
- `repos/admin/src/actions/sandboxes/api/unlinkSandboxProvider.ts` — unlink action (updates Jotai)
- `repos/admin/src/routes/loaders.ts` — `orgSandboxesLoader` and `projectSandboxesLoader`

### Admin (components)
- `repos/admin/src/components/Providers/ProviderLinkList.tsx` — shared component (two modes: reorderable/non-reorderable)
- `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx` — sandbox create/edit drawer with provider section
- `repos/admin/src/components/Sandboxes/Sandboxes.tsx` — sandbox list page with auth column
- `repos/admin/src/components/Sandboxes/ConnectModal.tsx` — SSH connect modal with provider warning

### Admin (services)
- `repos/admin/src/services/sandboxApi.ts` — `listProviders()`, `linkProvider()`, `unlinkProvider()` methods

## How the provider data flow SHOULD work

1. Route loader calls `fetchSandboxes()` then `fetchSandboxProviders()` (sequentially, not parallel)
2. `fetchSandboxProviders` reads sandbox IDs from Jotai, calls `sandboxApi.listProviders()` for each, writes results to `sandboxProvidersState`
3. Components read from `useSandboxProviders()` and `useProviders()` — zero useEffect, zero direct API calls
4. On link/unlink in edit mode: call the action (`linkSandboxProvider`/`unlinkSandboxProvider`) which updates Jotai state
5. On create mode: store pending providers in local state, send with create payload

## DB Schema Note

The `sandbox_providers` table may not exist yet. The user needs to run `cd repos/database && pnpm push` to create it. The table schema is at `repos/database/src/schemas/sandboxProviders.ts`.

## What to do

1. Load the `tdsk-admin` and `tdsk-backend` skills first
2. Fix Issue 1: Add provider endpoints to `orgSandboxes.ts` with correct ordering
3. Fix Issue 2: Make `fetchSandboxProviders` run after sandboxes are loaded
4. Fix Issue 3: Ensure providers loader runs on sandbox pages so the dropdown populates
5. Verify with `pnpm types` and `pnpm test` in both admin and backend repos
6. Ask the user to test manually in the browser
