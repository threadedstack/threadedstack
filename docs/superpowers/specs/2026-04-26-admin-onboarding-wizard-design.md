# Admin Onboarding Wizard — Design Spec

## Context

The admin app's existing quickstart flow is outdated — it's agent-focused (creating provider, secret, project, agent, endpoint) and must be triggered manually from the Org page. It doesn't incorporate sandboxes, which are now the platform's primary feature. Org creation is a separate, disconnected step.

This spec replaces the quickstart with a unified onboarding wizard that:
- Triggers automatically for new users (no orgs)
- Covers org → provider → project → sandbox setup in one flow
- Supports both new and existing resources
- Is sandbox-first, not agent-first
- Can be re-used manually by existing users

## Trigger Modes

### Auto (New User)
When the root loader fetches orgs and finds `orgs.length === 0`, set `onboardingState.open = true` with `mode: 'auto'`. The Home page renders the modal. User cannot dismiss it until at least the Org step is completed.

### Manual from Home Page
A "Setup Wizard" card on the Home page. Sets `onboardingState` to `{ open: true, mode: 'manual' }`. Starts at Step 1 (Org selection/creation). Close button available.

### Manual from Org Page
A "Setup Wizard" action card (replaces old Quick Start card). Sets `onboardingState` to `{ open: true, mode: 'manual', orgId: '<currentOrgId>', startStep: 1 }`. Step 1 is pre-resolved with the active org. Modal opens at Step 2 (Provider). Close button available.

## State Management

### Jotai Atom: `onboardingState`

```typescript
type TOnboardingState = {
  open: boolean
  mode: 'auto' | 'manual'
  orgId?: string       // pre-selected org (from Org page trigger)
  startStep?: number   // which step to start on (0=Org, 1=Provider, etc.)
}
```

- Atom in `state/onboarding.ts` using `atomWithReset`
- Selector: `useOnboardingState()` in `state/selectors.ts`
- Accessors: `setOnboardingState()`, `resetOnboardingState()` in `state/accessors.ts`
- Default: `{ open: false, mode: 'auto' }`

### Local State (useOnboarding hook)

Wizard-internal state lives in the `useOnboarding` hook, not in Jotai:
- `activeStep` — current step index
- `stepData` — object holding each step's form data or selected resource
- `skippedSteps` — set of step indices that were skipped
- `submitting` / `error` — submission state
- `submitStep` — which step failed during sequential submit (for retry)

## UI Presentation

### Modal
- Large centered MUI `Dialog` (~75% viewport width, ~80% height)
- Uses existing admin MUI theme
- `mode: 'auto'` — no close button, no backdrop dismiss, no escape key
- `mode: 'manual'` — close button, backdrop click closes, escape key closes

### Layout: Vertical Stepper (Left Sidebar)
- **Left panel:** Title "Setup Wizard", 5 steps listed vertically
  - Active step: primary color highlight
  - Completed steps: checkmark icon
  - Skipped steps: skip indicator (muted)
  - Steps are clickable for backward navigation to completed/skipped steps
  - Cannot click forward past uncompleted steps
- **Right panel:** Step title + subtitle, content area, footer with navigation buttons

### Create vs Select Existing (Per Step)
Each resource step (Provider, Project, Sandbox) supports both modes:
- **No existing resources:** Create form shown directly, no choice UI
- **Has existing resources:** Two inline radio cards shown first:
  - "Create a new [resource]" 
  - "Use an existing [resource]"
  - Selecting one reveals the form or selection list below
  - Subtle back link to return to card choice (not a stepper step)

## Step Details

### Step 1 — Organization (Required)
- **New user (auto mode):** Create form — name (required), description (optional)
- **Existing user (manual from Home):** Card choice → create new or select from list of existing orgs
- **From Org page:** Step is pre-resolved and skipped entirely. Stepper shows Step 1 as completed with org name. User lands on Step 2. Clicking Step 1 in stepper shows pre-selected org with "Change" option.
- Not skippable. Next button disabled until org is selected or created.

### Step 2 — Provider (Skippable)
- **No existing providers:** Create form shown directly — brand picker (Anthropic, OpenAI, Google, Ollama, Custom), API key field, model selection
- **Has existing providers:** Card choice → create new or select from list (shows name + brand icon)
- **Skip button** with warning: "Providers are required to use sandboxes and AI features. You can add one later from the Providers page."

### Step 3 — Project (Skippable)
- **No existing projects:** Create form — name (required), description (optional)
- **Has existing projects:** Card choice → create new or select from list
- **Skip button** with warning: "Projects are required to organize your sandboxes, endpoints, and agents. You can create one later from the Projects page."

### Step 4 — Sandbox (Skippable)
Behavior depends on what was completed/skipped in earlier steps:

| Provider | Project | Sandbox Step Behavior |
|----------|---------|----------------------|
| Created/Selected | Created/Selected | Full options — pick existing sandbox or preset, auto-link both |
| Created/Selected | Skipped | Pick sandbox, link provider only. Warning: "Project was skipped — this sandbox won't be linked to a project." |
| Skipped | Created/Selected | Pick sandbox, link project only. Warning: "Provider was skipped — this sandbox won't be linked to a provider." |
| Skipped | Skipped | Warning only: "Provider and Project are required to configure a sandbox. You can set this up later." No selection UI. |

When options are shown:
- Card choice → create new sandbox or select existing (including built-in presets)
- List shows sandbox name, runtime icon, built-in badge
- Selected/created sandbox is auto-linked to available provider and/or project

### Step 5 — Review & Finish
- Checklist of each step's outcome: "Creating [name]", "Using existing [name]", or "Skipped"
- Each item shows resource type icon + name
- Each item is clickable — clicking navigates back to that step in the stepper
- Skipped items shown in muted style with "Skipped" label
- Single "Finish" button at bottom

## Submit Sequence

All resource creation happens when "Finish" is clicked, not as the user progresses through steps. Form data is collected in local state throughout the wizard.

**Execution order (sequential):**
1. Create org (if new) → get orgId. If selecting existing, use that orgId.
2. Create provider + secret (if new, using orgId) → get providerId. If selecting existing, use that providerId. Skip if step was skipped.
3. Create project (if new, using orgId) → get projectId. If selecting existing, use that projectId. Skip if step was skipped.
4. Link sandbox to provider and/or project (if sandbox step was not skipped). Uses existing sandbox update/link API endpoints.

**Error handling:**
- If any step fails, already-created resources persist (they're valid resources)
- Error displayed on the failed step with retry option
- `submitStep` tracks which step failed so retry resumes from that point

**On success:**
- Close modal, reset onboarding state
- Navigate to the org page, or project page if a project was created/selected

## API Strategy

No new backend endpoints. The wizard orchestrates existing API calls:
- `POST /orgs` — create org
- `POST /orgs/:orgId/providers` — create provider (handles secret creation)
- `POST /orgs/:orgId/projects` — create project
- Existing sandbox link/update endpoints — link sandbox to provider and project

The existing `POST /orgs/:orgId/quickstart` endpoint is removed entirely.

## Quickstart Removal

The entire quickstart system is deleted — no re-exports, no deprecation shims.

### Files to Delete

**Admin (`repos/admin/src/`):**
- `components/Quickstart/` — entire directory (11 files: index, Quickstart, QuickstartWizard, QuickstartButton, ProviderStep, AgentStep, ReviewStep, styled, plus test files)
- `hooks/components/useQuickStart.ts`
- `state/quickstart.ts`
- `services/quickstartApi.ts`
- `actions/quickstart/` — entire directory (4 files: api/create, api/index, local/toggle, index)
- `types/qs.types.ts`

**Backend (`repos/backend/src/`):**
- `endpoints/orgs/orgQuickstart.ts`
- `endpoints/orgs/orgQuickstart.test.ts`

**Domain (`repos/domain/src/`):**
- `types/quickstart.types.ts`

**Integration (`repos/integration/`):**
- `src/tier3/quickstart.test.ts`
- `src/tier3/quickstart-llm-provider.test.ts`
- `playwright/tier2/quickstart-wizard.spec.ts`

### Files to Modify (Remove References)

**Admin:**
- `state/accessors.ts` — remove quickstart accessor functions
- `state/selectors.ts` — remove quickstart imports
- `services/index.ts` — remove quickstartApi export
- `actions/index.ts` — remove quickstart actions export
- `pages/Orgs/Org.tsx` — remove Quickstart component and toggle, add onboarding trigger
- `pages/Home/Home.tsx` — add onboarding auto-trigger and setup wizard card
- `constants/nav.tsx` — remove QSSteps, add onboarding step constants

**Backend:**
- `endpoints/orgs/orgs.ts` — remove orgQuickstart route registration

**Domain:**
- `types/index.ts` — remove quickstart.types export
- `constants/providers.ts` — check if TProviderTemplate type needs migration or removal

**Integration:**
- `src/utils/tsa-cleanup.ts` — remove `cleanupQuickstart()` helper
- 46 test files across tier1/tier3 that use quickstart endpoint for fixture setup — migrate to shared fixture helper (see Integration Test Migration section below)

## Integration Test Migration

### Scope

46 test files use `POST /orgs/:orgId/quickstart` as a convenience fixture to create provider + secret + project + agent + endpoint in one call. This endpoint is being removed.

### Migration Strategy: Shared Fixture Helper

Rather than updating 46 files to each inline individual API calls, create a shared `setupFixtures()` helper that replicates the quickstart's convenience but uses individual endpoints.

**New file: `repos/integration/src/utils/fixtures.ts`**

```typescript
type TFixtureOptions = {
  orgId: string
  providerBrand?: TLLMProviderBrand  // default: 'anthropic'
  apiKey?: string                     // default: env.testProviderKey
  projectName?: string                // default: uniqueName('project')
  agentName?: string                  // default: uniqueName('agent')
  model?: string
  systemPrompt?: string
  // Control which resources to create
  createAgent?: boolean               // default: true
  createEndpoint?: boolean            // default: true
}

type TFixtureResult = {
  provider?: { id: string; [key: string]: any }
  secret?: { id: string; [key: string]: any }
  project?: { id: string; [key: string]: any }
  agent?: { id: string; [key: string]: any }
  endpoint?: { id: string; [key: string]: any }
}

// Creates resources individually via existing API endpoints
export async function setupFixtures(opts: TFixtureOptions): Promise<TFixtureResult>

// Cleans up in proper dependency order: endpoint → agent → project → secret → provider
export async function cleanupFixtures(orgId: string, result: TFixtureResult): Promise<void>
```

**Setup sequence:**
1. `POST /orgs/:orgId/providers` — create provider with brand + options
2. `POST /orgs/:orgId/secrets` — create secret with API key
3. `POST /orgs/:orgId/projects` — create project
4. `POST /orgs/:orgId/agents` — create agent linked to provider + project (if `createAgent`)
5. `POST /orgs/:orgId/projects/:projectId/endpoints` — create endpoint (if `createEndpoint`)

**Cleanup sequence (reverse dependency order):**
1. Delete endpoint (if exists)
2. Delete agent (if exists)
3. Delete project (if exists)
4. Delete secret (if exists)
5. Delete provider (if exists)

### Per-Test Migration

Each test file's migration is mechanical:

**Before:**
```typescript
import { post } from '../utils/api-client'

const quickstartResult = await post(`/orgs/${ctx.orgId}/quickstart`, {
  providerBrand: 'anthropic',
  apiKey: env.testProviderKey,
  projectName: 'test-project',
  agentName: 'test-agent',
})
```

**After:**
```typescript
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'

const fixtures = await setupFixtures({
  orgId: ctx.orgId,
  providerBrand: 'anthropic',
  apiKey: env.testProviderKey,
  projectName: 'test-project',
  agentName: 'test-agent',
})
```

The response shape (`provider`, `secret`, `project`, `agent`, `endpoint`) stays the same, so callsite changes are minimal — just the setup/cleanup function names.

### Test Files to Delete (Quickstart-Specific Tests)

These test the quickstart endpoint itself and are no longer needed:
- `repos/integration/src/tier3/quickstart.test.ts`
- `repos/integration/src/tier3/quickstart-llm-provider.test.ts`
- `repos/integration/playwright/tier2/quickstart-wizard.spec.ts`

### Test Files to Migrate (46 files)

**Tier 1 (21 files):** `agent-providers`, `agent-functions`, `agents`, `agent-project-config`, `agent-provider-models`, `providers`, `functions`, `sessions`, `session-auth`, `thread-file-upload`, `thread-message-order`, `ws-file-upload`, `ws-lifecycle`, `ws-close-resilience`, `web-tools-config`, `tsa-project-flow`, `tsa-api-client`, `tsa-chatlogic-state`, `skill-lifecycle`, `schedule-lifecycle`, `project-state-scoping`

**Tier 3 (18 files):** `agent-multi-provider`, `faas-execution`, `faas-lifecycle`, `faas-edge-cases`, `faas-json-sanitization`, `sandbox-agent-execution`, `agent-custom-functions`, `agent-partial-functions`, `thread-crud`, `thread-continuation`, `tsa-thread-lifecycle`, `tsa-executor-session`, `tsa-executor-llm`, `proxy-endpoint`, `session-chat`, `ai-stream`, `llm-chat-flow`, `run-agent`, `oai-compat`, `web-tools-e2e`, `zai-chat-flow`, `compute-tracking`, `sandbox-route-cleanup`

### Files to Remove

- `repos/integration/src/utils/tsa-cleanup.ts` — `cleanupQuickstart()` replaced by `cleanupFixtures()`

### New Onboarding-Specific Integration Tests

New tests to validate the onboarding wizard's API orchestration pattern:
- `repos/integration/src/tier1/onboarding-flow.test.ts` — tests the sequence of individual API calls the wizard makes (create org → create provider → create project → link sandbox), validates that resources are properly linked, and tests skip scenarios

## New Files

**Admin (`repos/admin/src/`):**
- `components/Onboarding/OnboardingWizard.tsx` — main modal: Dialog + vertical stepper + content routing
- `components/Onboarding/OnboardingWizard.styled.tsx` — styled components
- `components/Onboarding/steps/OrgStep.tsx` — org create/select
- `components/Onboarding/steps/ProviderStep.tsx` — provider create/select  
- `components/Onboarding/steps/ProjectStep.tsx` — project create/select
- `components/Onboarding/steps/SandboxStep.tsx` — sandbox select + linking + warnings
- `components/Onboarding/steps/ReviewStep.tsx` — summary with clickable step links
- `components/Onboarding/index.ts` — barrel export
- `hooks/components/useOnboarding.ts` — wizard orchestration hook
- `state/onboarding.ts` — Jotai atom (`TOnboardingState`)
- `types/onboarding.types.ts` — types for step data, wizard state

## Verification Plan

1. **Unit tests:** Test `useOnboarding` hook (step navigation, skip logic, submit sequence, error retry)
2. **Component tests:** Test each step component (create mode, select mode, skip warnings, sandbox linking matrix)
3. **Build:** `pnpm --filter @tdsk/admin build` passes
4. **Type check:** `cd repos/admin && pnpm types` passes
5. **Manual testing via Playwright MCP:**
   - New user flow: no orgs → auto-open → create org → create provider → create project → select sandbox → review → finish
   - Manual from Home: existing user → select existing org → mix of create/select → finish
   - Manual from Org page: skip to Provider → walk through steps → finish
   - Skip flow: skip provider + project → sandbox shows warning → finish with just org
   - Error handling: simulate API failure → error shown → retry works
6. **Integration tests:**
   - Create `setupFixtures()` / `cleanupFixtures()` helper, verify it creates and cleans up all 5 resource types
   - Migrate all 46 test files from quickstart endpoint to `setupFixtures()`
   - Run full integration suite: `cd repos/integration && pnpm test` — all existing tests pass
   - New `onboarding-flow.test.ts` passes — validates create org → provider → project → link sandbox sequence
   - Delete quickstart-specific tests, verify no references remain: `grep -r "quickstart" repos/integration/`
7. **Cross-repo type check:** `pnpm types` from root — all repos pass after quickstart type removal
