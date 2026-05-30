# GitHub Actions Production Deployment

## Overview

Automate the production deployment pipeline via GitHub Actions. A single workflow handles change detection, parallel Docker image builds, Kubernetes deployment via the `tdsk` CLI, health verification, and automatic rollback on failure. Supports both automatic triggers (merge to `production` branch) and manual dispatch via the GitHub UI.

## Architecture

### Approach

Single workflow file (`.github/workflows/deploy-production.yml`) with a dynamic job matrix. Change detection determines which images need building, parallel matrix jobs build them, then sequential jobs deploy and verify.

### Job Graph

```
detect-changes → test → build-images (matrix, parallel) → deploy → verify (rollback on failure)
```

- **detect-changes**: determines which image contexts changed (or reads manual inputs)
- **test**: runs unit tests and type checks — gates all subsequent jobs
- **build-images**: parallel Docker buildx per context, pushes to GHCR
- **deploy**: installs tdsk CLI, runs migrations, deploys via DevSpace/Helm
- **verify**: health checks with automatic rollback on failure

### Estimated Runtime

| Phase | Duration |
|---|---|
| Change detection | ~30s |
| Tests + type checks | ~2-4 min |
| Image builds (parallel, cached) | ~5-8 min |
| Deploy | ~2-3 min |
| Verify | ~1-2 min |
| **Total** | **~10-18 min** |

## Triggers

### Automatic: Push to Production

```yaml
on:
  push:
    branches: [production]
```

Runs change detection to build only affected images.

### Manual: Workflow Dispatch

```yaml
on:
  workflow_dispatch:
    inputs:
      build_caddy:
        description: 'Build Caddy image'
        type: boolean
        default: false
      build_proxy:
        description: 'Build Proxy image'
        type: boolean
        default: false
      build_backend:
        description: 'Build Backend image'
        type: boolean
        default: false
      build_sandbox:
        description: 'Build Sandbox image'
        type: boolean
        default: false
      deploy_only:
        description: 'Skip builds, just redeploy'
        type: boolean
        default: false
```

Checkboxes in the GitHub UI select which images to build. `deploy_only` skips all builds and redeploys the currently-pushed images.

## Job 1: Detect Changes

**Runs on:** `ubuntu-latest`
**Purpose:** Determine which image contexts need building based on changed files.

### Path-to-Image Mapping

| Changed Path | Triggers Build |
|---|---|
| `repos/proxy/`, `deploy/Dockerfile.proxy` | `proxy` |
| `repos/backend/`, `repos/agent/`, `repos/sandbox/`, `deploy/Dockerfile.backend` | `backend` |
| `deploy/Caddyfile`, `deploy/Dockerfile.caddy` | `caddy` |
| `deploy/Dockerfile.sandbox` | `sandbox` |
| `repos/domain/`, `repos/database/`, `repos/logger/` | `proxy` + `backend` (shared deps) |
| `deploy/templates/`, `deploy/devspace.yaml`, `deploy/values*.yaml` | deploy-only (no builds) |

### Outputs

- `contexts`: JSON array of contexts to build (e.g., `["proxy", "backend"]`)
- `deploy_only`: boolean — true if only deploy config changed, no images need building
- `should_deploy`: boolean — true if any relevant files changed

### Behavior by Trigger

- **push**: runs `git diff --name-only HEAD~1` and applies the path mapping
- **workflow_dispatch**: reads the input checkboxes directly, no git diff

## Job 2: Test

**Runs on:** `ubuntu-latest`
**Depends on:** `detect-changes`
**Condition:** `should_deploy` is true (skip if no relevant changes)
**Purpose:** Run unit tests and type checks before investing time in image builds. If tests fail, the entire workflow stops.

### Steps

1. **Checkout** — full repo
2. **Setup Node.js + pnpm** — `actions/setup-node@v4` + `pnpm/action-setup`
3. **Install dependencies** — `pnpm install`
4. **Run unit tests** — `pnpm test`
5. **Run type checks** — `pnpm types`

Both commands must pass for the job to succeed. If either fails, the workflow stops — no images are built, no deploy happens.

### Scope

These are the monorepo-wide test and type check commands. They run all sub-repo unit tests (vitest) and TypeScript type checks. Integration tests are out of scope (they require a live K8s cluster).

## Job 3: Build Images

**Runs on:** `ubuntu-latest`
**Depends on:** `test`
**Condition:** skipped if `deploy_only` is true or `contexts` is empty
**Strategy:** `matrix.context` from the `contexts` output — runs in parallel

### Steps per Matrix Job

1. **Checkout** — full repo (Dockerfiles use monorepo root as build context)
2. **Set up Docker Buildx** — `docker/setup-buildx-action`
3. **Login to GHCR** — `docker/login-action` with `GITHUB_TOKEN` (no extra secret needed)
4. **Build + push** — `docker/build-push-action`:
   - Dockerfile: `deploy/Dockerfile.${{ matrix.context }}`
   - Context: `.` (monorepo root)
   - Platforms: `linux/amd64,linux/arm64`
   - Tags: `ghcr.io/threadedstack/tdsk-${{ matrix.context }}:sha-<SHORT_SHA>`, `ghcr.io/threadedstack/tdsk-${{ matrix.context }}:latest`
   - Cache: `type=gha` (GitHub Actions cache for layer reuse)

### Image Tag Strategy

Every CI build dual-tags:
- **`sha-<7-char-short-sha>`** — immutable, used for deployments and rollback
- **`latest`** — mutable, kept for local dev convenience

Production K8s deployments always reference the SHA tag, never `latest`.

### Why Not `tdsk doc build`?

The CLI wraps `docker buildx build` with the same arguments. Using `docker/build-push-action` directly is idiomatic for GitHub Actions, has built-in caching via `type=gha`, and avoids needing pnpm/CLI installed in the build jobs. The `tdsk` CLI is only needed for the deploy step.

## Job 4: Deploy

**Runs on:** `ubuntu-latest`
**Depends on:** `build-images` (or `test` if builds were skipped)
**Condition:** `should_deploy` is true

### Setup Steps

1. **Checkout** — full repo (needed for `tdsk` CLI, Helm charts, DevSpace config)
2. **Install Civo CLI** — download binary or use `civo/civo-github-actions/setup`
3. **Fetch kubeconfig** — `civo kubernetes config threadedstack --save --merge --region NYC1` using `CIVO_TOKEN` GitHub secret
4. **Set kube context** — `kubectl config use-context threadedstack`, verify with `kubectl get ns tdsk-production`
5. **Install Helm** — `azure/setup-helm`
6. **Install DevSpace** — direct binary download
7. **Setup Node.js + pnpm** — `actions/setup-node@v4` + `pnpm/action-setup`
8. **Install dependencies** — `pnpm install`
9. **Assemble secrets YAML** — write `~/.config/tdsk/values.yaml` from individual GitHub secrets (see Secrets section)

### Migration Step

10. **Run non-destructive migrations** — execute `tdsk db push --env production --strict`. Drizzle's `--strict` flag causes `drizzle-kit push` to exit with a non-zero code if the schema diff contains destructive statements (DROP TABLE, DROP COLUMN, ALTER COLUMN type changes). The workflow step fails on non-zero exit, halting before deploy. The step's error output instructs the operator to review the migration and run it manually via the CLI if the destructive change is intentional.

### Deploy Steps

11. **Record previous image SHAs** — capture the currently-running image tag from each deployment for rollback:
    ```bash
    kubectl get deployment tdsk-backend -n tdsk-production \
      -o jsonpath='{.spec.template.spec.containers[0].image}'
    ```
    Store as a job output for the verify/rollback job.
12. **Update image tags** — pass SHA-based image tags as overrides so DevSpace/Helm uses `sha-<SHORT_SHA>` instead of `latest`
13. **Deploy** — `tdsk deploy apply --env production`
14. **Restart rebuilt pods** — `tdsk kube remove --context <ctx> --env production` for each context that was rebuilt (forces new image pull)

## Job 5: Verify & Rollback

**Runs on:** `ubuntu-latest`
**Depends on:** `deploy`
**Runs always** (even if deploy reports success — the health check is the real gate)

### Health Check Steps

1. **Wait for pods to stabilize** — poll `kubectl get pods -n tdsk-production` until all pods show `Running` + `1/1` ready, with a 3-minute timeout
2. **Check proxy health** — `curl -sf --retry 5 --retry-delay 10 https://px.threadedstack.app/health`
3. **Check backend health** — `curl -sf --retry 5 --retry-delay 10 https://px.threadedstack.app/_/health`
4. **Mark success** — if both respond, the job passes

### Rollback Steps (on verify failure)

5. **Log failure** — capture which health check failed + pod logs via `tdsk kube logs`
6. **Restore previous images** — re-run `tdsk deploy apply --env production` with the previous SHA tags (captured in step 11 of the deploy job)
7. **Restart pods with old images** — `tdsk kube remove` for affected contexts
8. **Re-verify** — hit health endpoints to confirm rollback succeeded
9. **Fail the workflow** — even if rollback succeeds, the workflow exits with failure status so GitHub sends notifications

### Rollback Constraints

- Rollback does **NOT** revert database migrations. Since only non-destructive (additive) migrations run in CI, the old code is compatible with the new schema.
- If rollback itself fails, the workflow fails with logs from both the original failure and the rollback attempt. This is a manual intervention scenario.

## GitHub Secrets

16 secrets total, organized by category.

### Infrastructure

| Secret | Purpose |
|---|---|
| `CIVO_TOKEN` | Civo API token to fetch kubeconfig dynamically |

GHCR authentication uses the built-in `GITHUB_TOKEN` — no extra secret needed.

### Master Key

| Secret | Purpose |
|---|---|
| `TDSK_MASTER_KEY` | Platform encryption key |

### Database (Neon)

| Secret | Purpose |
|---|---|
| `TDSK_DB_URL` | Connection string |
| `TDSK_DB_USER` | Database user |
| `TDSK_DB_PASS` | Database password |
| `TDSK_DB_AUTH_URL` | Neon auth connection string |
| `TDSK_DB_JWT_SCRT` | JWT signing secret |
| `TDSK_DB_SRV_ROLE` | Service role token |
| `TDSK_DB_PUBLIC_KEY` | DB public key |
| `TDSK_DB_PROJECT_ID` | Neon project ID |

### Payments (Stripe)

| Secret | Purpose |
|---|---|
| `TDSK_PAY_ACCESS_TOKEN` | Stripe secret key |
| `TDSK_PAY_WEBHOOK_SECRET` | Stripe webhook signing secret |

### Email

| Secret | Purpose |
|---|---|
| `TDSK_EMAIL_API_KEY` | Email provider API key |

### Egress Proxy

| Secret | Purpose |
|---|---|
| `TDSK_EGRESS_CA_CERT` | CA certificate (base64-encoded file content) |
| `TDSK_EGRESS_CA_KEY` | CA private key (base64-encoded file content) |

### Docker (K8s imagePullSecrets)

| Secret | Purpose |
|---|---|
| `TDSK_DOCKER_USER` | GHCR username |
| `TDSK_DOCKER_TOKEN` | GHCR personal access token |

### Secrets Assembly

The deploy job writes `~/.config/tdsk/values.yaml` from these secrets in the format `loadEnvs()` expects:

```yaml
env:
  TDSK_MASTER_KEY: <from secret>
  TDSK_DB_URL: <from secret>
  TDSK_DB_USER: <from secret>
  TDSK_DB_PASS: <from secret>
  TDSK_DB_AUTH_URL: <from secret>
  TDSK_DB_JWT_SCRT: <from secret>
  TDSK_DB_SRV_ROLE: <from secret>
  TDSK_DB_PUBLIC_KEY: <from secret>
  TDSK_DB_PROJECT_ID: <from secret>
  TDSK_PAY_ACCESS_TOKEN: <from secret>
  TDSK_PAY_WEBHOOK_SECRET: <from secret>
  TDSK_EMAIL_API_KEY: <from secret>
  TDSK_EGRESS_CA_CERT: <from secret>
  TDSK_EGRESS_CA_KEY: <from secret>
```

Docker secrets (`TDSK_DOCKER_USER`, `TDSK_DOCKER_TOKEN`) are used directly in the `tdsk kube secret docker` step, not in the values YAML.

## Notifications

GitHub's built-in notifications only. Failed workflows send email to the repository's notification subscribers. No Slack or external integrations.

## Files Created

| File | Purpose |
|---|---|
| `.github/workflows/deploy-production.yml` | The workflow |

## Prerequisites (Manual, One-Time)

Before the workflow can run, these must be done manually:

1. **Create `production` branch** — branch from `main` (or wherever production code lives)
2. **Add all 16 GitHub secrets** to the repository settings
3. **Ensure GHCR package permissions** — the repo's `GITHUB_TOKEN` must have `packages: write` (default for same-org repos)
4. **K8s cluster exists** — Civo cluster `threadedstack` with namespace `tdsk-production` and all K8s secrets already created
5. **DNS configured** — `px.threadedstack.app`, `*.sandbox.threadedstack.app`, `be.threadedstack.app` pointing to the Civo LB

The workflow assumes the cluster and secrets are already bootstrapped per `docs/meta/prod-deploy.md`. It automates the "deploy updates" flow (sections 2.1-2.4 of that doc), not the initial "deploy from scratch" flow.

## Out of Scope

- Initial cluster provisioning (remains manual via Civo CLI)
- Initial K8s secret creation (remains manual via `tdsk kube secret`)
- Destructive database migrations (manual via `tdsk db push`)
- Admin/Threads/Website SPA deployments (not currently deployed to K8s)
- Integration tests in CI (require live K8s — unit tests and type checks only)
- GitHub Environments / deployment protection rules (can be added later)
