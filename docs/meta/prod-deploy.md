# Production Deployment

This guide covers deploying ThreadedStack services (Caddy, Proxy, Backend) to a remote Kubernetes cluster. It assumes you have a working local dev environment and the `tdsk` CLI installed.

## Prerequisites

- `kubectl`, `helm`, `devspace` CLI tools installed
- Docker authenticated with `ghcr.io` (`docker login ghcr.io`)
- Kubernetes cluster created and kubeconfig merged locally
- `~/.config/tdsk/values.yaml` populated with secrets (DB creds, master key, Stripe keys, etc.)

## 1. Deploy From Scratch

### 1.1 Cluster Setup

Create your cluster (example uses Civo, but any K8s provider works):

```sh
civo kubernetes create threadedstack \
  --region NYC1 \
  --cni-plugin cilium \
  --nodes 3 \
  --size g4s.kube.medium \
  --wait

# Merge kubeconfig and set context
civo kubernetes config threadedstack --save --merge
kubectl config use-context threadedstack
```

### 1.2 Create Namespace

```sh
kubectl create namespace tdsk-production
```

### 1.3 Create Kubernetes Secrets

All secrets are created via the `tdsk` CLI. The `--env prod` flag targets the production namespace and context defined in `deploy/values.production.yaml`.

```sh
tdsk kube secret tdsk --env prod         # Master encryption key
tdsk kube secret database --env prod     # Neon DB credentials
tdsk kube secret docker --env prod       # ghcr.io image pull credentials (creates both generic + docker-registry secrets)
tdsk kube secret payments --env prod     # Stripe configuration
tdsk kube secret email --env prod        # Email provider configuration
tdsk kube secret egress --env prod       # Egress proxy CA certificate
```

Verify secrets were created:

```sh
tdsk kube secret list --env production
```

### 1.4 Initialize Database

Push the Drizzle schema to create all tables, then add deferred FK constraints. See [Database Operations](database-operations.md) for full details.

```sh
tdsk db push --env production          # Create tables (interactive)
tdsk db constraints --env production   # Add deferred FK constraints
```

### 1.5 Build and Push Docker Images

Build multi-platform images (`linux/amd64` + `linux/arm64`) and push to `ghcr.io`:

```sh
tdsk doc build -c caddy --push
tdsk doc build -c proxy --push
tdsk doc build -c backend --push
tdsk doc build -c sandbox --push
```

### 1.6 Deploy Services

```sh
tdsk deploy apply --env production
```

This runs `devspace deploy` with the production profile, which:
- Creates Helm releases for Caddy, Proxy, and Backend
- Applies the Caddyfile as a ConfigMap (via `before:deploy` hook)
- Sets `imagePullPolicy: Always` and attaches `imagePullSecrets`
- Creates the `tdsk-backend-sa` service account with sandbox RBAC

### 1.7 Verify Pods Are Running

```sh
tdsk deploy status --env production
```

All three pods (`tdsk-caddy`, `tdsk-proxy`, `tdsk-backend`) should show `Running` with `1/1` ready.

### 1.8 Configure DNS

Get the LoadBalancer external address:

```sh
tdsk deploy status --env production
```

The `EXTERNAL-IP` column on the `tdsk-caddy` service shows the LB address. It may be an IP or a hostname depending on the provider.

Create DNS records pointing to the LB:

| Record | Type | Target |
|--------|------|--------|
| `px.threadedstack.app` | CNAME or A | LB address |
| `*.sandbox.threadedstack.app` | CNAME or A | LB address |
| `be.threadedstack.app` | CNAME or A | LB address |

> **Note:** If the LB returns a hostname (e.g. Civo), use CNAME records. If it returns an IP, use A records. Wildcard CNAME records (`*.sandbox`) require the DNS provider to support them.

### 1.9 Verify TLS and Connectivity

Wait for DNS propagation, then verify:

```sh
# Proxy health (tests Caddy TLS + Proxy)
curl -sf https://px.threadedstack.app/health
# Expected: {"status":"ok","service":"auth-proxy",...}

# Backend health (tests full chain: Caddy → Proxy → Backend)
curl -sf https://px.threadedstack.app/_/health
# Expected: 401 (auth required — means backend is reachable)

# Verify Let's Encrypt cert
curl -vI https://px.threadedstack.app/health 2>&1 | grep "issuer"
# Expected: issuer: C=US; O=Let's Encrypt; CN=E7
```

Caddy provisions TLS certificates automatically via Let's Encrypt on first request. The proxy's `TDSK_PX_SYSTEM_DOMAINS` env var allows all `*.threadedstack.app`, `*.threadedstack.com`, and `*.threadedstack.dev` subdomains without a database lookup. Custom user domains are validated against the `domains` table.

### 1.10 Verify Auth

```sh
curl -s -H "Authorization: Bearer tdsk_<your-api-key>" https://px.threadedstack.app/_/orgs
# Expected: JSON array of organizations
```

---

## 2. Deploy Updates

For deploying code changes to an existing cluster.

### 2.1 Rebuild Changed Images

Only rebuild the images for services you changed:

```sh
# Examples — only run the ones you need
tdsk doc build -c proxy --push      # Proxy changes
tdsk doc build -c backend --push    # Backend changes
tdsk doc build -c caddy --push      # Caddy/Caddyfile changes
tdsk doc build -c sandbox --push    # Sandbox image changes
tdsk doc build -c init --push       # Init image changes
```

### 2.2 Push Database Schema Changes (if needed)

If any database schema files changed (`repos/database/src/schema/`), push the updated schema before deploying the new backend image:

```sh
tdsk db push --env production
```

This is interactive — Drizzle will show the pending changes and prompt for confirmation if any are destructive (e.g. dropping columns or tables). Additive changes (new tables, new columns with defaults) apply without confirmation.

> **Tip:** Always push schema changes _before_ deploying the backend. The new backend code expects the updated schema, so deploying first can cause runtime errors.

### 2.3 Deploy

```sh
tdsk deploy apply --env production
```

### 2.4 Restart Pods (if needed)

If the deployment spec didn't change (e.g. same image tag `latest`), K8s may not roll the pods. Force a restart by deleting the old pods — K8s will automatically create new ones that pull the latest image (production profile sets `imagePullPolicy: Always`).

```sh
# Restart a specific service
tdsk kube remove --context proxy --env production
tdsk kube remove --context caddy --env production
tdsk kube remove --context backend --env production
```

### 2.5 Verify

```sh
# Check all pods are running
tdsk deploy status --env production

# Test health endpoints
curl -sf https://px.threadedstack.app/health
curl -sf https://px.threadedstack.app/_/health
```

### 2.6 Dry Run (Optional)

Preview what will be deployed without applying:

```sh
tdsk deploy apply --env production --dry-run
```

---

## Troubleshooting

### Pods stuck in `ErrImagePull` / `ImagePullBackOff`

The `docker-auth-pull` image pull secret is missing or incorrect. Recreate it:

```sh
tdsk kube secret docker --env prod
```

### TLS handshake failure (`tlsv1 alert internal error`)

Caddy can't provision a certificate. Common causes:
- **Proxy pod not running** — Caddy validates domains via `http://tdsk-proxy:7118/domains/validate`. If the proxy is down, validation fails and no cert is issued.
- **Domain not in system domains** — Check `TDSK_PX_SYSTEM_DOMAINS` in `values.production.yaml` includes the base domain.
- **DNS not propagated** — Let's Encrypt needs to reach the domain. Verify with `nslookup <domain>`.

### Checking service logs

```sh
# Recent logs (default: last 50 lines)
tdsk kube logs --context proxy --env production
tdsk kube logs --context backend --env production
tdsk kube logs --context caddy --env production

# Stream logs in real time
tdsk kube logs --context proxy --env production --follow

# Logs from a crashed container (previous instance)
tdsk kube logs --context backend --env production --previous

# Control number of lines
tdsk kube logs --context backend --env production --tail 100
```

### Stale images after rebuild

If pods are running old code after a rebuild + deploy, the node has a cached image. Restart the pod to force a re-pull:

```sh
tdsk kube remove --context proxy --env production
```

### Secrets verification

```sh
# List all application secrets (excludes helm internals)
tdsk kube secret list --env production

# Include helm release secrets
tdsk kube secret list --env production --all
```

---

## Reference

### Services and Ports

| Service | K8s Type | Ports | Purpose |
|---------|----------|-------|---------|
| `tdsk-caddy` | LoadBalancer | 443 (TLS), 8080 (HTTP) | TLS termination, on-demand Let's Encrypt certs |
| `tdsk-proxy` | ClusterIP | 7118 | JWT/API key auth, request routing |
| `tdsk-backend` | ClusterIP | 5885, 8889 | API server, egress proxy |

### Request Flow

```
Client → Caddy (:443, TLS + PROXY v2) → Proxy (:7118, Auth) → Backend (:5885, API)
```

### Configuration Files

| File | Purpose |
|------|---------|
| `deploy/values.yaml` | Base env vars (all environments) |
| `deploy/values.production.yaml` | Production env overrides |
| `~/.config/tdsk/values.yaml` | Local secrets (DB creds, API keys) — never committed |
| `deploy/Caddyfile` | Caddy config (TLS, reverse proxy, CORS) |
| `deploy/devspace.yaml` | DevSpace pipelines, Helm charts, production profile |

### CLI Quick Reference

```sh
# Deploy
tdsk deploy apply --env production            # Deploy services
tdsk deploy apply --env production --dry-run   # Preview without applying
tdsk deploy status --env production            # Pod and service status

# Docker images
tdsk doc build -c <context> --push            # Build + push (caddy|proxy|backend|sandbox)

# Secrets
tdsk kube secret <preset> --env prod          # Create secret (tdsk|database|docker|payments|email|egress)
tdsk kube secret list --env production        # List secrets in namespace

# Pod management
tdsk kube remove --context <ctx> --env production   # Restart pod (proxy|backend|caddy)
tdsk kube logs --context <ctx> --env production     # View logs
tdsk kube logs --context <ctx> --env production -f  # Stream logs
tdsk kube pod --context <ctx> --env production      # Describe pod
```

---

## 3. CI/CD Automated Deployment

The GitHub Actions workflow (`.github/workflows/deploy-production.yml`) automates deployments when changes are merged to the `production` branch.

### 3.1 Required GitHub Secrets

Add these secrets to the repository settings (Settings → Secrets and variables → Actions):

**Infrastructure:**
- `TDSK_CIVO_TOKEN` — Civo API token ([console.civo.com/security](https://console.civo.com/security))

**Master Key:**
- `TDSK_MASTER_KEY` — from `~/.config/tdsk/values.yaml` → `TDSK_MASTER_KEY`

**Database (Neon):**
- `TDSK_DB_URL` — Neon connection string
- `TDSK_DB_USER` — Database user
- `TDSK_DB_PASS` — Database password
- `TDSK_DB_AUTH_URL` — Neon auth connection string
- `TDSK_DB_JWT_SCRT` — Neon JWT secret
- `TDSK_DB_SRV_ROLE` — Neon service role
- `TDSK_DB_PUBLIC_KEY` — Neon public key
- `TDSK_DB_PROJECT_ID` — Neon project ID

**Payments:**
- `TDSK_PAY_ACCESS_TOKEN` — Stripe secret key
- `TDSK_PAY_WEBHOOK_SECRET` — Stripe webhook signing secret

**Email:**
- `TDSK_EMAIL_API_KEY` — Email provider API key

**Egress Proxy:**
- `TDSK_EGRESS_CA_CERT` — CA certificate (base64-encode the file content: `base64 < ~/.config/tdsk/domain/egress.cert`)
- `TDSK_EGRESS_CA_KEY` — CA private key (base64-encode the file content: `base64 < ~/.config/tdsk/domain/egress.key`)

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
