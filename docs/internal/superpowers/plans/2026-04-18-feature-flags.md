# Feature Flags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global feature flag system that hides incomplete features (terminal GUI, schedules, skills) across all apps and the backend API before end-of-month launch.

**Architecture:** Code constants in `@tdsk/domain` define flags. `@tdsk/components` provides a `useFeatureFlag` hook and `<FeatureGate>` component for React apps. Backend uses an Express `featureGate` middleware for endpoint groups and direct `isFeatureEnabled` checks where needed. Nav items use the existing `visible` callback pattern.

**Tech Stack:** TypeScript, React, Express 5, Vitest

**Spec:** `docs/superpowers/specs/2026-04-18-feature-flags-design.md`

---

### Task 1: Flag Registry in Domain

**Files:**
- Create: `repos/domain/src/constants/featureFlags.ts`
- Create: `repos/domain/src/constants/featureFlags.test.ts`
- Modify: `repos/domain/src/constants/index.ts`

- [ ] **Step 1: Write the test file**

```typescript
// repos/domain/src/constants/featureFlags.test.ts
import { describe, it, expect } from 'vitest'
import { FeatureFlags, isFeatureEnabled } from './featureFlags'
import type { TFeatureFlagName } from './featureFlags'

describe('FeatureFlags', () => {
  it('should define all expected flags', () => {
    expect(FeatureFlags).toHaveProperty('terminalGui')
    expect(FeatureFlags).toHaveProperty('schedules')
    expect(FeatureFlags).toHaveProperty('skills')
  })

  it('each flag should have enabled and description', () => {
    for (const [name, def] of Object.entries(FeatureFlags)) {
      expect(typeof def.enabled).toBe('boolean')
      expect(typeof def.description).toBe('string')
      expect(def.description.length).toBeGreaterThan(0)
    }
  })
})

describe('isFeatureEnabled', () => {
  it('should return the enabled value for a flag', () => {
    for (const [name, def] of Object.entries(FeatureFlags)) {
      expect(isFeatureEnabled(name as TFeatureFlagName)).toBe(def.enabled)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/domain && npx vitest run src/constants/featureFlags.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the feature flags module**

```typescript
// repos/domain/src/constants/featureFlags.ts
export type TFeatureFlagDef = {
  enabled: boolean
  description: string
}

export const FeatureFlags = {
  terminalGui: { enabled: false, description: 'AST overlay for terminal output (generative UI)' },
  schedules: { enabled: false, description: 'Cron-based agent execution' },
  skills: { enabled: false, description: 'Agent skill system' },
} as const satisfies Record<string, TFeatureFlagDef>

export type TFeatureFlagName = keyof typeof FeatureFlags

export function isFeatureEnabled(flag: TFeatureFlagName): boolean {
  return FeatureFlags[flag].enabled
}
```

- [ ] **Step 4: Add barrel export**

In `repos/domain/src/constants/index.ts`, add this line at the end:

```typescript
export * from './featureFlags'
```

The file should now read:
```typescript
export * from './plans'
export * from './values'
export * from './sandbox'
export * from './providers'
export * from './gui'
export * from './featureFlags'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd repos/domain && npx vitest run src/constants/featureFlags.test.ts`
Expected: PASS — all 3 tests

- [ ] **Step 6: Run full domain tests to check for regressions**

Run: `cd repos/domain && pnpm test`
Expected: All existing tests still pass

---

### Task 2: React Hook and Gate Component in Components

**Files:**
- Create: `repos/components/src/hooks/featureFlags/useFeatureFlag.ts`
- Create: `repos/components/src/hooks/featureFlags/index.ts`
- Create: `repos/components/src/hooks/featureFlags/useFeatureFlag.test.tsx`
- Create: `repos/components/src/components/FeatureGate/FeatureGate.tsx`
- Create: `repos/components/src/components/FeatureGate/FeatureGate.test.tsx`
- Create: `repos/components/src/components/FeatureGate/index.ts`
- Modify: `repos/components/src/hooks/index.ts`
- Modify: `repos/components/src/components/index.ts`

- [ ] **Step 1: Write the hook test**

```tsx
// repos/components/src/hooks/featureFlags/useFeatureFlag.test.tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFeatureFlag } from './useFeatureFlag'

describe('useFeatureFlag', () => {
  it('should return false for disabled flags', () => {
    const { result } = renderHook(() => useFeatureFlag('terminalGui'))
    expect(result.current).toBe(false)
  })

  it('should return false for all currently disabled flags', () => {
    for (const flag of ['terminalGui', 'schedules', 'skills'] as const) {
      const { result } = renderHook(() => useFeatureFlag(flag))
      expect(result.current).toBe(false)
    }
  })
})
```

- [ ] **Step 2: Write the hook**

```typescript
// repos/components/src/hooks/featureFlags/useFeatureFlag.ts
import { isFeatureEnabled, type TFeatureFlagName } from '@tdsk/domain'

export function useFeatureFlag(flag: TFeatureFlagName): boolean {
  return isFeatureEnabled(flag)
}
```

```typescript
// repos/components/src/hooks/featureFlags/index.ts
export { useFeatureFlag } from './useFeatureFlag'
```

- [ ] **Step 3: Add hook barrel export**

In `repos/components/src/hooks/index.ts`, add at the end:

```typescript
export * from './featureFlags'
```

The file should now read:
```typescript
export * from './dom'
export * from './api'
export * from './data'
export * from './theme'
export * from './components'
export * from './featureFlags'
```

- [ ] **Step 4: Run hook test**

Run: `cd repos/components && npx vitest run src/hooks/featureFlags/useFeatureFlag.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the FeatureGate component test**

```tsx
// repos/components/src/components/FeatureGate/FeatureGate.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureGate } from './FeatureGate'

// Mock the domain module to control flag values
vi.mock('@tdsk/domain', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tdsk/domain')>()
  return {
    ...original,
    isFeatureEnabled: vi.fn((flag: string) => {
      if (flag === 'terminalGui') return true
      return false
    }),
  }
})

describe('FeatureGate', () => {
  it('should render children when flag is enabled', () => {
    render(
      <FeatureGate flag='terminalGui'>
        <div data-testid='child'>Visible</div>
      </FeatureGate>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })

  it('should not render children when flag is disabled', () => {
    render(
      <FeatureGate flag='skills'>
        <div data-testid='hidden'>Hidden</div>
      </FeatureGate>
    )
    expect(screen.queryByTestId('hidden')).toBeNull()
  })

  it('should render fallback when flag is disabled and fallback provided', () => {
    render(
      <FeatureGate
        flag='skills'
        fallback={<div data-testid='fallback'>Coming Soon</div>}
      >
        <div data-testid='hidden'>Hidden</div>
      </FeatureGate>
    )
    expect(screen.queryByTestId('hidden')).toBeNull()
    expect(screen.getByTestId('fallback')).toBeDefined()
  })

  it('should render null fallback by default when disabled', () => {
    const { container } = render(
      <FeatureGate flag='skills'>
        <div>Hidden</div>
      </FeatureGate>
    )
    expect(container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 6: Write the FeatureGate component**

```tsx
// repos/components/src/components/FeatureGate/FeatureGate.tsx
import type { ReactNode } from 'react'
import type { TFeatureFlagName } from '@tdsk/domain'
import { useFeatureFlag } from '../../hooks/featureFlags/useFeatureFlag'

export type TFeatureGateProps = {
  flag: TFeatureFlagName
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ flag, children, fallback = null }: TFeatureGateProps) {
  const enabled = useFeatureFlag(flag)
  return enabled ? <>{children}</> : <>{fallback}</>
}
```

```typescript
// repos/components/src/components/FeatureGate/index.ts
export { FeatureGate } from './FeatureGate'
export type { TFeatureGateProps } from './FeatureGate'
```

- [ ] **Step 7: Add component barrel export**

In `repos/components/src/components/index.ts`, add at the end (before or after `ArtifactRenderer`):

```typescript
export * from './FeatureGate'
```

- [ ] **Step 8: Run FeatureGate test**

Run: `cd repos/components && npx vitest run src/components/FeatureGate/FeatureGate.test.tsx`
Expected: PASS — all 4 tests

- [ ] **Step 9: Run full components tests to check for regressions**

Run: `cd repos/components && pnpm test`
Expected: All existing tests still pass

---

### Task 3: Backend featureGate Middleware

**Files:**
- Create: `repos/backend/src/middleware/featureGate.ts`
- Create: `repos/backend/src/middleware/featureGate.test.ts`

- [ ] **Step 1: Write the middleware test**

```typescript
// repos/backend/src/middleware/featureGate.test.ts
import { describe, it, expect, vi } from 'vitest'
import { featureGate } from './featureGate'

// Mock isFeatureEnabled to control flag values
vi.mock('@tdsk/domain', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tdsk/domain')>()
  return {
    ...original,
    isFeatureEnabled: vi.fn((flag: string) => {
      if (flag === 'terminalGui') return true
      return false
    }),
  }
})

describe('featureGate', () => {
  const mockReq = {} as any
  const mockNext = vi.fn()

  const buildRes = () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any
    return res
  }

  it('should call next() when the flag is enabled', () => {
    const middleware = featureGate('terminalGui')
    const res = buildRes()
    middleware(mockReq, res, mockNext)
    expect(mockNext).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('should return 404 when the flag is disabled', () => {
    const middleware = featureGate('skills')
    const res = buildRes()
    mockNext.mockClear()
    middleware(mockReq, res, mockNext)
    expect(mockNext).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Not found' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd repos/backend && npx vitest run src/middleware/featureGate.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the middleware**

```typescript
// repos/backend/src/middleware/featureGate.ts
import { isFeatureEnabled, type TFeatureFlagName } from '@tdsk/domain'
import type { RequestHandler } from 'express'

export function featureGate(flag: TFeatureFlagName): RequestHandler {
  return (req, res, next) => {
    if (isFeatureEnabled(flag)) return next()
    res.status(404).json({ error: 'Not found' })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd repos/backend && npx vitest run src/middleware/featureGate.test.ts`
Expected: PASS — both tests

- [ ] **Step 5: Run full backend tests to check for regressions**

Run: `cd repos/backend && pnpm test`
Expected: All existing tests still pass

---

### Task 4: Gate Skills Endpoints (Backend)

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgSkills.ts`

- [ ] **Step 1: Add featureGate middleware to the skills endpoint group**

Edit `repos/backend/src/endpoints/orgs/orgSkills.ts` to import and apply the middleware. The existing file has no `middleware` field — add it:

```typescript
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getSkill } from '@TBE/endpoints/skills/getSkill'
import { listSkills } from '@TBE/endpoints/skills/listSkills'
import { createSkill } from '@TBE/endpoints/skills/createSkill'
import { updateSkill } from '@TBE/endpoints/skills/updateSkill'
import { deleteSkill } from '@TBE/endpoints/skills/deleteSkill'
import { attachSkill } from '@TBE/endpoints/skills/attachSkill'
import { detachSkill } from '@TBE/endpoints/skills/detachSkill'

export const orgSkills: TEndpointConfig = {
  path: `/:orgId/skills`,
  method: EPMethod.Use,
  middleware: [featureGate('skills')],
  endpoints: {
    listSkills,
    getSkill,
    createSkill,
    updateSkill,
    deleteSkill,
    attachSkill,
    detachSkill,
  },
}
```

The key change: add `import { featureGate } from '@TBE/middleware/featureGate'` and the `middleware: [featureGate('skills')]` line.

- [ ] **Step 2: Verify backend tests still pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass (the skills endpoint tests may need the mock — check output)

---

### Task 5: Gate Schedules Endpoints (Backend)

**Files:**
- Modify: `repos/backend/src/endpoints/orgs/orgSchedules.ts`

- [ ] **Step 1: Add featureGate middleware to the schedules endpoint group**

Edit `repos/backend/src/endpoints/orgs/orgSchedules.ts`:

```typescript
import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getSchedule } from '@TBE/endpoints/schedules/getSchedule'
import { listSchedules } from '@TBE/endpoints/schedules/listSchedules'
import { createSchedule } from '@TBE/endpoints/schedules/createSchedule'
import { updateSchedule } from '@TBE/endpoints/schedules/updateSchedule'
import { deleteSchedule } from '@TBE/endpoints/schedules/deleteSchedule'
import { triggerSchedule } from '@TBE/endpoints/schedules/triggerSchedule'

export const orgSchedules: TEndpointConfig = {
  path: `/:orgId/schedules`,
  method: EPMethod.Use,
  middleware: [featureGate('schedules')],
  endpoints: {
    listSchedules,
    getSchedule,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
  },
}
```

The key change: add `import { featureGate } from '@TBE/middleware/featureGate'` and the `middleware: [featureGate('schedules')]` line.

- [ ] **Step 2: Guard the scheduler startup**

Edit `repos/backend/src/services/scheduler/scheduler.ts` — add a feature flag check in the `start()` method so the cron runner doesn't tick when schedules are disabled:

Add import at top:
```typescript
import { isFeatureEnabled } from '@tdsk/domain'
```

Modify the `start()` method:
```typescript
  start() {
    if (!isFeatureEnabled('schedules')) {
      logger.info(`[Scheduler] Schedules feature is disabled — not starting`)
      return
    }

    if (this.intervalId) {
      logger.warn(`[Scheduler] Already running`)
      return
    }

    logger.info(`[Scheduler] Starting scheduler (60s tick interval)`)
    this.tick().catch((err) => logger.error(`[Scheduler] Initial tick failed: ${err}`))
    this.intervalId = setInterval(() => this.tick(), 60_000)
  }
```

- [ ] **Step 3: Verify backend tests still pass**

Run: `cd repos/backend && pnpm test`
Expected: All tests pass

---

### Task 6: Gate Skills and Schedules in Admin Routes and Nav

**Files:**
- Modify: `repos/admin/src/routes/Routes.tsx`
- Modify: `repos/admin/src/constants/nav.tsx`

- [ ] **Step 1: Gate routes in Routes.tsx**

Add import at the top of `repos/admin/src/routes/Routes.tsx`:
```typescript
import { isFeatureEnabled } from '@tdsk/domain'
```

Replace the skills org-level route (lines 182-186) with a conditional:
```typescript
            // Replace this block:
            {
              path: ERoutePath.Skills,
              loader: orgSkillsLoader,
              Component: () => <SuspensePage Component={OrgSkills} />,
            },
            // With:
            ...(isFeatureEnabled('skills')
              ? [{
                  path: ERoutePath.Skills,
                  loader: orgSkillsLoader,
                  Component: () => <SuspensePage Component={OrgSkills} />,
                }]
              : []),
```

Replace the schedules org-level route (lines 187-191) with a conditional:
```typescript
            // Replace this block:
            {
              path: ERoutePath.Schedules,
              loader: orgSchedulesLoader,
              Component: () => <SuspensePage Component={OrgSchedules} />,
            },
            // With:
            ...(isFeatureEnabled('schedules')
              ? [{
                  path: ERoutePath.Schedules,
                  loader: orgSchedulesLoader,
                  Component: () => <SuspensePage Component={OrgSchedules} />,
                }]
              : []),
```

Replace the agent-nested skills tab route (lines 292-295):
```typescript
            // Replace:
                    {
                      path: `skills`,
                      Component: () => <SuspensePage Component={SkillsTab} />,
                    },
            // With:
                    ...(isFeatureEnabled('skills')
                      ? [{
                          path: `skills`,
                          Component: () => <SuspensePage Component={SkillsTab} />,
                        }]
                      : []),
```

Replace the agent-nested schedules tab route (lines 296-299):
```typescript
            // Replace:
                    {
                      path: `schedules`,
                      Component: () => <SuspensePage Component={SchedulesTab} />,
                    },
            // With:
                    ...(isFeatureEnabled('schedules')
                      ? [{
                          path: `schedules`,
                          Component: () => <SuspensePage Component={SchedulesTab} />,
                        }]
                      : []),
```

- [ ] **Step 2: Gate nav items in nav.tsx**

Edit `repos/admin/src/constants/nav.tsx`. Add import at the top:
```typescript
import { isFeatureEnabled } from '@tdsk/domain'
```

Modify the `visible` callback on the Skills nav item (line 82) to compose with the feature flag:
```typescript
  Skills: {
    text: `Skills`,
    to: buildRoute(ERoutePath.OrgSkills),
    Icon: <ExtensionIcon />,
    visible: (ctx) => hasOrg(ctx) && isFeatureEnabled('skills'),
  },
```

Modify the `visible` callback on the Schedules nav item (line 88):
```typescript
  Schedules: {
    text: `Schedules`,
    to: buildRoute(ERoutePath.OrgSchedules),
    Icon: <TimerIcon />,
    visible: (ctx) => hasOrg(ctx) && isFeatureEnabled('schedules'),
  },
```

- [ ] **Step 3: Verify admin tests still pass**

Run: `cd repos/admin && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Verify admin builds**

Run: `cd repos/admin && pnpm build`
Expected: Build succeeds

---

### Task 7: Gate Terminal GUI in Admin

**Files:**
- Modify: `repos/admin/src/pages/Orgs/OrgSettings.tsx`
- Modify: `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`

- [ ] **Step 1: Gate GUI config in OrgSettings.tsx**

Add import at the top of `repos/admin/src/pages/Orgs/OrgSettings.tsx`:
```typescript
import { isFeatureEnabled } from '@tdsk/domain'
```

Wrap the entire GUI config Card (lines 179-202) with a feature flag check. Replace:
```tsx
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant='h6'>Generative UI</Typography>
              <Divider sx={{ my: 2 }} />
              <GuiConfigForm
                config={localGuiConfig}
                orgProviders={orgProviders}
                onChange={setLocalGuiConfig}
              />
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <LoadingButton
                  color='success'
                  onClick={onSaveGuiConfig}
                  loading={guiSaving}
                  Icon={<SaveIcon />}
                  variant='contained'
                  disabled={!guiHasChanges}
                  loadingText='Saving...'
                >
                  Save
                </LoadingButton>
              </Box>
            </CardContent>
          </Card>
```

With:
```tsx
          {isFeatureEnabled('terminalGui') && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant='h6'>Generative UI</Typography>
                <Divider sx={{ my: 2 }} />
                <GuiConfigForm
                  config={localGuiConfig}
                  orgProviders={orgProviders}
                  onChange={setLocalGuiConfig}
                />
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <LoadingButton
                    color='success'
                    onClick={onSaveGuiConfig}
                    loading={guiSaving}
                    Icon={<SaveIcon />}
                    variant='contained'
                    disabled={!guiHasChanges}
                    loadingText='Saving...'
                  >
                    Save
                  </LoadingButton>
                </Box>
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 2: Gate GUI config in SandboxDrawer.tsx**

Add import at the top of `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx`:
```typescript
import { isFeatureEnabled } from '@tdsk/domain'
```

Find the Generative UI Accordion section (lines 990-1027). The block starts with `{/* Generative UI */}` comment and the `<Accordion defaultExpanded={false}>`. Wrap the entire Accordion (including the comment) with a feature flag check:

```tsx
          {isFeatureEnabled('terminalGui') && (
            <Accordion defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant='subtitle1'>Generative UI</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        disabled={loading}
                        checked={guiOverride}
                        onChange={(e) => {
                          setGuiOverride(e.target.checked)
                          if (!e.target.checked) setSandboxGuiConfig(undefined)
                        }}
                      />
                    }
                    label='Use custom config (override org default)'
                  />
                  <GuiConfigForm
                    config={sandboxGuiConfig}
                    orgProviders={orgProviders.map((p) => ({
                      id: p.id,
                      name: p.name || p.id,
                      brand: p.brand,
                    }))}
                    disabled={loading || !guiOverride}
                    onChange={setSandboxGuiConfig}
                  />
                </Box>
              </AccordionDetails>
            </Accordion>
          )}
```

- [ ] **Step 3: Verify admin tests and build**

Run: `cd repos/admin && pnpm test && pnpm build`
Expected: All tests pass, build succeeds

---

### Task 8: Gate Terminal GUI in Threads

**Files:**
- Modify: `repos/threads/src/pages/Session/Session.tsx`

- [ ] **Step 1: Gate the GUI view in Session.tsx**

Add import at the top of `repos/threads/src/pages/Session/Session.tsx`:
```typescript
import { isFeatureEnabled } from '@tdsk/domain'
```

**Change 1**: Change the default `viewMode` initial state (line 93) to default to `terminal` when GUI is disabled:

Replace:
```typescript
const [viewMode, setViewMode] = useState<TViewMode>(`gui`)
```
With:
```typescript
const [viewMode, setViewMode] = useState<TViewMode>(
  isFeatureEnabled('terminalGui') ? `gui` : `terminal`
)
```

**Change 2**: Hide the ViewToggle (lines 245-248) when GUI is disabled. Replace:
```tsx
              <ViewToggle
                value={viewMode}
                onChange={handleViewChange}
              />
```
With:
```tsx
              {isFeatureEnabled('terminalGui') && (
                <ViewToggle
                  value={viewMode}
                  onChange={handleViewChange}
                />
              )}
```

**Change 3**: The conditional render at lines 422-431 already handles `viewMode === 'gui'` vs `viewMode === 'terminal'`. Since the default is now `terminal` when the flag is off and the toggle is hidden, users will only see the terminal view. No change needed to the render logic.

- [ ] **Step 2: Verify threads build**

Run: `cd repos/threads && pnpm build`
Expected: Build succeeds

---

### Task 9: Type Check and Full Verification

**Files:** None — validation only

- [ ] **Step 1: Run type checks across all repos**

Run: `pnpm types`
Expected: All repos type check cleanly (0 errors)

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All tests pass across all repos

- [ ] **Step 3: Verify admin build**

Run: `cd repos/admin && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Verify threads build**

Run: `cd repos/threads && pnpm build`
Expected: Build succeeds

- [ ] **Step 5: Verify backend build**

Run: `cd repos/backend && pnpm build`
Expected: Build succeeds
