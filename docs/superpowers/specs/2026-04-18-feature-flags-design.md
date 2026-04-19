# Feature Flags System Design

## Problem

The platform is preparing for an end-of-month launch. Several features are incomplete or not hardened enough for production users — the terminal GUI overlay, schedules, and skills. There is no mechanism to hide these features across the stack. Each feature is fully wired into routes, navigation, and API endpoints.

A feature flag system is needed that can gate incomplete features globally, spanning frontend apps (threads, admin) and the backend API, with a consistent pattern that's easy to expand as new features are flagged.

## Decisions

- **Global flags only** — no per-org or per-user targeting. One switch hides a feature from everyone.
- **Code constants in `@tdsk/domain`** — flags are a TypeScript object, not config files or env vars. Changing a flag is a code change.
- **React hook + gate component** — frontends consume flags via `useFeatureFlag(name)` hook and `<FeatureGate flag={name}>` component, both in `@tdsk/components`. The hook is a thin wrapper today, providing a single swap point for future evolution (per-org, remote config).
- **Backend middleware** — an Express middleware `featureGate(name)` returns 404 when a flag is off. Applied at the endpoint group level so individual endpoint files stay clean.
- **404 not 403** — disabled features return 404, not 403. This avoids leaking that a feature exists but is gated.

## Architecture

### Flag Registry (`@tdsk/domain`)

Single source of truth. All flags defined in one file with metadata.

```
repos/domain/src/constants/featureFlags.ts
```

```typescript
type TFeatureFlagDef = {
  enabled: boolean
  description: string
}

export const FeatureFlags = {
  terminalGui: { enabled: false, description: 'AST overlay for terminal output (generative UI)' },
  schedules:   { enabled: false, description: 'Cron-based agent execution' },
  skills:      { enabled: false, description: 'Agent skill system' },
} as const satisfies Record<string, TFeatureFlagDef>

export type TFeatureFlagName = keyof typeof FeatureFlags

export function isFeatureEnabled(flag: TFeatureFlagName): boolean {
  return FeatureFlags[flag].enabled
}
```

Adding a flag = one line in the object. Removing a flag = delete the line and fix the type errors at all consumers.

### React Hook (`@tdsk/components`)

```
repos/components/src/hooks/useFeatureFlag.ts
```

```typescript
import { isFeatureEnabled, type TFeatureFlagName } from '@tdsk/domain'

export function useFeatureFlag(flag: TFeatureFlagName): boolean {
  return isFeatureEnabled(flag)
}
```

Thin wrapper today. Future evolution point for React context, per-org flags, or remote config.

### Gate Component (`@tdsk/components`)

```
repos/components/src/components/FeatureGate/FeatureGate.tsx
```

```tsx
import { useFeatureFlag } from '../../hooks/useFeatureFlag'
import type { TFeatureFlagName } from '@tdsk/domain'

type TFeatureGateProps = {
  flag: TFeatureFlagName
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGate({ flag, children, fallback = null }: TFeatureGateProps) {
  const enabled = useFeatureFlag(flag)
  return enabled ? <>{children}</> : <>{fallback}</>
}
```

Usage:
- Wrap UI sections: `<FeatureGate flag="skills"><SkillsList /></FeatureGate>`
- With fallback: `<FeatureGate flag="schedules" fallback={<ComingSoonChip />}><SchedulesList /></FeatureGate>`
- Nav items: wrap individual nav entries to hide sidebar links

For route gating, use `isFeatureEnabled` directly in route definitions to exclude routes entirely (prevents direct URL navigation):

```tsx
...(isFeatureEnabled('skills')
  ? [{ path: 'skills', element: <Skills />, loader: orgSkillsLoader }]
  : []),
```

### Backend Middleware

```
repos/backend/src/middleware/featureGate.ts
```

```typescript
import { isFeatureEnabled, type TFeatureFlagName } from '@tdsk/domain'
import type { RequestHandler } from 'express'

export function featureGate(flag: TFeatureFlagName): RequestHandler {
  return (req, res, next) => {
    if (isFeatureEnabled(flag)) return next()
    res.status(404).json({ error: 'Not found' })
  }
}
```

Applied at endpoint group level:

```typescript
export const orgSkills = {
  path: '/:orgId/skills',
  middleware: [featureGate('skills')],
  endpoints: { listSkills, getSkill, createSkill, ... }
}
```

For features where the endpoint serves double duty (e.g., the shell endpoint handles both terminal and GUI), use `isFeatureEnabled` as a direct check at the specific call site rather than gating the whole endpoint.

## Integration Points

### `terminalGui` Flag

| Layer | File | Gate |
|-------|------|------|
| Threads | `pages/Session/Session.tsx` | `<FeatureGate>` around `ViewToggle` and `SessionGUIView` render. When off, only the terminal view is available — no GUI/terminal toggle. |
| Admin | `pages/Orgs/OrgSettings.tsx` | `<FeatureGate>` around the `GuiConfigForm` section. When off, GUI configuration disappears from org settings. |
| Admin | `components/Sandboxes/SandboxDrawer.tsx` | `<FeatureGate>` around sandbox-level `GuiConfigForm`. When off, no per-sandbox GUI config. |
| Backend | Shell event processing (`onShellConnect.ts`) | `isFeatureEnabled('terminalGui')` check before calling `interpreterService.interpret()`. When off, no LLM interpretation — raw terminal events only. |

### `schedules` Flag

| Layer | File | Gate |
|-------|------|------|
| Admin | `routes/Routes.tsx` | Conditionally include `/orgs/:orgId/schedules` route |
| Admin | `routes/Routes.tsx` | Conditionally include agent-nested `/schedules` tab route |
| Admin | `constants/nav.tsx` | Filter "Schedules" nav item with `isFeatureEnabled('schedules')` (if data objects) or `<FeatureGate>` (if JSX) |
| Backend | `endpoints/orgs/orgSchedules.ts` | `featureGate('schedules')` middleware on the endpoint group |
| Backend | `services/scheduler/scheduler.ts` | `isFeatureEnabled('schedules')` at scheduler startup — don't start cron runner when off |

### `skills` Flag

| Layer | File | Gate |
|-------|------|------|
| Admin | `routes/Routes.tsx` | Conditionally include `/orgs/:orgId/skills` route |
| Admin | `routes/Routes.tsx` | Conditionally include agent-nested `/skills` tab route |
| Admin | `constants/nav.tsx` | Filter "Skills" nav item with `isFeatureEnabled('skills')` (if data objects) or `<FeatureGate>` (if JSX) |
| Backend | `endpoints/orgs/orgSkills.ts` | `featureGate('skills')` middleware on the endpoint group |

## What Stays Untouched

- **Domain types** — GUI, schedule, and skill types remain exported. Types aren't user-facing; removing them would break compilation.
- **Database schema** — all tables stay. No migration needed.
- **Backend services** — services exist but are unreachable behind gated endpoints.
- **Threads app** — schedules and skills don't appear in the threads SPA, so no gates needed there.

## Files

| Action | File | Purpose |
|--------|------|---------|
| New | `repos/domain/src/constants/featureFlags.ts` | Flag registry, types, `isFeatureEnabled` |
| Modify | `repos/domain/src/constants/index.ts` | Barrel export |
| New | `repos/components/src/hooks/useFeatureFlag.ts` | React hook |
| New | `repos/components/src/components/FeatureGate/FeatureGate.tsx` | Gate component |
| Modify | `repos/components/src/hooks/index.ts` | Barrel export |
| Modify | `repos/components/src/components/index.ts` | Barrel export |
| New | `repos/backend/src/middleware/featureGate.ts` | Express middleware |
| Modify | `repos/threads/src/pages/Session/Session.tsx` | Gate GUI view + toggle |
| Modify | `repos/admin/src/pages/Orgs/OrgSettings.tsx` | Gate GUI config form |
| Modify | `repos/admin/src/components/Sandboxes/SandboxDrawer.tsx` | Gate sandbox GUI config |
| Modify | `repos/admin/src/routes/Routes.tsx` | Conditionally register flagged routes |
| Modify | `repos/admin/src/constants/nav.tsx` | Gate flagged nav items |
| Modify | `repos/backend/src/endpoints/orgs/orgSkills.ts` | Add featureGate middleware |
| Modify | `repos/backend/src/endpoints/orgs/orgSchedules.ts` | Add featureGate middleware |
| Modify | `repos/backend/src/services/scheduler/scheduler.ts` | Guard scheduler startup |
| Modify | `repos/backend/src/endpoints/sandboxes/onShellConnect.ts` | Guard interpreter call |

~4 new files, ~12 modified files.

## Testing

- **Unit tests** for `isFeatureEnabled` — verify it reads from the constants correctly.
- **Unit tests** for `FeatureGate` component — verify it renders children when enabled, fallback when disabled.
- **Unit tests** for `featureGate` middleware — verify it calls `next()` when enabled, returns 404 when disabled.
- **Manual verification** — with all three flags set to `false`, confirm:
  - Admin sidebar has no Skills or Schedules links
  - Navigating to `/orgs/:id/skills` or `/orgs/:id/schedules` via URL shows a 404 page
  - Org settings page has no GUI config section
  - Sandbox drawer has no GUI config section
  - Terminal session in threads shows only the terminal, no GUI toggle
  - API calls to `/skills` and `/schedules` endpoints return 404
  - Scheduler service does not start its cron runner

## Expanding the System

To add a new flag:

1. Add one line to `FeatureFlags` in `repos/domain/src/constants/featureFlags.ts`
2. Add `<FeatureGate flag="newFlag">` or `isFeatureEnabled('newFlag')` at the relevant integration points
3. Optionally add `featureGate('newFlag')` middleware to backend endpoint groups

The type system enforces that flag names are valid — a typo in a flag name is a compile error.

To enable a flag for launch: change `enabled: false` to `enabled: true` in the registry.

To remove a flag after the feature is stable: delete the line from the registry, fix the resulting type errors by removing all gate wrappers at consumer sites.
