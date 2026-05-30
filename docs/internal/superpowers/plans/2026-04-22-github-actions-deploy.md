# GitHub Actions Production Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate production deployment via a single GitHub Actions workflow that detects changes, runs tests, builds Docker images in parallel, deploys to Civo K8s, verifies health, and rolls back on failure.

**Architecture:** Single workflow file with 5 jobs: detect-changes → test → build-images (matrix) → deploy → verify. Change detection maps file paths to image contexts. Manual dispatch supports image selection via checkboxes. SHA-based image tags enable deterministic rollback.

**Tech Stack:** GitHub Actions, Docker Buildx, GHCR, Civo CLI, DevSpace, Helm, pnpm, `tdsk` CLI

**Spec:** `docs/superpowers/specs/2026-04-22-github-actions-deploy-design.md`

**CRITICAL RULES FOR ALL AGENTS:**
- **NEVER** run `git commit`, `git push`, or any git write commands
- **NEVER** save files to the root folder
- Output commit messages as text only — the user commits manually

---

## File Structure

| File | Purpose |
|---|---|
| `.github/workflows/deploy-production.yml` | The complete workflow (create) |

This is a single-file implementation. All 5 jobs live in one workflow YAML. No supporting scripts, no shared actions — everything inline for simplicity.

---

### Task 1: Workflow Scaffold with Triggers

**Files:**
- Create: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Create the directory structure**

Run: `mkdir -p .github/workflows`

- [ ] **Step 2: Create the workflow file with triggers and permissions**

Create `.github/workflows/deploy-production.yml`:

```yaml
name: Deploy Production

on:
  push:
    branches: [production]
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
        description: 'Skip builds and tests, just redeploy current images'
        type: boolean
        default: false

concurrency:
  group: production-deploy
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

env:
  CIVO_CLUSTER: threadedstack
  CIVO_REGION: NYC1
  K8S_NAMESPACE: tdsk-production
  REGISTRY: ghcr.io/threadedstack
```

**Notes:**
- `concurrency.cancel-in-progress: false` prevents a new deploy from cancelling an in-progress one (could leave cluster in a bad state)
- `packages: write` allows pushing to GHCR via `GITHUB_TOKEN`
- The `env` block defines constants reused across jobs

- [ ] **Step 3: Validate YAML syntax**

Run: `cat .github/workflows/deploy-production.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"`
Expected: No output (valid YAML)

- [ ] **Step 4: Commit**

Output message: `feat(ci): add deploy-production workflow scaffold with triggers`

---

### Task 2: Detect Changes Job

**Files:**
- Modify: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Add the detect-changes job**

Append to the workflow file after the `env:` block:

```yaml
jobs:
  detect-changes:
    name: Detect Changes
    runs-on: ubuntu-latest
    outputs:
      contexts: ${{ steps.set-matrix.outputs.contexts }}
      deploy_only: ${{ steps.set-matrix.outputs.deploy_only }}
      should_deploy: ${{ steps.set-matrix.outputs.should_deploy }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Detect changed files and map to image contexts
        id: set-matrix
        run: |
          # Manual dispatch — read inputs directly
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            CONTEXTS="[]"

            if [ "${{ inputs.deploy_only }}" = "true" ]; then
              echo "contexts=[]" >> "$GITHUB_OUTPUT"
              echo "deploy_only=true" >> "$GITHUB_OUTPUT"
              echo "should_deploy=true" >> "$GITHUB_OUTPUT"
              exit 0
            fi

            if [ "${{ inputs.build_caddy }}" = "true" ]; then
              CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["caddy"]')
            fi
            if [ "${{ inputs.build_proxy }}" = "true" ]; then
              CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["proxy"]')
            fi
            if [ "${{ inputs.build_backend }}" = "true" ]; then
              CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["backend"]')
            fi
            if [ "${{ inputs.build_sandbox }}" = "true" ]; then
              CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["sandbox"]')
            fi

            echo "contexts=$(echo "$CONTEXTS" | jq -c .)" >> "$GITHUB_OUTPUT"
            echo "deploy_only=false" >> "$GITHUB_OUTPUT"
            if [ "$CONTEXTS" = "[]" ]; then
              echo "should_deploy=false" >> "$GITHUB_OUTPUT"
            else
              echo "should_deploy=true" >> "$GITHUB_OUTPUT"
            fi
            exit 0
          fi

          # Push trigger — detect changes via git diff
          CHANGED=$(git diff --name-only HEAD~1 HEAD)
          echo "Changed files:"
          echo "$CHANGED"

          CONTEXTS="[]"
          DEPLOY_CONFIG_ONLY=false

          # Shared deps (domain, database, logger) trigger both proxy + backend
          if echo "$CHANGED" | grep -qE '^repos/(domain|database|logger)/'; then
            CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["proxy", "backend"] | unique')
          fi

          # Proxy
          if echo "$CHANGED" | grep -qE '^(repos/proxy/|deploy/Dockerfile\.proxy)'; then
            CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["proxy"] | unique')
          fi

          # Backend (includes agent + sandbox repos which are bundled into backend image)
          if echo "$CHANGED" | grep -qE '^(repos/(backend|agent|sandbox)/|deploy/Dockerfile\.backend)'; then
            CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["backend"] | unique')
          fi

          # Caddy
          if echo "$CHANGED" | grep -qE '^deploy/(Caddyfile|Dockerfile\.caddy)'; then
            CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["caddy"] | unique')
          fi

          # Sandbox image
          if echo "$CHANGED" | grep -qE '^deploy/Dockerfile\.sandbox'; then
            CONTEXTS=$(echo "$CONTEXTS" | jq '. + ["sandbox"] | unique')
          fi

          # Deploy config only (templates, devspace, values) — no image builds needed
          if [ "$CONTEXTS" = "[]" ]; then
            if echo "$CHANGED" | grep -qE '^deploy/(templates/|devspace\.yaml|values)'; then
              DEPLOY_CONFIG_ONLY=true
            fi
          fi

          SHOULD_DEPLOY=false
          if [ "$CONTEXTS" != "[]" ] || [ "$DEPLOY_CONFIG_ONLY" = "true" ]; then
            SHOULD_DEPLOY=true
          fi

          echo "contexts=$(echo "$CONTEXTS" | jq -c .)" >> "$GITHUB_OUTPUT"
          echo "deploy_only=$DEPLOY_CONFIG_ONLY" >> "$GITHUB_OUTPUT"
          echo "should_deploy=$SHOULD_DEPLOY" >> "$GITHUB_OUTPUT"
          echo "Detected contexts: $CONTEXTS"
          echo "Deploy only: $DEPLOY_CONFIG_ONLY"
          echo "Should deploy: $SHOULD_DEPLOY"
```

**Notes:**
- `fetch-depth: 2` fetches the current + previous commit for `git diff HEAD~1`
- `jq` is pre-installed on `ubuntu-latest`
- `unique` in jq prevents duplicate contexts when shared deps trigger both proxy + backend

- [ ] **Step 2: Validate YAML syntax**

Run: `cat .github/workflows/deploy-production.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

Output message: `feat(ci): add detect-changes job with path-to-image mapping`

---

### Task 3: Test Job

**Files:**
- Modify: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Add the test job after detect-changes**

Append after the `detect-changes` job:

```yaml
  test:
    name: Test & Type Check
    runs-on: ubuntu-latest
    needs: detect-changes
    if: needs.detect-changes.outputs.should_deploy == 'true' && inputs.deploy_only != true
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm test

      - name: Run type checks
        run: pnpm types
```

**Notes:**
- `--frozen-lockfile` ensures CI uses the exact lockfile — fails if it's out of date
- `cache: pnpm` caches the pnpm store between runs for faster installs
- Job is skipped on `deploy_only` (manual redeploy without code changes)
- `pnpm test` runs `pnpm -r --filter=!@tdsk/integration test` (all unit tests, no integration)
- `pnpm types` runs `tsc --noEmit --pretty && pnpm -r types` (global + per-workspace type checks)

- [ ] **Step 2: Validate YAML syntax**

Run: `cat .github/workflows/deploy-production.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

Output message: `feat(ci): add test and type check job`

---

### Task 4: Build Images Job

**Files:**
- Modify: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Add the build-images job after test**

Append after the `test` job:

```yaml
  build-images:
    name: Build ${{ matrix.context }}
    runs-on: ubuntu-latest
    needs: [detect-changes, test]
    if: |
      needs.detect-changes.outputs.deploy_only != 'true' &&
      needs.detect-changes.outputs.contexts != '[]'
    strategy:
      fail-fast: true
      matrix:
        context: ${{ fromJson(needs.detect-changes.outputs.contexts) }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set image metadata
        id: meta
        run: |
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          IMAGE="${{ env.REGISTRY }}/tdsk-${{ matrix.context }}"
          echo "short_sha=$SHORT_SHA" >> "$GITHUB_OUTPUT"
          echo "image=$IMAGE" >> "$GITHUB_OUTPUT"
          echo "tag_sha=sha-$SHORT_SHA" >> "$GITHUB_OUTPUT"

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: deploy/Dockerfile.${{ matrix.context }}
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ steps.meta.outputs.image }}:${{ steps.meta.outputs.tag_sha }}
            ${{ steps.meta.outputs.image }}:latest
          cache-from: type=gha,scope=${{ matrix.context }}
          cache-to: type=gha,mode=max,scope=${{ matrix.context }}
```

**Notes:**
- `fail-fast: true` — if one image fails to build, cancel the others immediately (no point deploying partial)
- `scope=${{ matrix.context }}` — separate GHA cache per image context so they don't evict each other
- `mode=max` — cache all layers, not just the final ones
- The `meta` step computes the SHA tag once for reuse
- `fromJson()` converts the JSON array output from detect-changes into a matrix

- [ ] **Step 2: Validate YAML syntax**

Run: `cat .github/workflows/deploy-production.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

Output message: `feat(ci): add parallel image build job with GHCR push`

---

### Task 5: Deploy Job

**Files:**
- Modify: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Add the deploy job after build-images**

Append after the `build-images` job:

```yaml
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [detect-changes, test, build-images]
    if: |
      always() &&
      needs.detect-changes.outputs.should_deploy == 'true' &&
      needs.detect-changes.result == 'success' &&
      (needs.test.result == 'success' || needs.test.result == 'skipped') &&
      (needs.build-images.result == 'success' || needs.build-images.result == 'skipped')
    outputs:
      previous_images: ${{ steps.record-previous.outputs.previous_images }}
      deployed_sha: ${{ steps.sha.outputs.short_sha }}
    env:
      NODE_ENV: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Compute SHA tag
        id: sha
        run: |
          SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
          echo "short_sha=$SHORT_SHA" >> "$GITHUB_OUTPUT"
          echo "tag=sha-$SHORT_SHA" >> "$GITHUB_OUTPUT"

      - name: Install Civo CLI
        run: |
          curl -sL https://civo.com/get | sh
          sudo mv /tmp/civo /usr/local/bin/civo
          civo apikey save deploy-key "${{ secrets.CIVO_TOKEN }}"
          civo region use "${{ env.CIVO_REGION }}"

      - name: Fetch kubeconfig
        run: |
          civo kubernetes config "${{ env.CIVO_CLUSTER }}" --save --merge
          kubectl config use-context "${{ env.CIVO_CLUSTER }}"
          echo "Verifying cluster access..."
          kubectl get ns "${{ env.K8S_NAMESPACE }}"

      - name: Install Helm
        uses: azure/setup-helm@v4

      - name: Install DevSpace
        run: |
          curl -fsSL https://github.com/loft-sh/devspace/releases/latest/download/devspace-linux-amd64 -o devspace
          chmod +x devspace
          sudo mv devspace /usr/local/bin/devspace
          devspace --version

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Assemble secrets YAML
        run: |
          mkdir -p ~/.config/tdsk
          cat > ~/.config/tdsk/values.yaml << 'ENDOFYAML'
          env:
            TDSK_MASTER_KEY: "${{ secrets.TDSK_MASTER_KEY }}"
            TDSK_DB_URL: "${{ secrets.TDSK_DB_URL }}"
            TDSK_DB_USER: "${{ secrets.TDSK_DB_USER }}"
            TDSK_DB_PASS: "${{ secrets.TDSK_DB_PASS }}"
            TDSK_DB_AUTH_URL: "${{ secrets.TDSK_DB_AUTH_URL }}"
            TDSK_DB_JWT_SCRT: "${{ secrets.TDSK_DB_JWT_SCRT }}"
            TDSK_DB_SRV_ROLE: "${{ secrets.TDSK_DB_SRV_ROLE }}"
            TDSK_DB_PUBLIC_KEY: "${{ secrets.TDSK_DB_PUBLIC_KEY }}"
            TDSK_DB_PROJECT_ID: "${{ secrets.TDSK_DB_PROJECT_ID }}"
            TDSK_PAY_ACCESS_TOKEN: "${{ secrets.TDSK_PAY_ACCESS_TOKEN }}"
            TDSK_PAY_WEBHOOK_SECRET: "${{ secrets.TDSK_PAY_WEBHOOK_SECRET }}"
            TDSK_EMAIL_API_KEY: "${{ secrets.TDSK_EMAIL_API_KEY }}"
            TDSK_EGRESS_CA_CERT: "${{ secrets.TDSK_EGRESS_CA_CERT }}"
            TDSK_EGRESS_CA_KEY: "${{ secrets.TDSK_EGRESS_CA_KEY }}"
            TDSK_IMAGE_TAG: "sha-${{ steps.sha.outputs.short_sha }}"
          ENDOFYAML

      - name: Run non-destructive database migrations
        timeout-minutes: 2
        run: |
          echo "Running database schema push (non-destructive only)..."
          echo "If this step times out, it means Drizzle detected destructive changes"
          echo "that require interactive confirmation. Run the migration manually:"
          echo "  tdsk db push --env production"
          cd repos/database && pnpm push
        continue-on-error: false

      - name: Record previous image tags
        id: record-previous
        run: |
          PREV_IMAGES="{}"
          for ctx in caddy proxy backend; do
            DEPLOYMENT="tdsk-${ctx}"
            IMG=$(kubectl get deployment "$DEPLOYMENT" -n "${{ env.K8S_NAMESPACE }}" \
              -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null || echo "unknown")
            PREV_IMAGES=$(echo "$PREV_IMAGES" | jq --arg k "$ctx" --arg v "$IMG" '. + {($k): $v}')
          done
          echo "previous_images=$(echo "$PREV_IMAGES" | jq -c .)" >> "$GITHUB_OUTPUT"
          echo "Previous images: $PREV_IMAGES"

      - name: Deploy via tdsk
        run: |
          echo "Deploying with image tag: sha-${{ steps.sha.outputs.short_sha }}"
          cd repos/cli && pnpm cli deploy apply --env production

      - name: Restart rebuilt pods
        run: |
          CONTEXTS='${{ needs.detect-changes.outputs.contexts }}'
          if [ "$CONTEXTS" = "[]" ] || [ -z "$CONTEXTS" ]; then
            echo "No images rebuilt — restarting all service pods for config changes"
            cd repos/cli
            pnpm cli kube remove --context proxy --env production
            pnpm cli kube remove --context backend --env production
            pnpm cli kube remove --context caddy --env production
          else
            echo "Restarting pods for rebuilt contexts: $CONTEXTS"
            cd repos/cli
            for ctx in $(echo "$CONTEXTS" | jq -r '.[]'); do
              echo "Restarting $ctx..."
              pnpm cli kube remove --context "$ctx" --env production
            done
          fi
```

**Notes:**
- The `if: always() && ...` pattern allows this job to run even if `build-images` was skipped (deploy-only scenario), while still requiring that any job that DID run succeeded.
- `TDSK_IMAGE_TAG` is set to `sha-<SHORT_SHA>` in the assembled values YAML. The CLI config destructures it as the default for `TDSK_PX_IMAGE_TAG`, `TDSK_BE_IMAGE_TAG`, and `TDSK_CADDY_IMAGE_TAG` (see `repos/cli/configs/cli.config.ts:32-55`). DevSpace's production profile reads these env vars for image references.
- The migration step uses `timeout-minutes: 2` because `drizzle-kit push` is interactive — in CI without a TTY, it will hang if it needs confirmation for destructive changes. The timeout acts as the "strict" gate: non-destructive changes apply automatically, destructive changes cause a timeout failure.
- `record-previous` captures current image tags from the live deployments for rollback. Only checks caddy/proxy/backend (the 3 deployed services — sandbox is not a deployment, it's spawned dynamically).
- `pnpm cli` is the local CLI invocation pattern from `repos/cli/`.

- [ ] **Step 2: Validate YAML syntax**

Run: `cat .github/workflows/deploy-production.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

Output message: `feat(ci): add deploy job with secrets assembly, migrations, and SHA-tagged images`

---

### Task 6: Verify and Rollback Job

**Files:**
- Modify: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Add the verify job after deploy**

Append after the `deploy` job:

```yaml
  verify:
    name: Verify & Rollback
    runs-on: ubuntu-latest
    needs: [detect-changes, deploy]
    if: always() && needs.deploy.result == 'success'
    env:
      NODE_ENV: production
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Civo CLI
        run: |
          curl -sL https://civo.com/get | sh
          sudo mv /tmp/civo /usr/local/bin/civo
          civo apikey save deploy-key "${{ secrets.CIVO_TOKEN }}"
          civo region use "${{ env.CIVO_REGION }}"

      - name: Fetch kubeconfig
        run: |
          civo kubernetes config "${{ env.CIVO_CLUSTER }}" --save --merge
          kubectl config use-context "${{ env.CIVO_CLUSTER }}"

      - name: Wait for pods to stabilize
        timeout-minutes: 3
        run: |
          echo "Waiting for all pods in ${{ env.K8S_NAMESPACE }} to be ready..."
          for deployment in tdsk-caddy tdsk-proxy tdsk-backend; do
            echo "Waiting for $deployment..."
            kubectl rollout status deployment/"$deployment" \
              -n "${{ env.K8S_NAMESPACE }}" \
              --timeout=120s
          done
          echo "All deployments ready."

      - name: Health check — Proxy
        id: health-proxy
        run: |
          echo "Checking proxy health..."
          curl -sf --retry 5 --retry-delay 10 --retry-all-errors \
            https://px.threadedstack.app/health
          echo "Proxy health: OK"

      - name: Health check — Backend
        id: health-backend
        run: |
          echo "Checking backend health..."
          HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --retry 5 --retry-delay 10 --retry-all-errors \
            https://px.threadedstack.app/_/health)
          echo "Backend response code: $HTTP_CODE"
          # Backend /_/health returns 401 (auth required) when reachable — that's success
          if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 401 ]; then
            echo "Backend health: OK (HTTP $HTTP_CODE)"
          else
            echo "Backend health: FAILED (HTTP $HTTP_CODE)"
            exit 1
          fi

      - name: Rollback — Capture failure logs
        if: failure()
        run: |
          echo "=== DEPLOYMENT VERIFICATION FAILED ==="
          echo ""
          echo "=== Pod Status ==="
          kubectl get pods -n "${{ env.K8S_NAMESPACE }}" -o wide
          echo ""
          echo "=== Caddy Logs (last 50 lines) ==="
          kubectl logs deployment/tdsk-caddy -n "${{ env.K8S_NAMESPACE }}" --tail=50 || true
          echo ""
          echo "=== Proxy Logs (last 50 lines) ==="
          kubectl logs deployment/tdsk-proxy -n "${{ env.K8S_NAMESPACE }}" --tail=50 || true
          echo ""
          echo "=== Backend Logs (last 50 lines) ==="
          kubectl logs deployment/tdsk-backend -n "${{ env.K8S_NAMESPACE }}" --tail=50 || true

      - name: Rollback — Restore previous images
        if: failure()
        run: |
          echo "=== ROLLING BACK ==="
          PREV='${{ needs.deploy.outputs.previous_images }}'
          echo "Previous images: $PREV"

          if [ "$PREV" = "{}" ] || [ -z "$PREV" ]; then
            echo "No previous image data available — cannot rollback automatically"
            echo "Manual intervention required."
            exit 1
          fi

          for ctx in caddy proxy backend; do
            PREV_IMG=$(echo "$PREV" | jq -r ".${ctx}")
            if [ "$PREV_IMG" != "null" ] && [ "$PREV_IMG" != "unknown" ]; then
              DEPLOYMENT="tdsk-${ctx}"
              echo "Rolling back $DEPLOYMENT to $PREV_IMG..."
              kubectl set image deployment/"$DEPLOYMENT" \
                "$DEPLOYMENT=$PREV_IMG" \
                -n "${{ env.K8S_NAMESPACE }}"
            fi
          done

          echo "Waiting for rollback to complete..."
          for deployment in tdsk-caddy tdsk-proxy tdsk-backend; do
            kubectl rollout status deployment/"$deployment" \
              -n "${{ env.K8S_NAMESPACE }}" \
              --timeout=120s || true
          done

      - name: Rollback — Verify recovery
        if: failure()
        run: |
          echo "Verifying rollback health..."
          sleep 10

          PROXY_OK=false
          for i in 1 2 3 4 5; do
            if curl -sf --max-time 10 https://px.threadedstack.app/health; then
              PROXY_OK=true
              break
            fi
            sleep 10
          done

          if [ "$PROXY_OK" = "true" ]; then
            echo "Rollback successful — services recovered"
          else
            echo "CRITICAL: Rollback failed — services still unhealthy"
            echo "Manual intervention required immediately"
          fi

          # Always fail the workflow even if rollback succeeded
          echo ""
          echo "Workflow marked as FAILED because the original deployment did not pass health checks."
          echo "The rollback restored the previous version, but the underlying issue must be investigated."
          exit 1
```

**Notes:**
- Backend `/_/health` returns HTTP 401 (auth required) when the full chain is working — this is expected and counts as healthy. A 5xx or timeout means the backend is actually down.
- Rollback uses `kubectl set image` to directly patch the deployment with the previous image tag — faster than re-running the full DevSpace deploy pipeline.
- The `if: failure()` steps only run when a prior step in this job failed (health checks).
- The final `exit 1` ensures the workflow always fails if rollback was triggered, even if services recovered.
- Rollback does NOT revert database migrations — additive schema changes are backwards-compatible.
- If no previous image data is available (first deploy), rollback fails with a clear message.

- [ ] **Step 2: Validate YAML syntax**

Run: `cat .github/workflows/deploy-production.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"`
Expected: No output (valid YAML)

- [ ] **Step 3: Commit**

Output message: `feat(ci): add verify and rollback job with health checks`

---

### Task 7: Validate Complete Workflow

**Files:**
- Read: `.github/workflows/deploy-production.yml`

- [ ] **Step 1: Install actionlint**

Run: `brew install actionlint` (macOS) or download from https://github.com/rhysd/actionlint/releases

- [ ] **Step 2: Run actionlint**

Run: `actionlint .github/workflows/deploy-production.yml`
Expected: No errors. Warnings about expression injection in `${{ secrets.* }}` are acceptable (the values are written to a file, not used in shell interpolation unsafely).

- [ ] **Step 3: Validate the full YAML structure**

Run: `cat .github/workflows/deploy-production.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin)"`
Expected: No output (valid YAML)

- [ ] **Step 4: Verify job dependency graph**

Manually verify that the `needs:` fields form the correct DAG:
- `detect-changes`: no dependencies
- `test`: needs `detect-changes`
- `build-images`: needs `detect-changes`, `test`
- `deploy`: needs `detect-changes`, `test`, `build-images`
- `verify`: needs `detect-changes`, `deploy`

- [ ] **Step 5: Verify conditional logic**

Check these scenarios against the workflow:
1. **Push with proxy changes** → detect-changes outputs `["proxy"]` → test runs → build-images builds proxy only → deploy → verify
2. **Push with only deploy/values changes** → detect-changes outputs `[]` + `deploy_only=true` → test runs → build-images skipped → deploy (config only) → verify
3. **Manual dispatch with backend + sandbox checked** → detect-changes outputs `["backend", "sandbox"]` → test runs → build-images builds both → deploy → verify
4. **Manual dispatch with deploy_only checked** → detect-changes outputs `[]` + `deploy_only=true` → test skipped → build-images skipped → deploy → verify
5. **Test failure** → detect-changes → test FAILS → build-images skipped → deploy skipped → verify skipped

- [ ] **Step 6: Commit**

Output message: `feat(ci): validate deploy-production workflow`

---

### Task 8: Document GitHub Secrets Setup

**Files:**
- Modify: `docs/meta/prod-deploy.md`

- [ ] **Step 1: Add CI/CD section to the prod-deploy doc**

Append to the end of `docs/meta/prod-deploy.md`:

```markdown
---

## 3. CI/CD Automated Deployment

The GitHub Actions workflow (`.github/workflows/deploy-production.yml`) automates deployments when changes are merged to the `production` branch.

### 3.1 Required GitHub Secrets

Add these secrets to the repository settings (Settings → Secrets and variables → Actions):

**Infrastructure:**
- `CIVO_TOKEN` — Civo API token ([console.civo.com/security](https://console.civo.com/security))

**Master Key:**
- `TDSK_MASTER_KEY` — from `~/.config/tdsk/values.yaml` → `TDSK_MASTER_KEY`

**Database (Neon):**
- `TDSK_DB_URL` — Neon connection string
- `TDSK_DB_USER` — Database user
- `TDSK_DB_PASS` — Database password
- `TDSK_DB_AUTH_URL` — Neon auth connection string
- `TDSK_DB_JWT_SCRT` — JWT signing secret
- `TDSK_DB_SRV_ROLE` — Service role token
- `TDSK_DB_PUBLIC_KEY` — DB public key
- `TDSK_DB_PROJECT_ID` — Neon project ID

**Payments:**
- `TDSK_PAY_ACCESS_TOKEN` — Stripe secret key
- `TDSK_PAY_WEBHOOK_SECRET` — Stripe webhook signing secret

**Email:**
- `TDSK_EMAIL_API_KEY` — Email provider API key

**Egress Proxy:**
- `TDSK_EGRESS_CA_CERT` — CA certificate (base64-encode the file content: `base64 < ~/.config/tdsk/domain/egress.cert`)
- `TDSK_EGRESS_CA_KEY` — CA private key (base64-encode the file content: `base64 < ~/.config/tdsk/domain/egress.key`)

**Docker (K8s imagePullSecrets):**
- `TDSK_DOCKER_USER` — GHCR username (your GitHub username)
- `TDSK_DOCKER_TOKEN` — GHCR personal access token (with `read:packages` scope)

### 3.2 Manual Dispatch

Trigger a deployment manually from the GitHub UI:
1. Go to **Actions** → **Deploy Production**
2. Click **Run workflow**
3. Select which images to build (or check "deploy_only" to redeploy without building)
4. Click **Run workflow**

### 3.3 Automatic Deployment

Every merge to the `production` branch triggers the workflow automatically. Only changed images are rebuilt — the workflow detects which files changed and maps them to image contexts.

### 3.4 Rollback

If health checks fail after deployment, the workflow automatically rolls back to the previously running image tags. The workflow will show as failed even if rollback succeeds — investigate the root cause before re-deploying.

Database migrations are NOT rolled back. Only non-destructive (additive) migrations run in CI, so the previous code version remains compatible with the new schema.
```

- [ ] **Step 2: Commit**

Output message: `docs: add CI/CD secrets setup and automated deployment guide`
