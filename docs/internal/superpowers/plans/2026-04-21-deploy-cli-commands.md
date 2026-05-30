# Deploy CLI Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `tdsk deploy` task group with `apply` and `status` subcommands that wrap `devspace deploy` and `kubectl get` for production deployment to Civo K8s.

**Architecture:** The new `deploy` task group follows the exact same pattern as the existing `devspace` task group — a parent task with nested subtasks. `apply` reuses the `dsdefaults` wrapper (which already handles `--namespace`, `--kube-context`, and `--profile` resolution from `getKubeMeta`) to call `devspace deploy`. `status` uses the `kubectl` utility to run `kubectl get pods,svc` in the target namespace.

**Tech Stack:** TypeScript, @keg-hub/args-parse, DevSpace CLI, kubectl

**Spec:** `docs/superpowers/specs/2026-04-19-civo-deployment-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `repos/cli/src/utils/devspace/devspace.ts` | Modify | Add `deploy` method (mirrors `render` but calls `devspace deploy` without `--render --skip-build`) |
| `repos/cli/src/tasks/deploy/apply.ts` | Create | `tdsk deploy apply` — wraps `devspace.deploy()` with `--dry-run` support |
| `repos/cli/src/tasks/deploy/status.ts` | Create | `tdsk deploy status` — wraps `kubectl get pods,svc` in target namespace |
| `repos/cli/src/tasks/deploy/deploy.ts` | Create | Parent task grouping `apply` and `status` subtasks |
| `repos/cli/src/tasks/deploy/index.ts` | Create | Barrel export for the deploy task group |
| `repos/cli/src/tasks/index.ts` | Modify | Register deploy task group alongside existing groups |

---

### Task 1: Add `deploy` method to devspace utility

**Files:**
- Modify: `repos/cli/src/utils/devspace/devspace.ts`

The existing `devspace.render` method calls `devspace deploy --render --skip-build`. The new `deploy` method calls `devspace deploy` without those flags — triggering the `deploy` pipeline in `devspace.yaml` which runs `create_deployments` for all three services (caddy, proxy, backend) without starting dev containers.

The `dsdefaults` wrapper already handles:
- Resolving `--namespace` and `--kube-context` from `getKubeMeta()` (reads `TDSK_KUBE_NAMESPACE` / `TDSK_KUBE_CONTEXT` from config or `--namespace` / `--kubeContext` params)
- Resolving `--profile` from `params.profile || params.env` (so `--env production` automatically selects the production profile)
- Setting `DEVSPACE_CONFIG` env to `deploy/devspace.yaml`
- Adding `NODE_OPTIONS` with esbuild-register

- [ ] **Step 1: Add the `deploy` method to the devspace utility**

In `repos/cli/src/utils/devspace/devspace.ts`, add a `deploy` method to the `devspace` object. It mirrors `render` but passes `deploy` (the bare command) plus any `--skip-build` flag:

```typescript
  deploy: dsdefaults(
    async (props: TTaskActionArgs) =>
      await cmd({
        ...cmdOpts(props),
        args: [...(props?.params?.dsargs || []), `deploy`, ...(props?.params?.args || [])],
      }),
    {
      build: `--force-build`,
    }
  ),
```

Add this after the existing `render` property. The `build` flag map lets `--build` pass through as `--force-build` to devspace (same pattern as `start`).

- [ ] **Step 2: Verify the change compiles**

Run: `cd repos/cli && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```
feat(cli): add deploy method to devspace utility
```

---

### Task 2: Create `tdsk deploy apply` task

**Files:**
- Create: `repos/cli/src/tasks/deploy/apply.ts`

This is the primary deploy command. It calls `devspace.deploy()` which triggers the `deploy` pipeline in `devspace.yaml`. When `--dry-run` is passed, it falls back to `devspace.render()` (which adds `--render --skip-build`).

The `--env` option is a global default in `cli.ts` (default: `local`), so passing `--env production` causes `dsdefaults` to add `--profile production`, and `loadCfg('production')` loads `values.production.yaml` which sets `TDSK_KUBE_NAMESPACE=tdsk-production` and `TDSK_KUBE_CONTEXT=tdsk`.

- [ ] **Step 1: Create the apply task file**

Create `repos/cli/src/tasks/deploy/apply.ts`:

```typescript
import type { TTask, TTaskAction } from '@TSCL/types'

import { devspace } from '@TSCL/utils/devspace'
import { sharedOpts } from '@TSCL/utils/tasks/options'

const applyAct: TTaskAction = async (args) => {
  const { params } = args

  if (params?.dryRun) return await devspace.render(args)

  await devspace.deploy(args)
}

export const apply: TTask = {
  name: `apply`,
  alias: [`ap`, `dep`],
  action: applyAct,
  example: `pnpm tdsk deploy apply --env production`,
  description: `Deploy services to the target Kubernetes cluster via DevSpace`,
  options: {
    log: sharedOpts.shared.log,
    envs: sharedOpts.shared.envs,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
    args: sharedOpts.devspace.args,
    build: {
      type: `boolean`,
      description: `Force rebuild images before deploying`,
    },
    dryRun: {
      type: `boolean`,
      alias: [`dry`, `render`],
      description: `Render templates without applying (same as devspace render)`,
    },
  },
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd repos/cli && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```
feat(cli): add deploy apply task
```

---

### Task 3: Create `tdsk deploy status` task

**Files:**
- Create: `repos/cli/src/tasks/deploy/status.ts`

This task runs `kubectl get pods,svc` in the target namespace to show deployment status. It uses the `kubectl` utility directly (not devspace) since it's a pure kubectl operation.

- [ ] **Step 1: Create the status task file**

Create `repos/cli/src/tasks/deploy/status.ts`:

```typescript
import type { TTask, TTaskAction } from '@TSCL/types'

import { kubectl } from '@TSCL/utils/kube/kubectl'
import { sharedOpts } from '@TSCL/utils/tasks/options'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

const statusAct: TTaskAction = async (args) => {
  const { params } = args
  const meta = getKubeMeta(args)

  const nsArgs = meta.namespace ? [`--namespace`, meta.namespace] : []

  await kubectl.ensureContext(args, [])

  const output = params?.output || `wide`
  await kubectl({
    log: params?.log,
    output: true,
    args: [`get`, `pods,svc`, `-o`, output, ...nsArgs],
  })
}

export const status: TTask = {
  name: `status`,
  alias: [`st`, `stat`],
  action: statusAct,
  example: `pnpm tdsk deploy status --env production`,
  description: `Show pod and service status for the target Kubernetes cluster`,
  options: {
    log: sharedOpts.shared.log,
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
    output: {
      alias: [`out`, `o`],
      default: `wide`,
      example: `--output json`,
      description: `Output format passed to kubectl (wide, json, yaml)`,
    },
  },
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd repos/cli && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```
feat(cli): add deploy status task
```

---

### Task 4: Create parent deploy task and register it

**Files:**
- Create: `repos/cli/src/tasks/deploy/deploy.ts`
- Create: `repos/cli/src/tasks/deploy/index.ts`
- Modify: `repos/cli/src/tasks/index.ts`

Wire up the task group so `tdsk deploy apply` and `tdsk deploy status` are discoverable by the CLI arg parser.

- [ ] **Step 1: Create the parent task definition**

Create `repos/cli/src/tasks/deploy/deploy.ts`:

```typescript
import type { TTask } from '@TSCL/types'

import { apply } from './apply'
import { status } from './status'

export const deploy: TTask = {
  name: `deploy`,
  alias: [`dp`],
  tasks: {
    apply,
    status,
  },
}
```

- [ ] **Step 2: Create the barrel export**

Create `repos/cli/src/tasks/deploy/index.ts`:

```typescript
export * from './deploy'
```

- [ ] **Step 3: Register deploy in the task index**

In `repos/cli/src/tasks/index.ts`, add the deploy import and spread it into the tasks object:

```typescript
import type { TTasks } from '@TSCL/types'

import * as web from './web'
import * as kube from './kube'
import * as docker from './docker'
import * as deploy from './deploy'
import * as devspace from './devspace'

export const tasks: TTasks = {
  ...kube,
  ...web,
  ...docker,
  ...deploy,
  ...devspace,
}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd repos/cli && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Manual smoke test**

Run these commands to verify the CLI discovers the new tasks:

```bash
# Should show deploy in help output (or at least not error)
cd repos/cli && pnpm cli deploy --help

# Dry-run (renders templates, does not apply)
cd repos/cli && pnpm cli deploy apply --env production --dry-run

# Status against local cluster (should show pods if K8s is running)
cd repos/cli && pnpm cli deploy status
```

Expected:
- `--help` prints the deploy task or doesn't error
- `--dry-run` renders the devspace templates with production profile values
- `status` shows pods/services in the local namespace (or the production namespace if `--env production` is passed)

- [ ] **Step 6: Commit**

```
feat(cli): register deploy task group with apply and status commands
```

---

## Summary

| Command | What it does | Under the hood |
|---------|-------------|----------------|
| `tdsk deploy apply --env production` | Deploy all services to production | `devspace deploy --profile production --namespace tdsk-production --kube-context tdsk` |
| `tdsk deploy apply --env production --dry-run` | Render templates without applying | `devspace deploy --render --skip-build --profile production --namespace tdsk-production --kube-context tdsk` |
| `tdsk deploy apply --env production --namespace custom-ns --kube-context custom-ctx` | Deploy with overridden namespace/context | `devspace deploy --profile production --namespace custom-ns --kube-context custom-ctx` |
| `tdsk deploy status --env production` | Check pod/service status | `kubectl get pods,svc -o wide --namespace tdsk-production` (after ensuring kube-context) |

### What's NOT in this plan (already done or out of scope)

- **`values.production.yaml`** — Already expanded with full production config (reviewed in current state)
- **DevSpace production profile** — Already configured in `devspace.yaml` with image patches and Civo LB annotations
- **Docker image builds** — `tdsk doc build --push` already works with `--context caddy/proxy/backend/sandbox`
- **K8s secrets** — Existing `tdsk kube secret` commands already work against any cluster
- **DNS configuration** — Manual; no CLI command needed
- **KubeVirt** — Explicitly deferred per user instruction
