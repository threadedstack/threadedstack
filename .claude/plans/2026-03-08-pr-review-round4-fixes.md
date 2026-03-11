# PR Review Round 4 Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all 25 issues (5 critical, 10 important, 10 medium) found during comprehensive PR review of the K8s Dynamic Pod Sandbox system.

**Architecture:** Fixes span 3 layers: deploy (NetworkPolicy), sandbox repo (KubeClient), and backend repo (endpoints, services, middleware). Changes are mostly independent and can be parallelized by file.

**Tech Stack:** TypeScript, Express 5, @kubernetes/client-node, http-proxy-middleware, http-mitm-proxy

---

## Priority 1 — Security (Critical)

### Task 1: Fix NetworkPolicy Egress Port (C1)

The `NetworkPolicy` only allows sandbox pods to reach backend on port `5885`, but the egress proxy listens on port `8889` (`TDSK_BE_EGRESS_PORT`). Sandbox outbound traffic routed through the egress proxy will be blocked by the policy.

**Files:**
- Modify: `deploy/templates/networkpolicy.yaml:17-18`

**Step 1: Add egress proxy port to NetworkPolicy**

```yaml
      ports:
        - port: 5885
        - port: 8889
```

The egress proxy port is configured via `TDSK_BE_EGRESS_PORT` (default `8889`). Since this is a Helm template, we could parameterize it, but the deploy config already uses the env var default. Adding the literal `8889` port alongside `5885` is sufficient — they're both backend pod ports and won't diverge without a matching config change.

**Step 2: Verify the template renders correctly**

Run: `tdsk dev render 2>&1 | grep -A 10 'networkpolicy'`
Expected: Both ports appear in the rendered YAML.

---

### Task 2: Fix `stopSandbox` Auth — Use `requireResourceWithPermission` (C2)

`stopSandbox.ts` accepts `orgId` from `req.body`, which lets a caller spoof the org context for RBAC. It also uses `checkPermission` (role-only), not `requireResourceWithPermission` (DB lookup + role check). The route has `/:id` but ignores it, so there's no DB-backed proof that the sandbox belongs to the claimed org.

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/stopSandbox.ts`

**Step 1: Rewrite to use `requireResourceWithPermission`**

Replace the entire action body:

```typescript
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const stopSandbox: TEndpointConfig = {
  path: `/:id/stop`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { podName } = req.body

    if (!podName) throw new Exception(400, `podName is required`)

    const sandbox = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.delete,
      EPermResource.sandbox,
      `Sandbox`,
      (sb) => ({ orgId: sb.orgId })
    )

    const sandboxService = req.app.locals.sandboxService
    if (!sandboxService) throw new Exception(503, `Sandbox service not available`)

    await sandboxService.validatePodOwnership(podName, sandbox.orgId)
    await sandboxService.stopPod(podName)

    res.status(200).json({ data: { success: true } })
  },
}
```

Key changes:
- `orgId` comes from the DB record (`sandbox.orgId`), not `req.body`
- Uses `requireResourceWithPermission` to validate sandbox exists and belongs to caller's org
- Route param `:id` is now used for DB lookup (was previously ignored)

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors in `stopSandbox.ts`.

---

### Task 3: Fix `execInSandbox` Auth — Use `requireResourceWithPermission` (C3)

Same pattern as `stopSandbox`: accepts `orgId` from `req.body` and uses `checkPermission`. Also ignores the `:id` route param entirely.

**Files:**
- Modify: `repos/backend/src/endpoints/sandboxes/execInSandbox.ts`

**Step 1: Rewrite to use `requireResourceWithPermission`**

```typescript
/**
 * SECURITY NOTE: sandbox.exec() uses the Kubernetes Exec API
 * (@kubernetes/client-node k8s.Exec) via KubeClient.runInPod().
 * It does NOT use child_process on the host. Commands execute inside the pod via sh -c.
 */
import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

export const execInSandbox: TEndpointConfig = {
  path: `/:id/exec`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { command, args, podName } = req.body

    if (!command) throw new Exception(400, `command is required`)
    if (!podName) throw new Exception(400, `podName is required`)

    const sandbox = await requireResourceWithPermission(
      req,
      db.services.sandbox,
      id,
      EPermAction.update,
      EPermResource.sandbox,
      `Sandbox`,
      (sb) => ({ orgId: sb.orgId })
    )

    const sandboxService = req.app.locals.sandboxService
    if (!sandboxService) throw new Exception(503, `Sandbox service not available`)

    await sandboxService.validatePodOwnership(podName, sandbox.orgId)
    const sbInstance = await sandboxService.getSandbox(podName)
    const result = await sbInstance.exec(command, args)

    res.status(200).json({ data: result })
  },
}
```

Key changes:
- Removed `orgId` from `req.body` destructuring
- Uses `requireResourceWithPermission` with `:id` for DB + permission check
- `sandbox.orgId` (from DB) is passed to `validatePodOwnership`

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors in `execInSandbox.ts`.

---

### Task 4: `createSandbox` and `listSandboxes` Auth — SKIP

`createSandbox.ts` and `listSandboxes.ts` accept `orgId` from `req.body`/`req.params` and use `checkPermission`. For creation/listing, there's no existing resource to look up, so `requireResourceWithPermission` doesn't apply. `checkPermission` validates the user's role in the specified org — if the user is not a member, they won't have a role and the check fails. This is the standard pattern for all creation/collection endpoints in the codebase.

**Decision:** SKIP — `checkPermission` is correct for creation and collection endpoints.

---

## Priority 2 — Correctness (Important)

### Task 5: WebSocket Path — Guard Against Missing `sandboxService` (C5)

In `websocket.ts`, the K8s pod auto-start code silently falls through when `sandboxService` is undefined. If `sandboxProvider === 'kubernetes'` but `sandboxService` is null, the code proceeds with `podName = undefined`, and the agent will fail with a confusing error later.

**Files:**
- Modify: `repos/backend/src/services/websocket/websocket.ts:100-116`

**Step 1: Add guard after auto-start attempt**

In `#buildInitOpts`, after the auto-start block (after line 116), add:

```typescript
    if (sandboxProvider === ESandboxType.kubernetes && !podName) {
      throw new Error(`K8s sandbox not available — no podName or sandboxService`)
    }
```

This throws an error which bubbles up through `#ensureRunner` → `handlePrompt` catch, sending a proper error event to the client.

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors.

---

### Task 6: `getPodProxy` — Use `logger` Instead of `console.error` (H1)

The `onError` handler in `getPodProxy` uses `console.error` instead of the project's `logger`. The `logger` integrates with Winston and supports structured logging, log levels, and secret redaction.

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandboxService.ts:59`

**Step 1: Add `logger` import and replace `console.error`**

Add import at top of file:
```typescript
import { logger } from '@TBE/utils/logger'
```

Change line 59:
```typescript
// From:
console.error(`[SandboxProxy] Proxy error for ${target}:`, err.message)
// To:
logger.error(`[SandboxProxy] Proxy error for ${target}:`, err.message)
```

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors.

---

### Task 7: `setupSandbox` — Use `logger.warn` Instead of `console.warn` (H2)

`startEgressProxy` uses `console.warn` for the missing CA cert message. Should use `logger.warn` for consistency.

**Files:**
- Modify: `repos/backend/src/middleware/setupSandbox.ts:73`

**Step 1: Replace `console.warn` with `logger.warn`**

```typescript
// From:
console.warn(`[EgressProxy] CA cert files not found at ${CACertPath} / ${CAKeyPath}, egress proxy disabled`)
// To:
logger.warn(`[EgressProxy] CA cert files not found at ${CACertPath} / ${CAKeyPath}, egress proxy disabled`)
```

`logger` is already imported on line 4.

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors.

---

### Task 8: `setupSandbox` — Handle `resolveSecret` DB Errors (H2b)

The `resolveSecret` closure discards the DB error from `db.services.secret.get()`. If the DB returns an error, the function returns `null`, and the egress proxy throws with "Failed to resolve secret" — losing the real reason.

**Files:**
- Modify: `repos/backend/src/middleware/setupSandbox.ts:79-83`

**Step 1: Log DB errors in `resolveSecret`**

```typescript
  const resolveSecret = async (secretId: string): Promise<string | null> => {
    const { data: secret, error } = await app.locals.db.services.secret.get(secretId)
    if (error) {
      logger.error(`[EgressProxy] Failed to fetch secret ${secretId}:`, error.message)
      return null
    }
    if (!secret?.encryptedValue) return null
    return secretResolver.decrypt(secret, secret.orgId || ``)
  }
```

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors.

---

### Task 9: `agentEndpoint` — Add Server-Side Error Logging (H3)

The catch block in the SSE path logs errors to the client stream but never logs them server-side. Infrastructure errors (DB failures, sandbox crashes) would go unrecorded.

**Files:**
- Modify: `repos/backend/src/services/endpoints/agentEndpoint.ts:235-240`

**Step 1: Add `logger` import if needed**

Check if `logger` is already imported. If not, add:
```typescript
import { logger } from '@TBE/utils/logger'
```

**Step 2: Add `logger.error` to catch block**

```typescript
    } catch (err) {
      const message = err instanceof Error ? err.message : `Agent execution failed`
      logger.error(`[AgentEndpoint] Agent run failed:`, message)
      if (!aborted) {
        res.write(`data: ${JSON.stringify({ type: `error`, error: message })}\n\n`)
      }
    }
```

**Step 3: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors.

---

### Task 10: Remove Dead `caCertSecretName` from `TStartPodOpts` (H4)

`TStartPodOpts` has a `caCertSecretName: string` field that is never read inside `startPod()`. The real CA secret name comes from `egressOpts.certSecretName` (type `TPodEgressOpts`). No callers pass `caCertSecretName`.

**Files:**
- Modify: `repos/backend/src/services/sandboxes/sandboxService.ts:17-24`

**Step 1: Remove `caCertSecretName` from `TStartPodOpts`**

```typescript
type TStartPodOpts = {
  orgId: string
  userId: string
  sandboxId: string
  projectId: string
  egressOpts: TPodEgressOpts
}
```

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors (no callers pass this field).

---

## Priority 3 — Robustness (Medium)

### Task 11: `setupSandbox` — Safe Cleanup Handlers (M1)

The SIGTERM/SIGINT cleanup calls `kubeClient.cleanup()` and `egressProxy?.stop()` without try-catch. If either throws, the other won't run, and the process may hang.

**Files:**
- Modify: `repos/backend/src/middleware/setupSandbox.ts:47-52`

**Step 1: Wrap cleanup in try-catch**

```typescript
    const cleanup = () => {
      try { kubeClient.cleanup() }
      catch (err) { logger.error(`[Sandbox] KubeClient cleanup failed:`, (err as Error).message) }

      try { egressProxy?.stop() }
      catch (err) { logger.error(`[Sandbox] EgressProxy cleanup failed:`, (err as Error).message) }
    }
    process.on(`SIGTERM`, cleanup)
    process.on(`SIGINT`, cleanup)
```

**Step 2: Run type check**

Run: `cd repos/backend && pnpm types`
Expected: No errors.

---

### Task 12: `kubeClient` — Use `logger` Instead of `console.warn` (M9)

`kubeClient.ts` uses `console.warn` in the constructor (line 52) and in `hydrate` (line 213) instead of the project logger.

**Files:**
- Modify: `repos/sandbox/src/kube/kubeClient.ts:52,213`

**Step 1: Replace `console.warn` with `logger.warn`**

`logger` is already imported from `@TSB/utils/logger` on line 10.

Line 52:
```typescript
// From:
console.warn(`[KubeClient] In-cluster config failed, falling back to default:`, (err as Error).message)
// To:
logger.warn(`[KubeClient] In-cluster config failed, falling back to default:`, (err as Error).message)
```

Line 213:
```typescript
// From:
catch (err) { console.warn(`[KubeClient] Failed to clean up pod:`, name, (err as Error).message) }
// To:
catch (err) { logger.warn(`[KubeClient] Failed to clean up pod:`, name, (err as Error).message) }
```

**Step 2: Run type check**

Run: `cd repos/sandbox && pnpm types`
Expected: No errors.

---

### Task 13: Remove TODO Comment in `backend.config.ts` (M10)

Line 57 of `backend.config.ts` has a `// TODO: handle this better` comment which violates the project's no-TODO rule.

**Files:**
- Modify: `repos/backend/configs/backend.config.ts:57-58`

**Step 1: Remove the TODO comment**

```typescript
// From:
  // TODO: handle this better
  frontendUrl: TDSK_FRONTEND_URL || `http://localhost:${TDSK_AD_PORT}`,
// To:
  frontendUrl: TDSK_FRONTEND_URL || `http://localhost:${TDSK_AD_PORT}`,
```

No functional change — just comment removal.

---

## Deferred Design Issues

### Task 14: `TSandboxConfig.options` Untyped (H8) — DEFER

`TSandboxConfig.options` is `Record<string, unknown>`. Ideally it would be a discriminated union keyed on `provider`. This change touches the domain model consumed by sandbox, backend, and agent repos. Should be a separate PR.

### Task 15: `TAgentEnvironment` Mutual Exclusivity Not Enforced (H9) — DEFER

Comments say `podName` and `sandboxId` are mutually exclusive, but no runtime or type-level enforcement exists. Cross-repo concern — should be a separate PR.

### Task 16: `validatePodOwnership` Return Pod (M2) — SKIP

No current caller benefits from a returned pod object. Premature optimization.

### Task 17: `getPodState` 404 Semantics (M3) — SKIP

Returns `Failed` for 404 — behavior is pragmatic and documented in JSDoc. Adding a new enum value has disproportionate blast radius.

---

## Verification

After all fixes are applied:

**Step 1: Type checks**

```bash
cd repos/sandbox && pnpm types
cd repos/backend && pnpm types
```

**Step 2: Unit tests**

```bash
cd repos/sandbox && pnpm test
cd repos/backend && pnpm test
```

**Step 3: Helm render**

```bash
tdsk dev render 2>&1 | grep -A 15 'networkpolicy'
```

---

## Summary

| ID | Priority | File | Fix |
|----|----------|------|-----|
| C1 | Critical | `deploy/templates/networkpolicy.yaml` | Add port 8889 for egress proxy |
| C2 | Critical | `repos/backend/src/endpoints/sandboxes/stopSandbox.ts` | Replace `checkPermission` with `requireResourceWithPermission`, remove body `orgId` |
| C3 | Critical | `repos/backend/src/endpoints/sandboxes/execInSandbox.ts` | Same as C2 |
| C5 | Important | `repos/backend/src/services/websocket/websocket.ts` | Add guard when K8s sandbox has no podName |
| H1 | Important | `repos/backend/src/services/sandboxes/sandboxService.ts` | `console.error` to `logger.error` |
| H2 | Important | `repos/backend/src/middleware/setupSandbox.ts` | `console.warn` to `logger.warn` |
| H2b | Important | `repos/backend/src/middleware/setupSandbox.ts` | Log DB errors in `resolveSecret` |
| H3 | Important | `repos/backend/src/services/endpoints/agentEndpoint.ts` | Add server-side error logging |
| H4 | Important | `repos/backend/src/services/sandboxes/sandboxService.ts` | Remove dead `caCertSecretName` field |
| M1 | Medium | `repos/backend/src/middleware/setupSandbox.ts` | Try-catch in cleanup handlers |
| M9 | Medium | `repos/sandbox/src/kube/kubeClient.ts` | `console.warn` to `logger.warn` |
| M10 | Medium | `repos/backend/configs/backend.config.ts` | Remove TODO comment |

**Active fixes:** 12 tasks across 8 files
**Skipped:** 4 (createSandbox/listSandboxes auth, validatePodOwnership return, getPodState semantics)
**Deferred:** 2 (TSandboxConfig union type, TAgentEnvironment enforcement)
