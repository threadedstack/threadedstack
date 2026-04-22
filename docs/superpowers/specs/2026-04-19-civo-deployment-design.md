# Civo Kubernetes Deployment — Design Spec

**Date**: 2026-04-19
**Scope**: Deploy API services (Caddy, Proxy, Backend) and sandbox pods to Civo K8s. No frontend SPAs. No KubeVirt migration (deferred to follow-up).

## Context

ThreadedStack runs locally on docker-desktop K8s via DevSpace. The goal is to deploy the same services to a Civo managed K8s cluster for production use. The existing Helm chart, Docker images, and `tdsk kube secret` commands are already provider-agnostic — the work is primarily configuration and a new deployment CLI command.

KubeVirt will be installed on the Civo cluster for future VM-based sandbox isolation, but sandboxes will initially run as standard K8s pods (same as local dev).

## What Changes

### 1. `values.production.yaml` — Expand Production Configuration

Currently only 3 lines. Needs full production settings:

```yaml
env:
  NODE_ENV: production
  TDSK_KUBE_NAMESPACE: tdsk-production
  TDSK_CADDY_PX_HOST: px.threadedstack.app
  TDSK_CADDY_TLS_MODE: on_demand
  TDSK_CADDY_ACME_EMAIL: admin@threadedstack.com
  TDSK_LOG_LEVEL: info
  TDSK_LOG_PRETTY_PRINT: false
  TDSK_PX_LOGGER_PRETTY: 0
  TDSK_BE_LOGGER_PRETTY: 0
  TDSK_SERVER_ORIGINS: 'threadedstack.app,px.threadedstack.app,sandbox.threadedstack.app,admin.threadedstack.app,threads.threadedstack.app'
```

Key changes from local:
- `TDSK_CADDY_TLS_MODE`: `internal` → `on_demand` (Let's Encrypt via Caddy)
- `TDSK_CADDY_PX_HOST`: `px.local.threadedstack.app` → `px.threadedstack.app`
- Log pretty printing disabled (structured JSON for production)
- `TDSK_SERVER_ORIGINS` scoped to production domains only (no `localhost`)

### 2. New `tdsk deploy` CLI Command

A new task group in `repos/cli/src/tasks/deploy/` that wraps `devspace deploy` for production deployment. DevSpace already has a `deploy` pipeline in `devspace.yaml` that creates deployments without starting dev containers (no file sync, no port forwarding). The `tdsk deploy` command adds the production profile and kube context, matching how `tdsk dev start` wraps `devspace dev`.

**Implementation pattern** — follows existing CLI structure:
- `repos/cli/src/tasks/deploy/index.ts` — exports task group
- `repos/cli/src/tasks/deploy/deploy.ts` — parent task definition
- `repos/cli/src/tasks/deploy/apply.ts` — `devspace deploy --env production` wrapper
- `repos/cli/src/tasks/deploy/status.ts` — `kubectl get pods,svc` in namespace
- Register in `repos/cli/src/tasks/index.ts`

**Example usage:**
```bash
# Deploy all services to production
# Uses (`TDSK_KUBE_CONTEXT` and `TDSK_KUBE_NAMESPACE` envs in values.production.yaml)
tdsk deploy apply --env production
# Or override context and namespace with arguments
tdsk deploy apply --env production --namespace tdsk-production --kube-context tdsk

# Check deployment status
tdsk deploy status --env production
# Or override context and namespace with arguments
tdsk deploy status --env production --namespace tdsk-production

# Render templates without applying (dry-run)
tdsk deploy apply --env production --dry-run
```

### 3. DevSpace Production Profile

The `production` profile in `devspace.yaml` is currently empty. Fill it with production-specific patches:

```yaml
- name: production
  patches:
    # Use production image tags
    - op: replace
      path: deployments.tdsk-caddy.helm.values.containers[0].image
      value: ghcr.io/threadedstack/tdsk-caddy:${TDSK_CADDY_IMAGE_TAG}
    - op: replace
      path: deployments.tdsk-proxy.helm.values.containers[0].image
      value: ghcr.io/threadedstack/tdsk-proxy:${TDSK_PX_IMAGE_TAG}
    - op: replace
      path: deployments.tdsk-backend.helm.values.containers[0].image
      value: ghcr.io/threadedstack/tdsk-backend:${TDSK_BE_IMAGE_TAG}
```

The `tdsk deploy` command becomes:
```bash
# Namespace and context resolved from `TDSK_KUBE_CONTEXT` and `TDSK_KUBE_NAMESPACE` envs in values.production.yaml
devspace deploy --env production
```

This reuses all existing DevSpace deployment definitions, hooks (Caddyfile ConfigMap), and secret references without duplicating them.

### 4. Docker Image Builds

Images need to be built for `linux/amd64` (Civo nodes) and pushed to ghcr.io. The existing `tdsk doc build` command already supports multi-platform builds.

**Images to build and push:**
```bash
tdsk doc build -c caddy --push
tdsk doc build -c proxy --push
tdsk doc build -c backend --push
tdsk doc build -c sandbox --push
```

The `--push` flag pushes to `ghcr.io/threadedstack/`. Images are already multi-platform via `docker buildx`.

### 5. K8s Secrets on Civo Cluster

All existing `tdsk kube secret` commands work against whatever cluster `kubectl` is pointed at. No changes needed — just run them against the Civo context.

**Required secrets:**
| Secret | Command | Source |
|--------|---------|--------|
| `tdsk-db-cfg` | `tdsk kube secret database` | Neon DB credentials from `~/.config/tdsk/values.yaml` |
| `tdsk-master-key` | `tdsk kube secret tdsk` | Master key for service tokens |
| `docker-auth` | `tdsk kube secret docker` | ghcr.io image pull credentials |
| `tdsk-payments-secret` | `tdsk kube secret payments` | Stripe/Polar config |
| `tdsk-email-secret` | `tdsk kube secret email` | Email provider config |
| `tdsk-egress-ca` | `tdsk kube secret egress` | MITM proxy CA cert for sandbox egress |

### 6. DNS Configuration

Point these DNS records at the Civo LoadBalancer external IP:

| Record | Type | Target |
|--------|------|--------|
| `px.threadedstack.app` | A | Civo LB IP |
| `*.sandbox.threadedstack.app` | A | Civo LB IP |

The LB IP is assigned automatically when Caddy's `LoadBalancer` service is created. Get it with:
```bash
kubectl get svc tdsk-caddy -n tdsk-production -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

Caddy handles TLS for both domains via on-demand Let's Encrypt certificates stored in Neon PostgreSQL.

### 7. KubeVirt Operator Install (Future Use)

Install KubeVirt on the Civo cluster so it's ready for the follow-up VMI migration:

```bash
export RELEASE=$(curl -s https://storage.googleapis.com/kubevirt-prow/release/kubevirt/kubevirt/stable.txt)
kubectl apply -f https://github.com/kubevirt/kubevirt/releases/download/${RELEASE}/kubevirt-operator.yaml
kubectl apply -f https://github.com/kubevirt/kubevirt/releases/download/${RELEASE}/kubevirt-cr.yaml
kubectl -n kubevirt wait kv kubevirt --for condition=Available --timeout=300s
```

No code changes — just operator presence on the cluster for when we implement the VMI backend.

### 8. RBAC — No Changes

The existing service account (`tdsk-backend-sa`) with role `tdsk-sandbox-manager` already has the permissions needed for pod-based sandboxes: `create`, `delete`, `get`, `list`, `watch` on `pods` and `pods/exec`. This is defined in `devspace.yaml` and applied automatically during deployment.


## Civo Cluster Setup (Manual)

### Prerequisites
- Civo account with API token
- `civo` CLI installed (`brew tap civo/tools && brew install civo`)
- `kubectl`, `helm`, `devspace` installed

### Cluster Creation
```bash
civo apikey save threadedstack <API_TOKEN>
civo kubernetes create threadedstack \
  --region NYC1 \
  --cni-plugin cilium \
  --nodes 3 \
  --size g4s.kube.medium \
  --wait
civo kubernetes config threadedstack --save --merge
kubectl config use-context threadedstack
```


### Namespace Setup
```bash
kubectl create namespace tdsk-production
kubectl config set-context --current --namespace=tdsk-production
```

## Deployment Sequence

```
1. Create Civo K8s cluster (Cilium, 3 nodes)
2. Install KubeVirt operator
3. Create namespace: tdsk-production
4. Create secrets: tdsk kube secret database/docker/payments/email/egress/tdsk
5. Build + push images: tdsk doc build caddy/proxy/backend/sandbox --push
6. Deploy: tdsk deploy apply --env production
7. Get LB IP: kubectl get svc tdsk-caddy
8. Point DNS: px.threadedstack.app + *.sandbox.threadedstack.app → LB IP
9. Verify: curl https://px.threadedstack.app/health
10. Verify: curl https://px.threadedstack.app/_/health
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `deploy/values.production.yaml` | Modify | Expand with full production config |
| `deploy/devspace.yaml` | Modify | Fill production profile with image patches |
| `repos/cli/src/tasks/deploy/index.ts` | Create | Deploy task group exports |
| `repos/cli/src/tasks/deploy/deploy.ts` | Create | Parent deploy task definition |
| `repos/cli/src/tasks/deploy/apply.ts` | Create | `devspace deploy --profile production` wrapper |
| `repos/cli/src/tasks/deploy/status.ts` | Create | `kubectl get pods,svc` status check |
| `repos/cli/src/utils/deploy/deploy.ts` | Create | `spawn({ cmd: 'devspace', ... })` wrapper for deploy commands |
| `repos/cli/src/tasks/index.ts` | Modify | Register deploy task group |

## Verification

1. **Health checks**: `curl -sf https://px.threadedstack.app/health` (proxy) and `curl -sf https://px.threadedstack.app/_/health` (backend)
2. **TLS**: `curl -vI https://px.threadedstack.app/health 2>&1 | grep "issuer"` — should show Let's Encrypt
3. **Auth**: `curl -s -H "Authorization: Bearer tdsk_<key>" https://px.threadedstack.app/_/orgs` — should return org data
4. **Sandbox lifecycle**: `POST /_/sandboxes/:id/connect` → pod created, SSH accessible, shell WebSocket works
5. **Sandbox egress**: sandbox pod outbound traffic routes through backend egress proxy
6. **KubeVirt**: `kubectl get kubevirt -n kubevirt` — operator installed and available (not used yet)

## Future: KubeVirt VMI Migration (Separate Spec)

After production is stable with pod-based sandboxes:
1. `IComputeBackend` interface with `PodBackend` / `VmiBackend` implementations
2. `vmiManifest.ts` with cloud-init for VM initialization
3. `SshSandbox` ISandbox implementation (replaces K8s Exec with SSH for VMIs)
4. RBAC additions for `kubevirt.io` API group
5. `TDSK_SANDBOX_BACKEND=vmi` env var to switch
