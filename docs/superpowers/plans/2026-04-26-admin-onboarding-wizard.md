# Admin Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outdated agent-focused quickstart with a sandbox-first onboarding wizard that auto-triggers for new users and supports both creating and selecting existing resources.

**Architecture:** Centered MUI Dialog with vertical stepper (left sidebar), 5 steps: Org → Provider → Project → Sandbox → Review. Jotai atom controls open/mode/context. Existing API endpoints orchestrated on "Finish" — no new backend endpoints. Full quickstart removal across admin, backend, domain, and integration repos.

**Tech Stack:** React, MUI Dialog/Stepper, Jotai (atomWithReset), existing admin API services (orgsApi, providersApi, projectsApi, sandboxApi), Vitest

**Spec:** `docs/superpowers/specs/2026-04-26-admin-onboarding-wizard-design.md`

**CRITICAL RULES (include in ALL subagent prompts):**
- NEVER run `git commit`, `git push`, or any git write command
- NEVER save files to the root folder
- NEVER add TODO/FIXME comments
- Exported types go in `repos/admin/src/types/`, not co-located
- Use deep-path imports (e.g., `@TAF/actions/orgs/api/createOrg`) not barrel imports
- Accessors (state/accessors.ts) must NEVER be called from components — only from actions. Components call actions; actions call accessors.
- Use `TextInput` from `@tdsk/components` for form inputs, NOT MUI `TextField`. `TextInput` supports: `label`, `value`, `onChange`, `required`, `type`, `placeholder`, `textarea` (for multiline), `fullWidth`.

---

## Phase 1: Quickstart Removal

### Task 1: Remove Quickstart — Admin State, Services, Actions

**Files:**
- Delete: `repos/admin/src/state/quickstart.ts`
- Delete: `repos/admin/src/services/quickstartApi.ts`
- Delete: `repos/admin/src/actions/quickstart/` (entire directory)
- Delete: `repos/admin/src/types/qs.types.ts`
- Modify: `repos/admin/src/state/accessors.ts:39,95-97`
- Modify: `repos/admin/src/state/selectors.ts:25,125`
- Modify: `repos/admin/src/services/index.ts:25`
- Modify: `repos/admin/src/actions/index.ts:11`

- [ ] **Step 1: Delete quickstart state, services, actions, and types**

```bash
rm repos/admin/src/state/quickstart.ts
rm repos/admin/src/services/quickstartApi.ts
rm -rf repos/admin/src/actions/quickstart
rm repos/admin/src/types/qs.types.ts
```

- [ ] **Step 2: Remove quickstart from accessors.ts**

In `repos/admin/src/state/accessors.ts`:
- Remove line 39: `import { quickstartState } from '@TAF/state/quickstart'`
- Remove lines 95-97:
```typescript
export const getQuickstartOpen = () => store.get(quickstartState)
export const resetQuickstartOpen = () => store.set(quickstartState, false)
export const setQuickstartOpen = (status: boolean) => store.set(quickstartState, status)
```

- [ ] **Step 3: Remove quickstart from selectors.ts**

In `repos/admin/src/state/selectors.ts`:
- Remove line 25: `import { quickstartState } from '@TAF/state/quickstart'`
- Remove line 125: `export const useQuickstartOpen = () => useRecState(quickstartState)`

- [ ] **Step 4: Remove quickstart from service and action barrel exports**

In `repos/admin/src/services/index.ts`:
- Remove: `export * from './quickstartApi'`

In `repos/admin/src/actions/index.ts`:
- Remove: `export * from './quickstart'`

- [ ] **Step 5: Verify no remaining quickstart imports in admin**

Run: `cd repos/admin && grep -r "quickstart\|QuickStart\|quick_start" src/ --include="*.ts" --include="*.tsx" -l`

Expected: Only `components/Quickstart/` files and `pages/Orgs/Org.tsx` (handled in Task 2)

---

### Task 2: Remove Quickstart — Admin Components and Pages

**Files:**
- Delete: `repos/admin/src/components/Quickstart/` (entire directory)
- Delete: `repos/admin/src/hooks/components/useQuickStart.ts`
- Modify: `repos/admin/src/pages/Orgs/Org.tsx`
- Modify: `repos/admin/src/constants/nav.tsx:176-177`

- [ ] **Step 1: Delete quickstart components and hook**

```bash
rm -rf repos/admin/src/components/Quickstart
rm repos/admin/src/hooks/components/useQuickStart.ts
```

- [ ] **Step 2: Remove quickstart from Org.tsx**

In `repos/admin/src/pages/Orgs/Org.tsx`:
- Remove line 12: `import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'`
- Remove line 13: `import { Quickstart } from '@TAF/components/Quickstart/Quickstart'`
- Remove line 16: `import { toggleQuickStart } from '@TAF/actions/quickstart/local/toggle'`
- In the ActionCards `actions` array (lines 189-214), remove the Quick Start action object (lines 191-195):
```typescript
{
  title: `Quick Start`,
  Icon: RocketLaunchIcon,
  onClick: () => toggleQuickStart(true),
  subtitle: `Everything you need in one place`,
},
```
- Remove line 217: `<Quickstart button={false} />`

- [ ] **Step 3: Remove QSSteps from constants/nav.tsx**

In `repos/admin/src/constants/nav.tsx`:
- Remove lines 176-177:
```typescript
// Steps for the Quick Start section
export const QSSteps = [`AI Provider`, `Project & Agent`, `Review & Create`]
```

- [ ] **Step 4: Verify no remaining quickstart references in admin**

Run: `cd repos/admin && grep -r "quickstart\|QuickStart\|QSSteps\|useQuickStart\|toggleQuickStart" src/ --include="*.ts" --include="*.tsx" -l`

Expected: No results

- [ ] **Step 5: Verify admin builds**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds with no errors

---

### Task 3: Remove Quickstart — Backend and Domain

**Files:**
- Delete: `repos/backend/src/endpoints/orgs/orgQuickstart.ts`
- Delete: `repos/backend/src/endpoints/orgs/orgQuickstart.test.ts`
- Delete: `repos/domain/src/types/quickstart.types.ts`
- Modify: `repos/backend/src/endpoints/orgs/orgs.ts:18,54`
- Modify: `repos/domain/src/types/index.ts:23`

- [ ] **Step 1: Delete backend quickstart endpoint and tests**

```bash
rm repos/backend/src/endpoints/orgs/orgQuickstart.ts
rm repos/backend/src/endpoints/orgs/orgQuickstart.test.ts
```

- [ ] **Step 2: Remove orgQuickstart from orgs router**

In `repos/backend/src/endpoints/orgs/orgs.ts`:
- Remove import: `import { orgQuickstart } from '@TBE/endpoints/orgs/orgQuickstart'`
- Remove from endpoints object: `orgQuickstart,`

- [ ] **Step 3: Migrate reusable types from quickstart.types.ts, then delete it**

`TProviderTemplate` and `TProviderModel` are used by `repos/domain/src/constants/providers.ts` and the new onboarding wizard. Move them to `repos/domain/src/types/provider.types.ts` (or the existing ai.types.ts). Remove the quickstart-only types (`TQuickstartRequest`, `TQuickstartResponse`).

Create `repos/domain/src/types/provider.types.ts`:

```typescript
import type { TLLMProviderBrand, TModelCost } from '@TDM/types/ai.types'

export type TProviderModel = {
  id: string
  name: string
  maxTokens?: number
  description?: string
  contextWindow?: number
  reasoning?: boolean
  cost?: TModelCost
  inputTypes?: string[]
}

export type TProviderTemplate = {
  name: string
  baseUrl: string
  id: TLLMProviderBrand
  apiKeyPattern?: string
  defaultSecretName: string
  apiKeyPlaceholder: string
}
```

In `repos/domain/src/types/index.ts`:
- Remove: `export * from './quickstart.types'`
- Add: `export * from './provider.types'`

In `repos/domain/src/constants/providers.ts`:
- Change import from `import type { TProviderTemplate } from '@TDM/types'` (no change needed since we export from index)

Delete the old file:
```bash
rm repos/domain/src/types/quickstart.types.ts
```

- [ ] **Step 4: Verify no remaining quickstart type references**

Run: `grep -r "TQuickstartRequest\|TQuickstartResponse\|quickstart\.types" repos/domain/src/ repos/backend/src/ repos/admin/src/ --include="*.ts" --include="*.tsx" -l`

Expected: No results

- [ ] **Step 5: Verify backend and domain build and type check**

Run: `cd repos/backend && pnpm build && pnpm types`

Expected: Build and types pass

Run: `cd repos/domain && pnpm types`

Expected: Types pass

---

### Task 4: Remove Quickstart — Integration Tests

**Files:**
- Delete: `repos/integration/src/tier3/quickstart.test.ts`
- Delete: `repos/integration/src/tier3/quickstart-llm-provider.test.ts`
- Delete: `repos/integration/playwright/tier2/quickstart-wizard.spec.ts`
- Modify: `repos/integration/src/utils/tsa-cleanup.ts`

- [ ] **Step 1: Delete quickstart-specific test files**

```bash
rm repos/integration/src/tier3/quickstart.test.ts
rm repos/integration/src/tier3/quickstart-llm-provider.test.ts
rm repos/integration/playwright/tier2/quickstart-wizard.spec.ts
```

- [ ] **Step 2: Remove cleanupQuickstart from tsa-cleanup.ts**

In `repos/integration/src/utils/tsa-cleanup.ts`:
- Remove the `cleanupQuickstart` export function (lines 7-21)
- Keep `cleanupThread` and any other helpers

- [ ] **Step 3: Verify no import of cleanupQuickstart**

Run: `grep -r "cleanupQuickstart" repos/integration/src/ --include="*.ts" -l`

Expected: No results (or fix any remaining imports)

---

### Task 5: Create Integration Test Fixture Helper

**Files:**
- Create: `repos/integration/src/utils/fixtures.ts`

- [ ] **Step 1: Create the setupFixtures and cleanupFixtures helper**

Create `repos/integration/src/utils/fixtures.ts`:

```typescript
import type { TLLMProviderBrand } from '@tdsk/domain'

import { env } from './env'
import { uniqueName } from './unique-name'
import { post, del, get } from './api-client'

export type TFixtureOptions = {
  orgId: string
  providerBrand?: TLLMProviderBrand
  apiKey?: string
  projectName?: string
  agentName?: string
  model?: string
  systemPrompt?: string
  createAgent?: boolean
  createEndpoint?: boolean
}

export type TFixtureResult = {
  provider?: Record<string, any>
  secret?: Record<string, any>
  project?: Record<string, any>
  agent?: Record<string, any>
  endpoint?: Record<string, any>
}

export const setupFixtures = async (opts: TFixtureOptions): Promise<TFixtureResult> => {
  const {
    orgId,
    providerBrand = `anthropic`,
    apiKey = env.testProviderKey,
    projectName = uniqueName(`project`),
    agentName = uniqueName(`agent`),
    model,
    systemPrompt,
    createAgent = true,
    createEndpoint = true,
  } = opts

  const result: TFixtureResult = {}

  const provResp = await post(`/orgs/${orgId}/providers`, {
    name: `${providerBrand}-provider-${Date.now()}`,
    type: `ai`,
    orgId,
    brand: providerBrand,
    options: {},
  })
  if (provResp.status !== 201) throw new Error(`Failed to create provider: ${provResp.status}`)
  result.provider = provResp.data

  const secretResp = await post(`/orgs/${orgId}/secrets`, {
    name: `${providerBrand}-key-${Date.now()}`,
    value: apiKey,
    providerId: result.provider.id,
  })
  if (secretResp.status !== 201) throw new Error(`Failed to create secret: ${secretResp.status}`)
  result.secret = secretResp.data

  const projResp = await post(`/orgs/${orgId}/projects`, {
    name: projectName,
    orgId,
  })
  if (projResp.status !== 201) throw new Error(`Failed to create project: ${projResp.status}`)
  result.project = projResp.data

  if (createAgent) {
    const agentResp = await post(`/orgs/${orgId}/agents`, {
      name: agentName,
      orgId,
      providerInputs: [{ id: result.provider.id }],
      projectIds: [result.project.id],
      ...(model && { model }),
      ...(systemPrompt && { systemPrompt }),
    })
    if (agentResp.status !== 201) throw new Error(`Failed to create agent: ${agentResp.status}`)
    result.agent = agentResp.data

    if (createEndpoint) {
      const slug = agentName.toLowerCase().replace(/[^a-z0-9-]/g, `-`)
      const epResp = await post(`/orgs/${orgId}/projects/${result.project.id}/endpoints`, {
        name: `${agentName}-endpoint`,
        path: `/ai/${slug}-${Date.now()}`,
        type: `agent`,
        method: `post`,
        projectId: result.project.id,
        options: { agentId: result.agent.id },
      })
      if (epResp.status !== 201) throw new Error(`Failed to create endpoint: ${epResp.status}`)
      result.endpoint = epResp.data
    }
  }

  return result
}

export const cleanupFixtures = async (
  orgId: string,
  result: TFixtureResult
): Promise<void> => {
  if (result.endpoint?.id && result.project?.id)
    await del(`/orgs/${orgId}/projects/${result.project.id}/endpoints/${result.endpoint.id}`).catch(() => {})
  if (result.agent?.id)
    await del(`/orgs/${orgId}/agents/${result.agent.id}`).catch(() => {})
  if (result.project?.id)
    await del(`/orgs/${orgId}/projects/${result.project.id}`).catch(() => {})
  if (result.secret?.id)
    await del(`/orgs/${orgId}/secrets/${result.secret.id}`).catch(() => {})
  if (result.provider?.id)
    await del(`/orgs/${orgId}/providers/${result.provider.id}`).catch(() => {})
}
```

- [ ] **Step 2: Verify the helper compiles**

Run: `cd repos/integration && npx tsc --noEmit src/utils/fixtures.ts`

Expected: No type errors

---

### Task 6: Migrate Integration Tests to Fixture Helper

**Files:**
- Modify: 46 test files across `repos/integration/src/tier1/` and `repos/integration/src/tier3/`

This is a mechanical migration. For each test file that uses `post(\`/orgs/\${...}/quickstart\`, ...)`:

- [ ] **Step 1: Identify all files to migrate**

Run: `grep -r "quickstart" repos/integration/src/ --include="*.ts" -l`

- [ ] **Step 2: For each file, apply this transformation**

**Before pattern:**
```typescript
const quickstartResult = await post(`/orgs/${ctx.orgId}/quickstart`, {
  providerBrand: 'anthropic',
  apiKey: env.testProviderKey,
  projectName: uniqueName('project'),
  agentName: uniqueName('agent'),
})
// ... access quickstartResult.data.provider, .secret, .project, .agent, .endpoint
```

**After pattern:**
```typescript
import { setupFixtures, cleanupFixtures } from '../utils/fixtures'

const fixtures = await setupFixtures({
  orgId: ctx.orgId,
  providerBrand: 'anthropic',
  apiKey: env.testProviderKey,
  projectName: uniqueName('project'),
  agentName: uniqueName('agent'),
})
// ... access fixtures.provider, .secret, .project, .agent, .endpoint
```

Key differences:
- Import `setupFixtures`/`cleanupFixtures` from `../utils/fixtures`
- Replace `post(\`/orgs/.../quickstart\`, {...})` with `setupFixtures({...})`
- Response data was at `quickstartResult.data.provider` — now directly at `fixtures.provider`
- Replace inline cleanup or `cleanupQuickstart()` calls with `cleanupFixtures(orgId, fixtures)`
- Remove unused quickstart imports

**For tests that check `quickstartResult.status === 201`:** Replace with a truthy check on the fixture result since `setupFixtures` throws on failure.

- [ ] **Step 3: Verify no quickstart references remain**

Run: `grep -r "quickstart\|cleanupQuickstart" repos/integration/src/ --include="*.ts" -l`

Expected: No results

- [ ] **Step 4: Run integration tests**

Run: `cd repos/integration && pnpm test`

Expected: All tests pass (minus pre-existing flaky `ai-stream.test.ts`)

---

## Phase 2: Onboarding State & Types

### Task 7: Create Onboarding Types

**Files:**
- Create: `repos/admin/src/types/onboarding.types.ts`

- [ ] **Step 1: Create the onboarding types file**

Create `repos/admin/src/types/onboarding.types.ts`:

```typescript
import type { TLLMProviderBrand } from '@tdsk/domain'

export type TOnboardingMode = `auto` | `manual`

export type TOnboardingState = {
  open: boolean
  mode: TOnboardingMode
  orgId?: string
  startStep?: number
}

export const DefOnboardingState: TOnboardingState = {
  open: false,
  mode: `auto`,
}

export type TOnboardingProviderData = {
  apiKey: string
  model: string
  providerUrl: string
  providerName: string
  providerBrand: TLLMProviderBrand
}

export type TOnboardingProjectData = {
  name: string
  description: string
}

export type TOnboardingOrgData = {
  name: string
  description: string
}

export type TOnboardingSandboxData = {
  sandboxId: string
}

export type TResourceMode = `create` | `select`

export type TStepOutcome = `creating` | `selected` | `skipped`
export type TOnboardingStepMode = `create` | `select` | `skip`

export type TOnboardingStepData = {
  org: { mode: Omit<TOnboardingStepMode, `skip`>; data?: TOnboardingOrgData; selectedId?: string; selectedName?: string }
  provider: { mode: TOnboardingStepMode; data?: TOnboardingProviderData; selectedId?: string; selectedName?: string }
  project: { mode: TOnboardingStepMode; data?: TOnboardingProjectData; selectedId?: string; selectedName?: string }
  sandbox: { mode: TOnboardingStepMode; data?: TOnboardingSandboxData; selectedId?: string; selectedName?: string }
}


export type TStepResult = {
  outcome: TStepOutcome
  resourceId?: string
  resourceName?: string
}

export const OnboardingSteps = [
  `Organization`,
  `Provider`,
  `Project`,
  `Sandbox`,
  `Review`,
] as const

export type TOnboardingStepName = (typeof OnboardingSteps)[number]
```

- [ ] **Step 2: Export from types index**

In `repos/admin/src/types/index.ts`, add:
```typescript
export * from './onboarding.types'
```

- [ ] **Step 3: Verify types compile**

Run: `cd repos/admin && pnpm types`

Expected: No type errors

---

### Task 8: Create Onboarding Jotai State

**Files:**
- Create: `repos/admin/src/state/onboarding.ts`
- Modify: `repos/admin/src/state/accessors.ts`
- Modify: `repos/admin/src/state/selectors.ts`

- [ ] **Step 1: Create the onboarding atom**

Create `repos/admin/src/state/onboarding.ts`:

```typescript
import { atomWithReset } from 'jotai/utils'
import { DefOnboardingState } from '@TAF/types'
import type { TOnboardingState } from '@TAF/types'

export const onboardingState = atomWithReset<TOnboardingState>(DefOnboardingState)
```

- [ ] **Step 2: Add onboarding accessors**

In `repos/admin/src/state/accessors.ts`:

Add import (near other state imports):
```typescript
import { onboardingState } from '@TAF/state/onboarding'
```

Add import for the type and default (at top with other type imports):
```typescript
import type { TOnboardingState } from '@TAF/types'
import { DefOnboardingState } from '@TAF/types'
```

Add accessor functions (where the quickstart accessors were removed, around line 95):
```typescript
export const getOnboardingState = () => store.get(onboardingState)
export const resetOnboardingState = () => store.set(onboardingState, DefOnboardingState)
export const setOnboardingState = (state: TOnboardingState) =>
  store.set(onboardingState, state)
```

- [ ] **Step 3: Add onboarding selector**

In `repos/admin/src/state/selectors.ts`:

Add import (where quickstart import was removed):
```typescript
import { onboardingState } from '@TAF/state/onboarding'
```

Add selector (where quickstart selector was removed):
```typescript
export const useOnboardingState = () => useRecState(onboardingState)
```

- [ ] **Step 4: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

### Task 9: Create Onboarding Actions

**Files:**
- Create: `repos/admin/src/actions/onboarding/local/openOnboarding.ts`
- Create: `repos/admin/src/actions/onboarding/local/closeOnboarding.ts`
- Create: `repos/admin/src/actions/onboarding/local/index.ts`
- Create: `repos/admin/src/actions/onboarding/index.ts`
- Modify: `repos/admin/src/actions/index.ts`

- [ ] **Step 1: Create openOnboarding action**

Create `repos/admin/src/actions/onboarding/local/openOnboarding.ts`:

```typescript
import type { TOnboardingState } from '@TAF/types'

import { DefOnboardingState } from '@TAF/types'
import { setOnboardingState } from '@TAF/state/accessors'

export const openOnboarding = (opts?: Partial<Omit<TOnboardingState, 'open'>>) => {
  setOnboardingState({
    ...DefOnboardingState,
    ...opts,
    open: true,
  })
}
```

- [ ] **Step 2: Create closeOnboarding action**

Create `repos/admin/src/actions/onboarding/local/closeOnboarding.ts`:

```typescript
import { resetOnboardingState } from '@TAF/state/accessors'

export const closeOnboarding = () => {
  resetOnboardingState()
}
```

- [ ] **Step 3: Create barrel exports**

Create `repos/admin/src/actions/onboarding/local/index.ts`:

```typescript
export { openOnboarding } from './openOnboarding'
export { closeOnboarding } from './closeOnboarding'
```

Create `repos/admin/src/actions/onboarding/index.ts`:

```typescript
export * from './local'
```

- [ ] **Step 4: Add to actions barrel**

In `repos/admin/src/actions/index.ts`, add (where quickstart export was removed):

```typescript
export * from './onboarding'
```

- [ ] **Step 5: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

## Phase 3: Onboarding Hook

### Task 10: Create useOnboarding Hook

**Files:**
- Create: `repos/admin/src/hooks/components/useOnboarding.ts`

- [ ] **Step 1: Create the wizard orchestration hook**

Create `repos/admin/src/hooks/components/useOnboarding.ts`:

```typescript
import { useState, useCallback, useMemo } from 'react'
import type {
  TStepResult,
  TOnboardingState,
  TOnboardingOrgData,
  TOnboardingStepMode,
  TOnboardingStepData,
  TOnboardingProjectData,
  TOnboardingSandboxData,
  TOnboardingProviderData,
} from '@TAF/types'
import { nav } from '@TAF/services'
import { useOnboardingState } from '@TAF/state/selectors'
import { createOrg } from '@TAF/actions/orgs/api/createOrg'
import { OnboardingSteps, DefOnboardingState } from '@TAF/types'
import { createProject } from '@TAF/actions/projects/api/createProject'
import { createProvider } from '@TAF/actions/providers/api/createProvider'
import { updateSandbox } from '@TAF/actions/sandboxes/api/updateSandbox'
import { closeOnboarding } from '@TAF/actions/onboarding/local/closeOnboarding'

const DefStepData: TOnboardingStepData = {
  org: { mode: `create` },
  provider: { mode: `create` },
  project: { mode: `create` },
  sandbox: { mode: `create` },
}

export const useOnboarding = () => {
  const [onboarding] = useOnboardingState()

  const [activeStep, setActiveStep] = useState(onboarding.startStep || 0)
  const [stepData, setStepData] = useState<TOnboardingStepData>(DefStepData)
  const [skippedSteps, setSkippedSteps] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [submitStep, setSubmitStep] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const steps = OnboardingSteps

  const isFirstStep = activeStep === 0
  const isLastStep = activeStep === steps.length - 1
  const isReviewStep = activeStep === steps.length - 1

  const isProviderSkipped = skippedSteps.has(1)
  const isProjectSkipped = skippedSteps.has(2)

  const canDismiss = onboarding.mode === `manual`

  const onNext = useCallback(() => {
    if (activeStep < steps.length - 1) {
      setError(null)
      setActiveStep((s) => s + 1)
    }
  }, [activeStep, steps.length])

  const onBack = useCallback(() => {
    if (activeStep > 0) {
      setError(null)
      setActiveStep((s) => s - 1)
    }
  }, [activeStep])

  const onStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex < activeStep || skippedSteps.has(stepIndex)) {
        setError(null)
        setActiveStep(stepIndex)
      }
    },
    [activeStep, skippedSteps]
  )

  const onSkip = useCallback(
    (stepIndex: number) => {
      setSkippedSteps((prev) => new Set([...prev, stepIndex]))
      const stepKey = ([`org`, `provider`, `project`, `sandbox`] as const)[stepIndex]
      if (stepKey) {
        setStepData((prev) => ({
          ...prev,
          [stepKey]: { mode: `skip` as const },
        }))
      }
      onNext()
    },
    [onNext]
  )

  const updateStepData = useCallback(
    <K extends keyof TOnboardingStepData>(key: K, data: TOnboardingStepData[K]) => {
      setStepData((prev) => ({ ...prev, [key]: data }))
      skippedSteps.has([`org`, `provider`, `project`, `sandbox`].indexOf(key)) &&
        setSkippedSteps((prev) => {
          const next = new Set(prev)
          next.delete([`org`, `provider`, `project`, `sandbox`].indexOf(key))
          return next
        })
    },
    [skippedSteps]
  )

  const getStepResult = useCallback(
    (stepIndex: number): TStepResult => {
      if (skippedSteps.has(stepIndex)) return { outcome: `skipped` }
      const keys = [`org`, `provider`, `project`, `sandbox`] as const
      const key = keys[stepIndex]
      if (!key) return { outcome: `skipped` }
      const data = stepData[key]
      if (data.mode === `select`)
        return { outcome: `selected`, resourceId: data.selectedId, resourceName: data.selectedName }
      if (data.mode === `create`) {
        const name =
          key === `org` ? data.data?.name :
          key === `provider` ? data.data?.providerBrand :
          key === `project` ? data.data?.name :
          key === `sandbox` ? data.selectedName : undefined
        return { outcome: `creating`, resourceName: name }
      }
      return { outcome: `skipped` }
    },
    [stepData, skippedSteps]
  )

  const onSubmit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    setSubmitStep(null)

    let orgId = onboarding.orgId || stepData.org.selectedId
    let providerId = stepData.provider.selectedId
    let projectId = stepData.project.selectedId

    try {
      // Step 1: Org
      if (stepData.org.mode === `create` && stepData.org.data) {
        setSubmitStep(0)
        const result = await createOrg({
          name: stepData.org.data.name,
          description: stepData.org.data.description || undefined,
        })
        if (result.error) throw result.error
        orgId = result.org?.id
      }

      if (!orgId) throw new Error(`Organization is required`)

      // Step 2: Provider
      if (!skippedSteps.has(1) && stepData.provider.mode === `create` && stepData.provider.data) {
        setSubmitStep(1)
        const result = await createProvider({
          orgId,
          data: {
            name: stepData.provider.data.providerName || `${stepData.provider.data.providerBrand}-provider`,
            type: `ai`,
            orgId,
            brand: stepData.provider.data.providerBrand,
            options: stepData.provider.data.providerUrl
              ? { baseUrl: stepData.provider.data.providerUrl }
              : {},
          },
        })
        if (result.error) throw result.error
        providerId = result.data?.id
      }

      // Step 3: Project
      if (!skippedSteps.has(2) && stepData.project.mode === `create` && stepData.project.data) {
        setSubmitStep(2)
        const result = await createProject({
          name: stepData.project.data.name,
          description: stepData.project.data.description || undefined,
          orgId,
        })
        if (result.error) throw result.error
        projectId = result.data?.id
      }

      // Step 4: Sandbox linking
      if (!skippedSteps.has(3) && stepData.sandbox.selectedId) {
        setSubmitStep(3)
        const updateData: Record<string, any> = {}
        if (providerId) updateData.providerInputs = [{ id: providerId }]
        if (projectId) updateData.projectIds = [projectId]

        if (Object.keys(updateData).length > 0) {
          const result = await updateSandbox({
            id: stepData.sandbox.selectedId,
            orgId,
            data: updateData,
          })
          if (result.error) throw result.error
        }
      }

      // Success
      setSubmitting(false)
      closeOnboarding()
      if (projectId && orgId) nav.to(`/orgs/${orgId}/projects/${projectId}`)
      else if (orgId) nav.to(`/orgs/${orgId}`)
    } catch (err: any) {
      setSubmitting(false)
      setError(err?.message || `An error occurred during setup`)
    }
  }, [onboarding, stepData, skippedSteps])

  const onClose = useCallback(() => {
    if (!canDismiss) return
    closeOnboarding()
    setActiveStep(0)
    setStepData(DefStepData)
    setSkippedSteps(new Set())
    setError(null)
    setSubmitting(false)
    setSubmitStep(null)
  }, [canDismiss])

  return {
    steps,
    error,
    onBack,
    onNext,
    onSkip,
    onClose,
    onSubmit,
    stepData,
    submitting,
    onboarding,
    submitStep,
    activeStep,
    canDismiss,
    isLastStep,
    isFirstStep,
    isReviewStep,
    onStepClick,
    skippedSteps,
    getStepResult,
    setActiveStep,
    updateStepData,
    isProviderSkipped,
    isProjectSkipped,
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

## Phase 4: Wizard UI Components

### Task 11: Create Onboarding Styled Components

**Files:**
- Create: `repos/admin/src/components/Onboarding/OnboardingWizard.styled.tsx`

- [ ] **Step 1: Create styled components**

Create `repos/admin/src/components/Onboarding/OnboardingWizard.styled.tsx`:

```typescript
import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'

export const WizardContainer = styled(Box)(({ theme }) => ({
  display: `flex`,
  height: `100%`,
  overflow: `hidden`,
}))

export const StepperPanel = styled(Box)(({ theme }) => ({
  width: 220,
  flexShrink: 0,
  borderRight: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.action.hover,
  padding: theme.spacing(3, 2),
  display: `flex`,
  flexDirection: `column`,
}))

export const ContentPanel = styled(Box)(({ theme }) => ({
  flex: 1,
  display: `flex`,
  flexDirection: `column`,
  overflow: `hidden`,
}))

export const ContentBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: `auto`,
  padding: theme.spacing(3),
}))

export const ContentFooter = styled(Box)(({ theme }) => ({
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2, 3),
  display: `flex`,
  justifyContent: `space-between`,
  alignItems: `center`,
  gap: theme.spacing(1),
}))

export const ResourceChoiceCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== `selected`,
})<{ selected?: boolean }>(({ theme, selected }) => ({
  border: `1px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  cursor: `pointer`,
  transition: `all 0.2s`,
  backgroundColor: selected ? theme.palette.action.selected : `transparent`,
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}))

export const SkipWarning = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `flex-start`,
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.warning.main + `14`,
  border: `1px solid ${theme.palette.warning.main}33`,
}))
```

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

### Task 12: Create OrgStep Component

**Files:**
- Create: `repos/admin/src/components/Onboarding/steps/OrgStep.tsx`

- [ ] **Step 1: Create OrgStep**

Create `repos/admin/src/components/Onboarding/steps/OrgStep.tsx`:

```typescript
import type { TOnboardingStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import { useState, useCallback } from 'react'
import { useOrgs } from '@TAF/state/selectors'
import { TextInput } from '@tdsk/components'
import { ResourceChoiceCard } from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TOrgStep = {
  preSelectedOrgId?: string
  stepData: TOnboardingStepData['org']
  onUpdate: (data: TOnboardingStepData['org']) => void
}

export const OrgStep = (props: TOrgStep) => {
  const { stepData, preSelectedOrgId, onUpdate } = props
  const [orgs] = useOrgs()
  const orgsArray = orgs ? Object.values(orgs) : []
  const hasExisting = orgsArray.length > 0

  const [showChoice, setShowChoice] = useState(
    hasExisting && !preSelectedOrgId && stepData.mode !== `create` && stepData.mode !== `select`
  )

  const onSelectMode = useCallback(
    (mode: 'create' | 'select') => {
      setShowChoice(false)
      onUpdate({ mode, data: mode === `create` ? { name: ``, description: `` } : undefined })
    },
    [onUpdate]
  )

  const onSelectOrg = useCallback(
    (org: { id: string; name: string }) => {
      onUpdate({ mode: `select`, selectedId: org.id, selectedName: org.name })
    },
    [onUpdate]
  )

  const onBackToChoice = useCallback(() => {
    setShowChoice(true)
    onUpdate({ mode: `create` })
  }, [onUpdate])

  if (preSelectedOrgId) {
    const org = orgsArray.find((o) => o.id === preSelectedOrgId)
    return (
      <Box>
        <Text variant='h6' gutterBottom>Organization</Text>
        <Text color='text.secondary' sx={{ mb: 2 }}>
          Setting up resources for this organization
        </Text>
        <Box sx={{ p: 2, border: 1, borderColor: `primary.main`, borderRadius: 1, bgcolor: `action.selected` }}>
          <Text variant='subtitle1' fontWeight={600}>{org?.name || preSelectedOrgId}</Text>
          {org?.description && <Text variant='body2' color='text.secondary'>{org.description}</Text>}
        </Box>
        {orgsArray.length > 1 && (
          <Button size='small' onClick={() => onUpdate({ mode: `select` })} sx={{ mt: 1 }}>
            Change organization
          </Button>
        )}
      </Box>
    )
  }

  if (showChoice) {
    return (
      <Box>
        <Text variant='h6' gutterBottom>Organization</Text>
        <Text color='text.secondary' sx={{ mb: 3 }}>
          Choose an existing organization or create a new one
        </Text>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <ResourceChoiceCard onClick={() => onSelectMode(`create`)}>
            <Text variant='subtitle1' fontWeight={600}>Create a new organization</Text>
            <Text variant='body2' color='text.secondary'>Start fresh with a new organization</Text>
          </ResourceChoiceCard>
          <ResourceChoiceCard onClick={() => onSelectMode(`select`)}>
            <Text variant='subtitle1' fontWeight={600}>Use an existing organization</Text>
            <Text variant='body2' color='text.secondary'>Select from your {orgsArray.length} organization{orgsArray.length !== 1 ? `s` : ``}</Text>
          </ResourceChoiceCard>
        </Box>
      </Box>
    )
  }

  if (stepData.mode === `select`) {
    return (
      <Box>
        <Box sx={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, mb: 2 }}>
          <Text variant='h6'>Select Organization</Text>
          {hasExisting && (
            <Button size='small' onClick={onBackToChoice}>Back</Button>
          )}
        </Box>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          {orgsArray.map((org) => (
            <ResourceChoiceCard
              key={org.id}
              selected={stepData.selectedId === org.id}
              onClick={() => onSelectOrg({ id: org.id, name: org.name })}
            >
              <Text variant='subtitle1' fontWeight={600}>{org.name}</Text>
              {org.description && <Text variant='body2' color='text.secondary'>{org.description}</Text>}
            </ResourceChoiceCard>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, mb: 2 }}>
        <Text variant='h6'>Create Organization</Text>
        {hasExisting && (
          <Button size='small' onClick={onBackToChoice}>Back</Button>
        )}
      </Box>
      <Text color='text.secondary' sx={{ mb: 3 }}>
        Name your organization to get started
      </Text>
      <TextInput
        fullWidth
        required
        label='Organization name'
        value={stepData.data?.name || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { name: e.target.value, description: stepData.data?.description || `` },
          })
        }
      />
      <TextInput
        fullWidth
        textarea
        label='Description (optional)'
        value={stepData.data?.description || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { name: stepData.data?.name || ``, description: e.target.value },
          })
        }
      />
    </Box>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

### Task 13: Create ProviderStep Component

**Files:**
- Create: `repos/admin/src/components/Onboarding/steps/ProviderStep.tsx`

- [ ] **Step 1: Create ProviderStep**

Create `repos/admin/src/components/Onboarding/steps/ProviderStep.tsx`:

```typescript
import type { TLLMProviderBrand } from '@tdsk/domain'
import type { TOnboardingStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import { useState, useCallback } from 'react'
import { TextInput } from '@tdsk/components'
import { ProviderTemplates } from '@tdsk/domain'
import { useProviders } from '@TAF/state/selectors'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { ResourceChoiceCard, SkipWarning } from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TProviderStep = {
  stepData: TOnboardingStepData[`provider`]
  onUpdate: (data: TOnboardingStepData[`provider`]) => void
  onSkip: () => void
}

const brands = Object.entries(ProviderTemplates) as [TLLMProviderBrand, (typeof ProviderTemplates)[keyof typeof ProviderTemplates]][]

export const ProviderStep = (props: TProviderStep) => {
  const { stepData, onUpdate, onSkip } = props
  const [providers] = useProviders()
  const providersArray = providers ? Object.values(providers) : []
  const hasExisting = providersArray.length > 0

  const [showChoice, setShowChoice] = useState(
    hasExisting && stepData.mode !== `create` && stepData.mode !== `select`
  )

  const onSelectMode = useCallback(
    (mode: 'create' | 'select') => {
      setShowChoice(false)
      onUpdate({
        mode,
        data: mode === `create` ? { apiKey: ``, model: ``, providerUrl: ``, providerName: ``, providerBrand: `anthropic` as TLLMProviderBrand } : undefined,
      })
    },
    [onUpdate]
  )

  const onBackToChoice = useCallback(() => {
    setShowChoice(true)
    onUpdate({ mode: `create` })
  }, [onUpdate])

  if (showChoice) {
    return (
      <Box>
        <Text variant='h6' gutterBottom>AI Provider</Text>
        <Text color='text.secondary' sx={{ mb: 3 }}>
          Connect an AI provider or use one you've already configured
        </Text>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <ResourceChoiceCard onClick={() => onSelectMode(`create`)}>
            <Text variant='subtitle1' fontWeight={600}>Add a new provider</Text>
            <Text variant='body2' color='text.secondary'>Configure a new AI provider with API key</Text>
          </ResourceChoiceCard>
          <ResourceChoiceCard onClick={() => onSelectMode(`select`)}>
            <Text variant='subtitle1' fontWeight={600}>Use an existing provider</Text>
            <Text variant='body2' color='text.secondary'>Select from your {providersArray.length} configured provider{providersArray.length !== 1 ? `s` : ``}</Text>
          </ResourceChoiceCard>
        </Box>
        <Box sx={{ mt: 3, display: `flex`, justifyContent: `flex-end` }}>
          <Button size='small' color='warning' onClick={onSkip}>
            Skip this step
          </Button>
        </Box>
        <SkipWarning>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text variant='body2' color='text.secondary'>
            Providers are required to use sandboxes and AI features. You can add one later from the Providers page.
          </Text>
        </SkipWarning>
      </Box>
    )
  }

  if (stepData.mode === `select`) {
    return (
      <Box>
        <Box sx={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, mb: 2 }}>
          <Text variant='h6'>Select Provider</Text>
          <Button size='small' onClick={onBackToChoice}>Back</Button>
        </Box>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          {providersArray.map((prov) => (
            <ResourceChoiceCard
              key={prov.id}
              selected={stepData.selectedId === prov.id}
              onClick={() => onUpdate({ mode: `select`, selectedId: prov.id, selectedName: prov.name })}
            >
              <Text variant='subtitle1' fontWeight={600}>{prov.name}</Text>
              <Text variant='body2' color='text.secondary'>{prov.brand || prov.type}</Text>
            </ResourceChoiceCard>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, mb: 2 }}>
        <Text variant='h6'>Add Provider</Text>
        {hasExisting && <Button size='small' onClick={onBackToChoice}>Back</Button>}
      </Box>
      <Text color='text.secondary' sx={{ mb: 3 }}>
        Select your AI provider and enter your API key
      </Text>
      <Text variant='subtitle2' sx={{ mb: 1 }}>Provider</Text>
      <Box sx={{ display: `flex`, flexWrap: `wrap`, gap: 1, mb: 3 }}>
        {brands.map(([brand, template]) => (
          <ResourceChoiceCard
            key={brand}
            selected={stepData.data?.providerBrand === brand}
            onClick={() =>
              onUpdate({
                mode: `create`,
                data: {
                  ...(stepData.data || { apiKey: ``, model: ``, providerUrl: ``, providerName: `` }),
                  providerBrand: brand,
                  providerName: template?.name || brand,
                  providerUrl: template?.baseUrl || ``,
                },
              })
            }
            sx={{ flex: `0 0 auto`, minWidth: 100, textAlign: `center`, py: 1.5 }}
          >
            <Text variant='body2' fontWeight={600}>{template?.name || brand}</Text>
          </ResourceChoiceCard>
        ))}
      </Box>
      <TextInput
        fullWidth
        required
        type='password'
        label='API Key'
        placeholder={ProviderTemplates[stepData.data?.providerBrand as keyof typeof ProviderTemplates]?.apiKeyPlaceholder || `Enter API key`}
        value={stepData.data?.apiKey || ``}
        onChange={(e) =>
          onUpdate({ mode: `create`, data: { ...stepData.data!, apiKey: e.target.value } })
        }
      />
      {!hasExisting && (
        <Box sx={{ mt: 2, display: `flex`, justifyContent: `flex-end` }}>
          <Button size='small' color='warning' onClick={onSkip}>
            Skip this step
          </Button>
        </Box>
      )}
      {!hasExisting && (
        <SkipWarning>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text variant='body2' color='text.secondary'>
            Providers are required to use sandboxes and AI features. You can add one later from the Providers page.
          </Text>
        </SkipWarning>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

### Task 14: Create ProjectStep Component

**Files:**
- Create: `repos/admin/src/components/Onboarding/steps/ProjectStep.tsx`

- [ ] **Step 1: Create ProjectStep**

This follows the same create/select/skip pattern as ProviderStep but with project fields (name, description). Create `repos/admin/src/components/Onboarding/steps/ProjectStep.tsx`:

```typescript
import type { TOnboardingStepData } from '@TAF/types'
import Box from '@mui/material/Box'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import { useState, useCallback } from 'react'
import { TextInput } from '@tdsk/components'
import { useProjects } from '@TAF/state/selectors'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { ResourceChoiceCard, SkipWarning } from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TProjectStep = {
  onSkip: () => void
  stepData: TOnboardingStepData['project']
  onUpdate: (data: TOnboardingStepData['project']) => void
}

export const ProjectStep = (props: TProjectStep) => {
  const { stepData, onUpdate, onSkip } = props
  const [projects] = useProjects()
  const projectsArray = projects ? Object.values(projects) : []
  const hasExisting = projectsArray.length > 0

  const [showChoice, setShowChoice] = useState(
    hasExisting && stepData.mode !== `create` && stepData.mode !== `select`
  )

  const onSelectMode = useCallback(
    (mode: 'create' | 'select') => {
      setShowChoice(false)
      onUpdate({
        mode,
        data: mode === `create` ? { name: ``, description: `` } : undefined,
      })
    },
    [onUpdate]
  )

  const onBackToChoice = useCallback(() => {
    setShowChoice(true)
    onUpdate({ mode: `create` })
  }, [onUpdate])

  if (showChoice) {
    return (
      <Box>
        <Text variant='h6' gutterBottom>Project</Text>
        <Text color='text.secondary' sx={{ mb: 3 }}>
          Create a project to organize your sandboxes, endpoints, and agents
        </Text>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
          <ResourceChoiceCard onClick={() => onSelectMode(`create`)}>
            <Text variant='subtitle1' fontWeight={600}>Create a new project</Text>
            <Text variant='body2' color='text.secondary'>Start a new project for your work</Text>
          </ResourceChoiceCard>
          <ResourceChoiceCard onClick={() => onSelectMode(`select`)}>
            <Text variant='subtitle1' fontWeight={600}>Use an existing project</Text>
            <Text variant='body2' color='text.secondary'>Select from your {projectsArray.length} project{projectsArray.length !== 1 ? `s` : ``}</Text>
          </ResourceChoiceCard>
        </Box>
        <Box sx={{ mt: 3, display: `flex`, justifyContent: `flex-end` }}>
          <Button size='small' color='warning' onClick={onSkip}>
            Skip this step
          </Button>
        </Box>
        <SkipWarning>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text variant='body2' color='text.secondary'>
            Projects are required to organize your sandboxes, endpoints, and agents. You can create one later from the Projects page.
          </Text>
        </SkipWarning>
      </Box>
    )
  }

  if (stepData.mode === `select`) {
    return (
      <Box>
        <Box sx={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, mb: 2 }}>
          <Text variant='h6'>Select Project</Text>
          <Button size='small' onClick={onBackToChoice}>Back</Button>
        </Box>
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
          {projectsArray.map((proj) => (
            <ResourceChoiceCard
              key={proj.id}
              selected={stepData.selectedId === proj.id}
              onClick={() => onUpdate({ mode: `select`, selectedId: proj.id, selectedName: proj.name })}
            >
              <Text variant='subtitle1' fontWeight={600}>{proj.name}</Text>
              {proj.description && <Text variant='body2' color='text.secondary'>{proj.description}</Text>}
            </ResourceChoiceCard>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: `flex`, alignItems: `center`, justifyContent: `space-between`, mb: 2 }}>
        <Text variant='h6'>Create Project</Text>
        {hasExisting && <Button size='small' onClick={onBackToChoice}>Back</Button>}
      </Box>
      <Text color='text.secondary' sx={{ mb: 3 }}>
        Projects organize your sandboxes, endpoints, and agents
      </Text>
      <TextInput
        fullWidth
        required
        label='Project name'
        value={stepData.data?.name || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { name: e.target.value, description: stepData.data?.description || `` },
          })
        }
      />
      <TextInput
        fullWidth
        textarea
        label='Description (optional)'
        value={stepData.data?.description || ``}
        onChange={(e) =>
          onUpdate({
            mode: `create`,
            data: { name: stepData.data?.name || ``, description: e.target.value },
          })
        }
      />
      {!hasExisting && (
        <Box sx={{ mt: 2, display: `flex`, justifyContent: `flex-end` }}>
          <Button size='small' color='warning' onClick={onSkip}>
            Skip this step
          </Button>
        </Box>
      )}
      {!hasExisting && (
        <SkipWarning>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text variant='body2' color='text.secondary'>
            Projects are required to organize your sandboxes, endpoints, and agents. You can create one later from the Projects page.
          </Text>
        </SkipWarning>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

### Task 15: Create SandboxStep Component

**Files:**
- Create: `repos/admin/src/components/Onboarding/steps/SandboxStep.tsx`

- [ ] **Step 1: Create SandboxStep**

Create `repos/admin/src/components/Onboarding/steps/SandboxStep.tsx`:

```typescript
import type { TOnboardingStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import { useState, useCallback } from 'react'
import { useOrgSandboxes } from '@TAF/state/selectors'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { ResourceChoiceCard, SkipWarning } from '@TAF/components/Onboarding/OnboardingWizard.styled'

export type TSandboxStep = {
  stepData: TOnboardingStepData['sandbox']
  isProviderSkipped: boolean
  isProjectSkipped: boolean
  onUpdate: (data: TOnboardingStepData['sandbox']) => void
  onSkip: () => void
}

export const SandboxStep = (props: TSandboxStep) => {
  const { stepData, isProviderSkipped, isProjectSkipped, onUpdate, onSkip } = props
  const [sandboxes] = useOrgSandboxes()
  const sandboxesArray = sandboxes ? Object.values(sandboxes) : []

  const bothSkipped = isProviderSkipped && isProjectSkipped

  if (bothSkipped) {
    return (
      <Box>
        <Text variant='h6' gutterBottom>Sandbox</Text>
        <Alert severity='warning' sx={{ mt: 2 }}>
          Provider and Project are required to configure a sandbox. You can set this up later from the Sandboxes page after creating a provider and project.
        </Alert>
      </Box>
    )
  }

  const partialWarning = isProviderSkipped
    ? `Provider was skipped — this sandbox won't be linked to a provider.`
    : isProjectSkipped
      ? `Project was skipped — this sandbox won't be linked to a project.`
      : null

  return (
    <Box>
      <Text variant='h6' gutterBottom>Sandbox</Text>
      <Text color='text.secondary' sx={{ mb: 2 }}>
        Select a sandbox to link with your provider and project
      </Text>

      {partialWarning && (
        <SkipWarning sx={{ mb: 2 }}>
          <WarningAmberIcon sx={{ color: `warning.main`, fontSize: 18, mt: 0.25 }} />
          <Text variant='body2' color='text.secondary'>{partialWarning}</Text>
        </SkipWarning>
      )}

      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
        {sandboxesArray.map((sb) => (
          <ResourceChoiceCard
            key={sb.id}
            selected={stepData.selectedId === sb.id}
            onClick={() => onUpdate({ mode: `select`, selectedId: sb.id, selectedName: sb.name, data: { sandboxId: sb.id } })}
          >
            <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
              <Text variant='subtitle1' fontWeight={600}>{sb.name}</Text>
              {sb.builtIn && <Chip label='Built-in' size='small' variant='outlined' />}
            </Box>
            {sb.config?.runtime && (
              <Text variant='body2' color='text.secondary'>Runtime: {sb.config.runtime}</Text>
            )}
          </ResourceChoiceCard>
        ))}
      </Box>

      {sandboxesArray.length === 0 && (
        <Text color='text.secondary' sx={{ mt: 2, textAlign: `center` }}>
          No sandboxes available. They will be created when the organization is set up.
        </Text>
      )}

      <Box sx={{ mt: 3, display: `flex`, justifyContent: `flex-end` }}>
        <Button size='small' color='warning' onClick={onSkip}>
          Skip this step
        </Button>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

### Task 16: Create ReviewStep Component

**Files:**
- Create: `repos/admin/src/components/Onboarding/steps/ReviewStep.tsx`

- [ ] **Step 1: Create ReviewStep**

Create `repos/admin/src/components/Onboarding/steps/ReviewStep.tsx`:

```typescript
import type { TStepResult } from '@TAF/types'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text } from '@tdsk/components'
import Alert from '@mui/material/Alert'
import { OnboardingSteps } from '@TAF/types'
import { ResourceChoiceCard } from '@TAF/components/Onboarding/OnboardingWizard.styled'
import {
  Business as OrgIcon,
  Cloud as ProviderIcon,
  Terminal as SandboxIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material'

export type TReviewStep = {
  error: string | null
  submitStep: number | null
  getStepResult: (stepIndex: number) => TStepResult
  onStepClick: (stepIndex: number) => void
}

const StepIcons = [OrgIcon, ProviderIcon, ProjectIcon, SandboxIcon]

export const ReviewStep = (props: TReviewStep) => {
  const { error, submitStep, getStepResult, onStepClick } = props

  return (
    <Box>
      <Text variant='h6' gutterBottom>Review & Finish</Text>
      <Text color='text.secondary' sx={{ mb: 3 }}>
        Review your setup before creating resources. Click any item to go back and edit.
      </Text>

      {error && (
        <Alert severity='error' sx={{ mb: 2 }}>
          {error}
          {submitStep !== null && (
            <Text variant='body2' sx={{ mt: 0.5 }}>
              Failed at step: {OnboardingSteps[submitStep]}
            </Text>
          )}
        </Alert>
      )}

      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5 }}>
        {OnboardingSteps.slice(0, 4).map((stepName, index) => {
          const result = getStepResult(index)
          const Icon = StepIcons[index]
          const isSkipped = result.outcome === `skipped`

          return (
            <ResourceChoiceCard
              key={stepName}
              onClick={() => onStepClick(index)}
              sx={{
                opacity: isSkipped ? 0.5 : 1,
                cursor: `pointer`,
                display: `flex`,
                alignItems: `center`,
                gap: 2,
              }}
            >
              {Icon && <Icon sx={{ color: isSkipped ? `text.disabled` : `primary.main` }} />}
              <Box sx={{ flex: 1 }}>
                <Text variant='subtitle2' fontWeight={600}>
                  {stepName}
                </Text>
                <Text variant='body2' color='text.secondary'>
                  {result.outcome === `creating` && `Creating: ${result.resourceName || `New ${stepName.toLowerCase()}`}`}
                  {result.outcome === `selected` && `Using: ${result.resourceName || `Existing ${stepName.toLowerCase()}`}`}
                  {result.outcome === `skipped` && `Skipped`}
                </Text>
              </Box>
              <Chip
                size='small'
                label={result.outcome === `creating` ? `New` : result.outcome === `selected` ? `Existing` : `Skipped`}
                color={isSkipped ? `default` : result.outcome === `creating` ? `primary` : `success`}
                variant={isSkipped ? `outlined` : `filled`}
              />
            </ResourceChoiceCard>
          )
        })}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

### Task 17: Create OnboardingWizard Main Component

**Files:**
- Create: `repos/admin/src/components/Onboarding/OnboardingWizard.tsx`
- Create: `repos/admin/src/components/Onboarding/index.ts`

- [ ] **Step 1: Create OnboardingWizard**

Create `repos/admin/src/components/Onboarding/OnboardingWizard.tsx`:

```typescript
import Box from '@mui/material/Box'
import Fade from '@mui/material/Fade'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import { OnboardingSteps } from '@TAF/types'
import IconButton from '@mui/material/IconButton'
import DialogContent from '@mui/material/DialogContent'
import CircularProgress from '@mui/material/CircularProgress'
import { OrgStep } from '@TAF/components/Onboarding/steps/OrgStep'
import { useOnboarding } from '@TAF/hooks/components/useOnboarding'
import { ReviewStep } from '@TAF/components/Onboarding/steps/ReviewStep'
import { ProjectStep } from '@TAF/components/Onboarding/steps/ProjectStep'
import { SandboxStep } from '@TAF/components/Onboarding/steps/SandboxStep'
import { ProviderStep } from '@TAF/components/Onboarding/steps/ProviderStep'
import {
  Close as CloseIcon,
  Check as CheckIcon,
  SkipNext as SkipIcon
} from '@mui/icons-material'
import {
  ContentBody,
  StepperPanel,
  ContentPanel,
  ContentFooter,
  WizardContainer,
} from '@TAF/components/Onboarding/OnboardingWizard.styled'

export const OnboardingWizard = () => {
  const {
    steps,
    error,
    onBack,
    onNext,
    onSkip,
    onClose,
    onSubmit,
    stepData,
    submitting,
    submitStep,
    activeStep,
    canDismiss,
    isLastStep,
    isFirstStep,
    isReviewStep,
    onStepClick,
    skippedSteps,
    getStepResult,
    updateStepData,
    isProviderSkipped,
    isProjectSkipped,
    onboarding,
  } = useOnboarding()

  const canNext = (() => {
    switch (activeStep) {
      case 0:
        return stepData.org.mode === `select`
          ? !!stepData.org.selectedId
          : !!stepData.org.data?.name?.trim()
      case 1:
        if (stepData.provider.mode === `skip`) return true
        return stepData.provider.mode === `select`
          ? !!stepData.provider.selectedId
          : !!(stepData.provider.data?.providerBrand && stepData.provider.data?.apiKey?.trim())
      case 2:
        if (stepData.project.mode === `skip`) return true
        return stepData.project.mode === `select`
          ? !!stepData.project.selectedId
          : !!stepData.project.data?.name?.trim()
      case 3:
        return true
      case 4:
        return true
      default:
        return false
    }
  })()

  return (
    <Dialog
      open={onboarding.open}
      onClose={canDismiss ? onClose : undefined}
      disableEscapeKeyDown={!canDismiss}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: `75vw`,
          height: `80vh`,
          maxWidth: 900,
          maxHeight: 700,
        },
      }}
    >
      <DialogContent sx={{ p: 0, display: `flex`, height: `100%` }}>
        <WizardContainer>
          <StepperPanel>
            <Text variant='h6' sx={{ mb: 3, fontWeight: 700 }}>
              Setup Wizard
            </Text>
            <Box sx={{ display: `flex`, flexDirection: `column`, gap: 0.5 }}>
              {steps.map((stepName, index) => {
                if (index === steps.length - 1) return null
                const isActive = activeStep === index
                const isCompleted = activeStep > index && !skippedSteps.has(index)
                const isSkipped = skippedSteps.has(index)
                const isClickable = index < activeStep || isSkipped

                return (
                  <Box key={stepName}>
                    <Box
                      onClick={() => isClickable && onStepClick(index)}
                      sx={{
                        display: `flex`,
                        alignItems: `center`,
                        gap: 1.5,
                        py: 1,
                        px: 1.5,
                        borderRadius: 1,
                        cursor: isClickable ? `pointer` : `default`,
                        bgcolor: isActive ? `action.selected` : `transparent`,
                        '&:hover': isClickable
                          ? { bgcolor: `action.hover` }
                          : {},
                      }}
                    >
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: `50%`,
                          display: `flex`,
                          alignItems: `center`,
                          justifyContent: `center`,
                          fontSize: 12,
                          fontWeight: 600,
                          bgcolor: isActive
                            ? `primary.main`
                            : isCompleted
                              ? `success.main`
                              : isSkipped
                                ? `action.disabledBackground`
                                : `action.disabledBackground`,
                          color: isActive || isCompleted
                            ? `primary.contrastText`
                            : `text.disabled`,
                        }}
                      >
                        {isCompleted ? (
                          <CheckIcon sx={{ fontSize: 16 }} />
                        ) : isSkipped ? (
                          <SkipIcon sx={{ fontSize: 16 }} />
                        ) : (
                          index + 1
                        )}
                      </Box>
                      <Text
                        variant='body2'
                        sx={{
                          fontWeight: isActive ? 600 : 400,
                          color: isActive
                            ? `text.primary`
                            : isSkipped
                              ? `text.disabled`
                              : `text.secondary`,
                        }}
                      >
                        {stepName}
                      </Text>
                    </Box>
                    {index < steps.length - 2 && (
                      <Box
                        sx={{
                          width: 1,
                          height: 16,
                          bgcolor: `divider`,
                          ml: `25px`,
                        }}
                      />
                    )}
                  </Box>
                )
              })}

              <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: `divider` }}>
                <Box
                  onClick={() => activeStep >= steps.length - 2 && onStepClick(steps.length - 1)}
                  sx={{
                    display: `flex`,
                    alignItems: `center`,
                    gap: 1.5,
                    py: 1,
                    px: 1.5,
                    borderRadius: 1,
                    cursor: isReviewStep ? `default` : activeStep >= steps.length - 2 ? `pointer` : `default`,
                    bgcolor: isReviewStep ? `action.selected` : `transparent`,
                  }}
                >
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: `50%`,
                      display: `flex`,
                      alignItems: `center`,
                      justifyContent: `center`,
                      fontSize: 12,
                      fontWeight: 600,
                      bgcolor: isReviewStep ? `primary.main` : `action.disabledBackground`,
                      color: isReviewStep ? `primary.contrastText` : `text.disabled`,
                    }}
                  >
                    {steps.length}
                  </Box>
                  <Text
                    variant='body2'
                    sx={{
                      fontWeight: isReviewStep ? 600 : 400,
                      color: isReviewStep ? `text.primary` : `text.secondary`,
                    }}
                  >
                    Review
                  </Text>
                </Box>
              </Box>
            </Box>

            {canDismiss && (
              <Box sx={{ mt: `auto`, pt: 2 }}>
                <IconButton size='small' onClick={onClose}>
                  <CloseIcon fontSize='small' />
                </IconButton>
              </Box>
            )}
          </StepperPanel>

          <ContentPanel>
            <ContentBody>
              <Fade in key={activeStep} timeout={200}>
                <Box>
                  {activeStep === 0 && (
                    <OrgStep
                      stepData={stepData.org}
                      preSelectedOrgId={onboarding.orgId}
                      onUpdate={(data) => updateStepData(`org`, data)}
                    />
                  )}
                  {activeStep === 1 && (
                    <ProviderStep
                      stepData={stepData.provider}
                      onUpdate={(data) => updateStepData(`provider`, data)}
                      onSkip={() => onSkip(1)}
                    />
                  )}
                  {activeStep === 2 && (
                    <ProjectStep
                      stepData={stepData.project}
                      onUpdate={(data) => updateStepData(`project`, data)}
                      onSkip={() => onSkip(2)}
                    />
                  )}
                  {activeStep === 3 && (
                    <SandboxStep
                      stepData={stepData.sandbox}
                      isProviderSkipped={isProviderSkipped}
                      isProjectSkipped={isProjectSkipped}
                      onUpdate={(data) => updateStepData(`sandbox`, data)}
                      onSkip={() => onSkip(3)}
                    />
                  )}
                  {activeStep === 4 && (
                    <ReviewStep
                      error={error}
                      submitStep={submitStep}
                      getStepResult={getStepResult}
                      onStepClick={onStepClick}
                    />
                  )}
                </Box>
              </Fade>
            </ContentBody>

            <ContentFooter>
              <Button
                variant='outlined'
                disabled={isFirstStep || submitting}
                onClick={onBack}
              >
                Back
              </Button>
              <Box sx={{ display: `flex`, gap: 1 }}>
                {isReviewStep ? (
                  <Button
                    variant='contained'
                    disabled={submitting}
                    onClick={onSubmit}
                    startIcon={submitting ? <CircularProgress size={16} /> : undefined}
                  >
                    {submitting ? `Setting up...` : `Finish`}
                  </Button>
                ) : (
                  <Button
                    variant='contained'
                    disabled={!canNext}
                    onClick={onNext}
                  >
                    Next
                  </Button>
                )}
              </Box>
            </ContentFooter>
          </ContentPanel>
        </WizardContainer>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create barrel export**

Create `repos/admin/src/components/Onboarding/index.ts`:

```typescript
export { OnboardingWizard } from './OnboardingWizard'
```

- [ ] **Step 3: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

---

## Phase 5: Integration into Pages

### Task 18: Wire Onboarding into Home and Org Pages

**Files:**
- Modify: `repos/admin/src/pages/Home/Home.tsx`
- Modify: `repos/admin/src/pages/Orgs/Org.tsx`

- [ ] **Step 1: Update Home.tsx — auto-trigger and manual card**

Replace the full content of `repos/admin/src/pages/Home/Home.tsx`:

```typescript
import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import { Text } from '@tdsk/components'
import Button from '@mui/material/Button'
import { Page } from '@TAF/pages/Page/Page'
import { useOrgs } from '@TAF/state/selectors'
import Container from '@mui/material/Container'
import { Orgs } from '@TAF/components/Orgs/Orgs'
import CardContent from '@mui/material/CardContent'
import { Add as AddIcon } from '@mui/icons-material'
import { useOnboardingState } from '@TAF/state/selectors'
import { OnboardingWizard } from '@TAF/components/Onboarding'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { CreateOrgDrawer } from '@TAF/components/Orgs/CreateOrgDrawer'
import { openOnboarding } from '@TAF/actions/onboarding/local/openOnboarding'

export type THome = {}

export const Home = (props: THome) => {
  const [orgs] = useOrgs()
  const [onboarding] = useOnboardingState()
  const orgsArray = orgs ? Object.values(orgs) : []
  const hasOrgs = orgsArray.length > 0
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (!hasOrgs && !onboarding.open) {
      openOnboarding({ mode: `auto` })
    }
  }, [hasOrgs, onboarding.open])

  const openManualWizard = () => {
    openOnboarding({ mode: `manual` })
  }

  return (
    <Page className='tdsk-home-page'>
      <Container
        maxWidth='lg'
        disableGutters
      >
        {!hasOrgs ? (
          <Card
            variant='outlined'
            sx={{ mb: 3, backgroundColor: `action.hover` }}
          >
            <CardContent sx={{ textAlign: `center`, py: 4 }}>
              <Text
                variant='h5'
                gutterBottom
              >
                Welcome to Threaded Stack
              </Text>
              <Text
                variant='body1'
                color='text.secondary'
                sx={{ mb: 2 }}
              >
                Create your first organization to get started
              </Text>
            </CardContent>
          </Card>
        ) : (
          <>
            <Box
              sx={{
                display: `flex`,
                alignItems: `center`,
                justifyContent: `space-between`,
                mb: 1,
              }}
            >
              <Box>
                <Text
                  variant='h5'
                  component='h1'
                  gutterBottom
                >
                  Organizations
                </Text>
                <Text color='text.secondary'>
                  Choose an organization to continue or create a new one
                </Text>
              </Box>
              <Button
                variant='outlined'
                startIcon={<RocketLaunchIcon />}
                onClick={openManualWizard}
              >
                Setup Wizard
              </Button>
            </Box>
            <Orgs />
          </>
        )}

        <CreateOrgDrawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      </Container>

      <OnboardingWizard />
    </Page>
  )
}

export default Home
```

- [ ] **Step 2: Update Org.tsx — replace quickstart with onboarding trigger**

In `repos/admin/src/pages/Orgs/Org.tsx`:

Replace the imports:
- Remove: `import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'`
- Remove: `import { Quickstart } from '@TAF/components/Quickstart/Quickstart'`
- Remove: `import { toggleQuickStart } from '@TAF/actions/quickstart/local/toggle'`
- Add: `import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'`
- Add: `import { OnboardingWizard } from '@TAF/components/Onboarding'`
- Add: `import { openOnboarding } from '@TAF/actions/onboarding/local/openOnboarding'`

In the ActionCards `actions` array, replace the Quick Start action:
```typescript
{
  title: `Setup Wizard`,
  Icon: RocketLaunchIcon,
  onClick: () =>
    openOnboarding({
      mode: `manual`,
      orgId: org.id,
      startStep: 1,
    }),
  subtitle: `Configure providers, projects & sandboxes`,
},
```

Remove: `<Quickstart button={false} />` (line 217)

Add before the closing `</Page>` tag:
```typescript
<OnboardingWizard />
```

- [ ] **Step 3: Verify build**

Run: `cd repos/admin && pnpm build`

Expected: Build succeeds

- [ ] **Step 4: Verify type check**

Run: `cd repos/admin && pnpm types`

Expected: No type errors

---

## Phase 6: Verification

### Task 19: Cross-Repo Type Check

- [ ] **Step 1: Run types across all repos**

Run: `pnpm types`

Expected: All repos pass type checking

- [ ] **Step 2: Verify no quickstart references remain anywhere**

Run: `grep -r "quickstart\|QuickStart\|QSSteps\|useQuickStart\|toggleQuickStart\|quickstartApi\|orgQuickstart\|cleanupQuickstart" repos/ --include="*.ts" --include="*.tsx" -l | grep -v node_modules | grep -v .test.ts`

Expected: No results (test files handled separately in Task 6)

---

### Task 20: Admin Unit Tests

**Files:**
- Create: `repos/admin/src/hooks/components/useOnboarding.test.ts`

- [ ] **Step 1: Write tests for useOnboarding hook**

Create `repos/admin/src/hooks/components/useOnboarding.test.ts` with tests covering:
- Initial state (activeStep = 0, no skipped steps)
- Step navigation (next, back, bounds checking)
- Skip step (adds to skippedSteps, advances)
- Step click (backward only, not forward past current)
- getStepResult returns correct outcomes
- updateStepData updates correct step
- canDismiss based on mode
- Provider/project skip flags

- [ ] **Step 2: Run tests**

Run: `cd repos/admin && pnpm test`

Expected: All tests pass

---

### Task 21: Integration Test — Onboarding Flow

**Files:**
- Create: `repos/integration/src/tier1/onboarding-flow.test.ts`

- [ ] **Step 1: Write integration test**

Create `repos/integration/src/tier1/onboarding-flow.test.ts` that validates the API call sequence the wizard makes:
1. Create org → create provider → create project → update sandbox with projectIds + providerInputs
2. Verify resources are linked correctly
3. Test skip scenarios (skip provider, verify sandbox update doesn't include provider)

Use the existing `post`, `get`, `del` helpers from `../utils/api-client`.

- [ ] **Step 2: Run the test**

Run: `cd repos/integration && npx vitest run --config configs/vitest.config.ts src/tier1/onboarding-flow.test.ts`

Expected: All tests pass

---
