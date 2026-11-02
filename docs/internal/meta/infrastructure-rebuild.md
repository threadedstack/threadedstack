# Infrastructure Rebuild Reference

Everything needed to stand Threaded Stack back up on a new Kubernetes cluster and a new Postgres + auth provider, captured from the live Civo cluster and Neon project on 2026-11-02 before both accounts were decommissioned. Application code, Helm/devspace config and images are already reproducible from the repo; this page covers what was only in the providers.

Use it together with [Production Deployment](prod-deploy.md) (step-by-step deploy) and [Database Operations](database-operations.md) (schema/seed commands).

## Captured Artifacts

| Path | Contents |
|---|---|
| `deploy/infra/kata/kata-clh-installer.yaml` | Kata Containers + Cloud Hypervisor installer (namespace `kata-system`, RuntimeClass `kata-clh`). Byte-identical to the live installer script. Upstream copy: `github.com/threadedstack/kata-civo`. |
| `deploy/infra/kata/kata-clh-smoke.yaml` | One-shot pod that proves VM isolation after install |
| `deploy/infra/kata/kata-civo-probe.yaml` | DaemonSet that probes a node for KVM / CLH capability |
| `deploy/infra/cilium/values.yaml` | Cilium 1.18.4 Helm values used on the cluster |
| `deploy/infra/secrets.template.yaml` | Every secret key name, which K8s secret consumes it, and which are prod-required |
| `deploy/infra/stripe.yaml` | Stripe product / price / seat-price ids (prod + dev) and `TDSK_PAY_PLANS` |
| `deploy/infra/postgres/schema.snapshot.sql` | Schema-only dump of the prod database (public + neon_auth), reference only |
| `deploy/infra/postgres/00-extensions.sql` | `CREATE EXTENSION vector` |
| `deploy/infra/postgres/01-neon_auth.sql` | `neon_auth` schema DDL, needed only when NOT using Neon Auth |
| `deploy/infra/postgres/02-egress-role.sql` | `tdsk_egress_ro` role + grants for the egress service |
| `deploy/infra/postgres/config-rows.json` | Config rows that existed only in the DB (7 providers, 6 org secret names, 1 agent-authored function) |

## Kubernetes Cluster

### Live layout (Civo, region NYC1)

| Item | Value |
|---|---|
| Distribution | k3s `v1.34.2+k3s1`, Alpine Linux 3.22 nodes (OpenRC) |
| CNI | Cilium 1.18.4, `kubeProxyReplacement: true` (values in `deploy/infra/cilium/values.yaml`) |
| Node size | `g4p.kube.small` (4 vCPU, 16 GB RAM, 60 GB disk) for every node |
| Pool `tdskembed` | 1 node. Backend, proxy, caddy, egress (pinned via `kubernetes.civo.com/civo-node-pool: tdskembed` in `deploy/devspace.yaml`) |
| Pool `tdsksandbox` | 2 nodes. Sandbox pods (`TDSK_SB_NODE_POOL=tdsksandbox`) and embeddings |
| Marketplace apps | `metrics-server`, `traefik2-nodeport` (traefik is unused; Caddy is the ingress) |
| Storage | Default CSI storage class (`civo-volume`); one 10 GB PVC for the embeddings model cache (re-downloads on start) |
| Load balancer | Created by the `tdsk-caddy` Service (type LoadBalancer, ports 443 + 8080) |
| Firewall | Ingress TCP 80, 443, 6443 from anywhere; all egress |

Everything in namespace `tdsk-production` (deployments, services, embeddings StatefulSet, `sandbox-egress-policy` NetworkPolicy, egress and sandbox-manager roles, service accounts, Caddy ConfigMap) is produced by `deploy/devspace.yaml` + `deploy/templates/`, and its secrets by `tdsk kube secret <task>`. Only the namespace itself, Cilium and Kata were applied by hand. The `volay` namespace on the same cluster was an unrelated experiment and is not captured.

### Hard requirements for a new cluster

1. **KVM / nested virtualization on sandbox nodes.** Sandbox pods run under RuntimeClass `kata-clh`, which needs `/dev/kvm` on the host. Nested virt is a property of how the VM is created, so pick a node type that exposes `/dev/kvm`. The Kata installer only labels a node `katacontainers.io/kata-runtime=true` when `/dev/kvm` exists, and the RuntimeClass schedules only onto labeled nodes.
2. **Node pool labels.** `deploy/devspace.yaml`, `deploy/values.yaml` (node-pool mapping) and `deploy/values.production.yaml` (`TDSK_SB_NODE_POOL`, `TDSK_SB_RUNTIME_CLASS`) assume Civo's `kubernetes.civo.com/civo-node-pool` label with pools named `tdskembed` and `tdsksandbox`. On another provider either label nodes with that key or change those selectors.
3. **Load balancer with PROXY protocol v2.** The `tdsk-caddy` Service carries Civo LB annotations (`kubernetes.civo.com/loadbalancer-enable-proxy-protocol: send-proxy-v2`, TCP, 3600s timeouts) in `deploy/devspace.yaml`, and the Caddyfile expects PROXY v2. Use the new provider's equivalent annotation, or remove `proxy_protocol` from the Caddyfile.
4. **Backend and proxy are singletons with `strategy: Recreate`.** Keep it that way: the scheduler and resident watchdog must not run twice.

### Kata install

The stock `kata-deploy` does not work on Alpine/OpenRC nodes (it calls `systemctl`). The vendored installer stages Kata 3.20.0 binaries, patches the shim for gcompat, writes the containerd template, restarts k3s via `rc-service`, then labels the node.

```sh
kubectl apply -f deploy/infra/kata/kata-clh-installer.yaml
kubectl -n kata-system rollout status ds/kata-installer --timeout=15m
kubectl get nodes -L katacontainers.io/kata-runtime
kubectl apply -f deploy/infra/kata/kata-clh-smoke.yaml && kubectl logs kata-smoke   # guest kernel must differ from host
kubectl delete -f deploy/infra/kata/kata-clh-smoke.yaml
```

The installer is k3s-specific (containerd template path, `rc-service k3s restart`). On a non-k3s distribution use upstream `kata-deploy` with the CLH runtime and keep the RuntimeClass name `kata-clh`.

Operational lessons from Civo: never recycle a KVM node (it can come back without nested virt); a wedged node is recovered by rebooting the same VM or restarting k3s in place.

## Postgres

### Live setup (Neon)

| Item | Value |
|---|---|
| Version | PostgreSQL 17.11, database `neondb`, ~122 MB |
| Region | AWS us-east-1 |
| Schemas | `public` (drizzle-managed), `neon_auth` (managed by Neon Auth) |
| Extensions | `vector` 0.8.0, `plpgsql` |
| Roles | `neondb_owner` (app), `tdsk_egress_ro` (egress, SELECT on `public.secrets` only), `neon_auth` (Neon Auth service role) |
| Local dev | Used a second Neon Auth endpoint in the same Neon project, so local dev also needs a new database |

### Fresh database bootstrap

Verified on an empty PostgreSQL 17 with the drizzle migration files standing in for `tdsk db push`. Applying `00-extensions.sql`, `01-neon_auth.sql`, `repos/database/drizzle/0000-0004` and `02-egress-role.sql` reproduced every prod table except the two Caddy tables, which `tdsk db certs` creates (`repos/database/scripts/certs.ts`). Push and the migrations produce the same public schema.

```sh
psql "$DB_URL" -f deploy/infra/postgres/00-extensions.sql
psql "$DB_URL" -f deploy/infra/postgres/01-neon_auth.sql   # skip when the provider is Neon with Neon Auth enabled
tdsk db push --env production                               # or `tdsk release`, which runs pushSafe (vector + additive drizzle push)
tdsk db certs --env production                              # caddy_certmagic_objects + caddy_locks, internal root CA from ~/.config/tdsk/domain/root.{crt,key}
psql "$DB_URL" -f deploy/infra/postgres/02-egress-role.sql  # set the password first, then `tdsk kube secret database-egress`
```

The 15 foreign keys to `neon_auth."user"(id)` mean the drizzle schema cannot be applied until `neon_auth.user` exists. Caddy stores TLS certificates in `public.caddy_certmagic_objects` using `TDSK_DB_AUTH_URL`, so the database must be reachable before Caddy starts. Certificates are re-issued by ACME on the new host, so watch Let's Encrypt rate limits.

### Config rows that lived only in the database

All org, role, agent, schedule, sandbox, collection, skill, endpoint, project and quota rows are produced by `repos/database` seeds and the release reconcile. The exceptions are in `deploy/infra/postgres/config-rows.json`:

- **Providers:** Claude Subscription OAuth, ZAI GLM (fallback), OpenRouter (fallback), Self-Hosted Embeddings (TEI), Gemini Embeddings, ThreadedStack Repo, ThreadedStack Repo (adversary)
- **Org secrets** (names only; re-enter the values): `CLAUDE_CODE_OAUTH_TOKEN`, `ZAI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_EMBED_KEY`, `STEWARD_GIT_PAT`, `ADVERSARY_GIT_PAT` (must be a classic `repo` PAT)
- **Function:** `scoreDesignPartnerCandidates` (agent-authored, full source included)

Secrets are encrypted with `TDSK_MASTER_KEY`. Keep the same master key if any encrypted data is ever restored.

Runtime data was deliberately not captured: users and sessions (`neon_auth.*`), subscriptions, api keys, threads, messages, memories, records, schedule runs and sandbox sessions. No real customers used the deployment.

## Auth (Neon Auth)

Auth is the deepest provider coupling: the proxy validates JWTs against `TDSK_AUTH_JWKS`, and the admin, threads and website SPAs and the TSA CLI use `@neondatabase/neon-js` against `TDSK_AUTH_URL`. Both URLs are per Neon project and are committed in `deploy/values.yaml` (dev) and `deploy/values.production.yaml` (prod), so update them after the new auth endpoint exists. Every existing session and JWT is invalidated by the move, so users must log in again.

Production Neon Auth configuration (from `neon_auth.project_config`):

| Setting | Value |
|---|---|
| Social providers | GitHub (custom OAuth app), Vercel (custom OAuth app), Google (Neon shared app) |
| Email provider | Neon shared email |
| Email + password | enabled, sign-up allowed, OTP verification, verification not required, auto sign-in after verification |
| Organization plugin | enabled; creator role `owner`, membership limit 100, organization limit 10, invitation emails off |
| Webhooks | disabled |
| Allow localhost | true |
| Trusted origins (http and https of each) | `threadedstack.app`, `www.threadedstack.app`, `px.threadedstack.app`, `dev.threadedstack.app`, `threadedstack.com`, `www.threadedstack.com`, `app.threadedstack.com`, `admin.threadedstack.com`, `threads.threadedstack.com`, `admin.local.threadedstack.com`, `threads.local.threadedstack.com`, `px.dev.threadedstack.com`, `sandbox.threadedstack.com`, `sandbox.dev.threadedstack.com` |

Rebuild steps:

1. Create the new auth endpoint (new Neon project with Neon Auth, or another Better Auth-compatible host) and apply the settings above.
2. Update the GitHub and Vercel OAuth apps' callback URLs to the new auth host (client ids/secrets: `TDSK_GH_CLIENT_*`, `TDSK_VER_CLIENT_*`). Google used Neon's shared OAuth app, so a non-Neon host needs its own Google OAuth client (`TDSK_GOOGLE_CLIENT_*`).
3. Set `TDSK_AUTH_URL` and `TDSK_AUTH_JWKS` in `deploy/values*.yaml`, set `TDSK_DB_*` and `TDSK_IT_AUTH_URL` in `~/.config/tdsk/values*.yaml`, then re-run `tdsk kube secret database --env prod`.

## DNS (Porkbun)

Nameservers for `threadedstack.app`, `threadedstack.com` and `threadedstack.dev` are Porkbun (`curitiba` / `fortaleza.ns.porkbun.com`). The Porkbun API keys in `~/.config/tdsk/domain/porkbun*.yaml` are revoked, so this record set was reconstructed from public DNS on 2026-11-02:

| Record | Type | Target | Re-point on rebuild |
|---|---|---|---|
| `px.threadedstack.app` | CNAME | Civo LB hostname (`d595a5fa-...lb.civo.com`, 212.2.241.137) | yes, to the new LB |
| `*.sandbox.threadedstack.app` | CNAME | Civo LB hostname | yes, to the new LB |
| `_acme-challenge.threadedstack.app` | TXT | two ACME DNS-01 tokens (stale) | no |
| `admin.local.threadedstack.app`, `threads.local.threadedstack.app` | A | `127.0.0.1` (local dev) | no |
| `threadedstack.app`, `threadedstack.dev`, `*.threadedstack.app`, `*.threadedstack.dev` | A / CNAME | Porkbun parking (`pixie.porkbun.com`) | no |
| `threadedstack.com` | A | `199.36.158.100` (Firebase Hosting) | no |
| `www.threadedstack.com` / `admin.threadedstack.com` / `threads.threadedstack.com` | CNAME | `tdsk-website.web.app` / `tdsk-admin.web.app` / `tdsk-threads.web.app` | no |
| `relay.threadedstack.com` | A | `161.153.19.35` (Oracle Cloud edge VM, access in `~/.config/tdsk/oracle/`) | no |
| `threadedstack.app`, `threadedstack.com` | MX | `1 smtp.google.com` (Google Workspace) | no |
| `_dmarc.threadedstack.com` | TXT | `v=DMARC1; p=none;` | no |
| `threadedstack.com` | TXT | Google site + Workspace recovery verification, `hosting-site=tdsk-website`, `stripe-verification=...` | no |
| `threadedstack.app`, `threadedstack.dev` | TXT | Google site verification | no |

## Other External Services

| Service | What depends on the cluster / DB | Action on rebuild |
|---|---|---|
| Stripe | Webhook endpoint `https://px.threadedstack.app/_/payments/webhooks` | Re-point if the proxy host changes, update `TDSK_PAY_WEBHOOK_SECRET`; catalog ids in `deploy/infra/stripe.yaml` |
| Object storage | Sandbox session and schedule-run output in bucket `tdsk-prod` on `objectstore.nyc1.civo.com` | Any S3-compatible store; set `TDSK_S3_*` and run `tdsk kube secret s3 --env prod` |
| Email (Resend) | none on the cluster | Sender domain stays verified independently |
| Firebase Hosting | SPAs embed `TDSK_AUTH_URL` and the prod API URL at build time | Rebuild and redeploy after the auth URL changes |
| Container images | `ghcr.io/threadedstack/*` (not hosted on Civo) | Pull secret via `tdsk kube secret docker` |
| GitHub Actions | `deploy-production.yml` (Civo kubeconfig via `TDSK_CIVO_TOKEN`, runs on every push to main) and `system-monitor.yml` (polls `px.threadedstack.app` every 15 min) | Disable both while no cluster exists; rewrite the kubeconfig step for the new provider |

## Secrets Kept Outside Git

Secret values are never committed. `deploy/infra/secrets.template.yaml` lists every key name. The values live only in these places, which must be backed up to a password manager:

- `~/.config/tdsk/` (whole tree): `values.yaml`, `values.tdsk.production.yaml`, `tsa.yaml`, `sandbox_key`, `domain/` (egress CA cert/key, Stripe, Porkbun and object-store credentials), `oracle/`
- `TDSK_MASTER_KEY` above all, since it decrypts the `secrets` table
- GitHub Actions secrets are write-only, so the local files are the only readable copy
