# Egress CA CLI Secret Task — Design

## Problem

The egress proxy needs a CA certificate and private key to perform MITM TLS termination on outbound sandbox traffic. Currently two separate K8s secrets are referenced:

- `tdsk-egress-ca` — backend pod (cert + key for MITM)
- `tdsk-proxy-ca` — sandbox pods (cert only for CA trust)

These contain the same certificate. There is no CLI task to create either secret, and having two secrets for the same cert is unnecessary complexity.

## Solution

Consolidate into a single `tdsk-egress-ca` secret and add a CLI preset task to create it. Sandbox pods mount only the `tls.crt` subPath from the same secret, so the private key is never exposed to sandbox containers.

## Secret Layout

```
tdsk-egress-ca (generic secret)
├── tls.crt  — CA certificate (PEM)
└── tls.key  — CA private key (PEM)
```

**Backend pod** mounts the full secret at `/etc/tdsk/ca/` → reads both `tls.crt` and `tls.key`.

**Sandbox pods** mount with `subPath: tls.crt` → reads only the certificate at `/usr/local/share/ca-certificates/tdsk-proxy.crt`.

## Changes

### 1. Create `repos/cli/src/tasks/kube/secret/egress.ts`

New preset task (~40 LOC) following the existing pattern (mirrors `tdsk.ts`):

- Accepts `--cert` and `--key` file path options
- Falls back to `TDSK_EGRESS_CA_CERT` and `TDSK_EGRESS_CA_KEY` env vars
- Validates both paths are present
- Delegates to base `secretTask.action()` with:
  - `name`: `config.envs.TDSK_KUBE_SCRT_EGRESS_CA || 'tdsk-egress-ca'`
  - `files`: `'tls.crt:<certPath>,tls.key:<keyPath>'`

Uses `generic` type (not `tls`) because the base task's `buildLocs` helper produces `--from-file` args. The `generic` type with `tls.crt`/`tls.key` keys produces identical volume mount behavior.

Result: `kubectl create secret generic tdsk-egress-ca --from-file=tls.crt=/path/to/cert --from-file=tls.key=/path/to/key`

Task definition:
- Name: `egress`
- Aliases: `egress-ca`, `eca`
- Options: `--cert` (alias `crt`, env `TDSK_EGRESS_CA_CERT`), `--key` (alias `ky`, env `TDSK_EGRESS_CA_KEY`), `--log`

### 2. Modify `repos/cli/src/tasks/kube/secret/secret.ts`

Import `egress` and add to the `tasks` object.

### 3. Modify `deploy/values.yaml`

Add to secrets section:
```yaml
TDSK_KUBE_SCRT_EGRESS_CA: tdsk-egress-ca
```

Add env var placeholders (blank — actual paths go in `~/.config/tdsk/values.yaml`):
```yaml
TDSK_EGRESS_CA_CERT:
TDSK_EGRESS_CA_KEY:
```

### 4. Modify `repos/sandbox/src/constants/values.ts`

Change `CACertSecretName` from `tdsk-proxy-ca` to `tdsk-egress-ca`.

### 5. Modify `repos/sandbox/src/kube/podManifest.ts`

Change volume mount `subPath` from `ca.crt` to `tls.crt`.

### 6. Modify `repos/sandbox/src/kube/podManifest.test.ts`

Update any assertions affected by the constant value change. The test imports `CACertSecretName` directly so secret name assertions auto-update. No structural test changes needed.

## Usage

```bash
# From explicit file paths
tdsk kube secret egress --cert ./certs/ca.crt --key ./certs/ca.key

# With namespace
tdsk kube secret egress --cert ./ca.crt --key ./ca.key --namespace production

# From env vars (TDSK_EGRESS_CA_CERT / TDSK_EGRESS_CA_KEY in ~/.config/tdsk/values.yaml)
tdsk kube secret egress

# Using aliases
tdsk kube secret eca --cert ./ca.crt --key ./ca.key
```
