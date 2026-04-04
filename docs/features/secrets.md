# Secrets

## What Are Secrets

Secrets are encrypted key-value pairs that store sensitive data such as API keys, tokens, and credentials. Users create secrets by name and value, but the platform immediately encrypts the value at rest using AES-256-GCM. Once stored, the raw value is never returned through the API -- only metadata (name, ID, description, scope) is exposed to non-admin users.

Secrets are scoped using the **Exclusive Arc** pattern: each secret belongs to exactly one owner entity. The database enforces this via a `CHECK` constraint that permits exactly one of the four foreign key columns to be non-null (with one exception for provider secrets that carry dual org+provider ownership).

**Source:** `repos/database/src/schemas/secrets.ts` (schema), `repos/domain/src/models/secret.ts` (model)

## Secret Lifecycle

### Create

1. Client sends `POST /secrets` with `name`, `value`, and a scope identifier (`orgId`, `projectId`, `providerId`, or `agentId`).
2. Backend validates the exclusive arc -- exactly one owner field must be set (or the org+provider dual-ownership variant).
3. Backend checks the caller has `create` permission on the `secret` resource within the target scope.
4. The scope owner ID is used as the salt for HKDF key derivation, producing a 32-byte encryption key.
5. The value is encrypted with AES-256-GCM. The IV (12 bytes), auth tag (16 bytes), and ciphertext are concatenated and base64-encoded into a single `encryptedValue` string.
6. A truncated SHA-256 hash of the name is stored as `hashKey` for lookup purposes.
7. The secret record is persisted. The org's `secrets` quota counter is incremented.
8. The response returns sanitized data (no `value` or `encryptedValue` fields).

**Source:** `repos/backend/src/endpoints/secrets/createSecret.ts`

### Read

- `GET /secrets` lists secrets for a scope. Members see only metadata; admins (`admin` role and above) see encrypted values. The `canAccessSecretValue()` permission check gates this.
- `GET /secrets/:id` returns a single secret with the same role-based visibility.
- Raw plaintext values are never returned by any API endpoint.

**Source:** `repos/backend/src/endpoints/secrets/listSecrets.ts`, `repos/backend/src/endpoints/secrets/getSecret.ts`, `repos/domain/src/utils/permissions/permissions.ts`

### Update (Rotate)

1. Client sends `PUT /secrets/:id` with an optional new `name` and/or `value`.
2. Backend fetches the existing record, checks `update` permission.
3. If a new value is provided, the backend re-derives the encryption key from the original scope owner ID and re-encrypts.
4. The response returns sanitized data.

Rotation is an in-place re-encrypt: the old ciphertext is overwritten. All references using `{{ name:id }}` templates automatically pick up the new value on the next request -- no configuration changes needed.

**Source:** `repos/backend/src/endpoints/secrets/updateSecret.ts`

### Delete

1. Client sends `DELETE /secrets/:id`.
2. Backend checks `delete` permission.
3. Backend verifies no providers reference this secret as their API key (`secretId` foreign key). If a provider depends on it, deletion is blocked with a `409 Conflict`.
4. The record is removed and the org's `secrets` quota counter is decremented.

**Source:** `repos/backend/src/endpoints/secrets/deleteSecret.ts`

## Encryption

All secret values are encrypted at rest using **AES-256-GCM** with keys derived via **HKDF (RFC 5869)**.

### Key Derivation

```
TDSK_MASTER_KEY (env, 32+ bytes hex)
        |
        v
  HKDF-SHA256(master_key, salt=refId, info="user-secret-key")
        |
        v
  32-byte derived key (unique per scope owner)
```

- `TDSK_MASTER_KEY` is a platform-wide master key loaded from the environment.
- `refId` is the scope owner's ID (orgId, projectId, providerId, or agentId). Each scope owner gets a unique derived key.
- The info parameter is the fixed string `user-secret-key`.

### Encryption / Decryption

- **Encrypt:** Generate a random 12-byte IV, encrypt with AES-256-GCM, extract the 16-byte auth tag.
- **Storage format:** `base64(IV [12 bytes] || authTag [16 bytes] || ciphertext [N bytes])` -- a single base64 string stored in the `encrypted_value` column.
- **Decrypt:** Decode from base64, split into IV / authTag / ciphertext components, derive the key from the scope owner ID, and decrypt. The GCM auth tag provides tamper detection.

There is no version byte in the storage format. If the encryption algorithm ever changes, a version prefix would be added for backward compatibility.

For the full security model, see `docs/architecture/security-model.md`.

**Source:** `repos/domain/src/crypto/crypto.ts`

## Scoping Rules

Secrets use the **Exclusive Arc** pattern with four scope levels. A database `CHECK` constraint enforces that exactly one scope column is non-null per row (with one permitted combination):

| Scope | Column | Description |
|-------|--------|-------------|
| Organization | `org_id` | Shared across the entire org. Available to all endpoints and agents within the org. |
| Project | `project_id` | Scoped to a single project. Available to endpoints within that project. |
| Provider | `provider_id` | Tied to a specific LLM or API provider. Used for provider API keys and auth headers. |
| Agent | `agent_id` | Dedicated to a single agent. Isolated from other agents in the same org. |

### Dual Ownership Exception

Provider secrets support a dual-ownership mode where both `org_id` and `provider_id` are set. This allows the secret to appear in both the organization's secrets list (via `orgId`) and the provider's configuration drawer (via `providerId`). The constraint permits this combination explicitly.

### Scope Resolution During Decryption

When decrypting, the `SecretResolver` determines the key derivation reference ID using priority order: `agentId > providerId > projectId > orgId`. If decryption fails with the scope owner's ID (e.g., a quickstart-created secret was encrypted with the orgId but stored as provider-scoped), it falls back to decrypting with the orgId.

**Source:** `repos/database/src/schemas/secrets.ts` (constraint), `repos/backend/src/services/secrets/secretResolver.ts` (decryption fallback)

## Placeholder Mechanisms

Threaded Stack has **two distinct placeholder systems** for injecting secrets into outbound traffic. Each serves a different execution context.

### 1. Config Templates: `{{ name:id }}`

**Syntax:** `{{ secret-name:aBcDeFgHiJ }}` (name followed by the secret's 10-character nanoid)

**When used:** At request time, when the backend itself is constructing or proxying an outbound request. This applies to:

- **Provider headers** -- e.g., `Authorization: Bearer {{ api-key:xK9mN2pQ4r }}`
- **Provider body parameters** -- template references in JSON body values
- **Proxy endpoint headers** -- custom headers configured on proxy-type endpoints
- **Response transforms** -- secret injection into proxied response bodies (when `transform.injectSecrets` is enabled)

**How it works:** The `SecretResolver` service scans string values for the `{{ name:id }}` pattern (matched by the regex `/\{\{\s*(.+?):([A-Za-z0-9_-]{10})\s*\}\}/g`). When found, it loads the referenced secrets from the database, decrypts them, and replaces the template with the plaintext value. If no template references are detected, the fast path skips all database queries.

**Resolution scope:** The resolver loads both provider-scoped and org-scoped secrets. Provider-scoped secrets take precedence when names collide.

**Source:** `repos/backend/src/services/secrets/secretResolver.ts`, `repos/domain/src/constants/values.ts` (regex patterns)

### 2. Egress Tokens: `tdsk_ph_*`

**Syntax:** `tdsk_ph_` followed by a 16-character random nanoid (e.g., `tdsk_ph_aB3dEf7hIjK1mN2p`)

**When used:** Inside sandbox pods, where user code runs in isolation and must never have access to real secret values. This applies to:

- **Agent sandboxes** -- when an agent executes code inside a K8s pod, any secrets the sandbox needs are replaced with opaque placeholder tokens before the pod starts.

**How it works:**

1. When a sandbox pod starts, the `SandboxService` generates a unique `tdsk_ph_*` token for each secret ID in the sandbox configuration. These tokens are stored in a placeholder map (`TPlaceholderMap`: `{ token -> secretId }`).
2. The placeholder map is associated with the pod's route entry, keyed by pod IP.
3. All outbound HTTP/HTTPS traffic from the sandbox pod is redirected (via iptables DNAT) to the **Egress Proxy** -- a transparent MITM proxy running on the backend.
4. The Egress Proxy intercepts each outbound request, identifies the source pod by IP address, looks up the pod's placeholder map, and scans all HTTP headers for `tdsk_ph_*` tokens.
5. For each token found, the proxy resolves the mapped secret ID, decrypts the secret value, and replaces the token with the real value before forwarding the request to the external service.
6. If a placeholder cannot be resolved, the proxy **throws an error and blocks the request** to prevent token leakage to external services.

**Source:** `repos/backend/src/services/proxy/egress.ts` (EgressProxy), `repos/backend/src/services/sandboxes/sandbox.ts` (token generation), `repos/backend/src/constants/values.ts` (PhTokenPrefix)

### Why Both Systems Exist

| Concern | Config Templates `{{ }}` | Egress Tokens `tdsk_ph_*` |
|---------|--------------------------|---------------------------|
| Execution context | Backend process (trusted) | Sandbox pod (untrusted user code) |
| Resolution timing | Before the request leaves the backend | As traffic exits the sandbox through the MITM proxy |
| Secret exposure | Backend decrypts in-process; plaintext lives only in memory briefly | Plaintext never enters the sandbox; replaced at the network boundary |
| Use case | Provider config, proxy endpoints, header injection | Agent sandboxes running arbitrary user code |

Config templates are sufficient when the backend itself is making the request (proxy endpoints, provider calls). Egress tokens are necessary when user-authored code running in an isolated sandbox needs to authenticate with external services without ever seeing the real credentials.

## Secret Flow Through System

```
                                  Threaded Stack Backend
                                 ========================

  ┌──────────────────────────────────────────────────────────────────────┐
  │                                                                      │
  │  PROXY ENDPOINT                                                      │
  │  ──────────────                                                      │
  │  1. Client request arrives at /proxy/:projectId/:endpointId          │
  │  2. BaseEndpoint.fetchSecrets() loads project-scoped secrets         │
  │  3. Secrets decrypted in memory via SecretResolver.decrypt()         │
  │  4. ProxyService.applyEndpointOptions() injects secrets into         │
  │     auth headers, OAuth tokens, and request transforms               │
  │  5. addEndpointHeaders() replaces {{ name:id }} in custom headers    │
  │  6. Request forwarded to upstream with real values                    │
  │                                                                      │
  │        Client ──► Backend ──[secrets injected]──► External API       │
  │                                                                      │
  ├──────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │  AGENT EXECUTION (Direct / SSE)                                      │
  │  ──────────────────────────────                                      │
  │  1. Agent run request arrives (POST /_/agents/:id/run)               │
  │  2. resolveAgentConfig() loads agent + provider                      │
  │  3. SecretResolver.resolveApiKey() decrypts the provider API key     │
  │  4. SecretResolver.resolveHeaders() replaces {{ }} in headers        │
  │  5. SecretResolver.resolveBodyParams() replaces {{ }} in body params │
  │  6. LLM config built with real apiKey (stays server-side)            │
  │  7. AgentRunner streams to LLM provider with real credentials        │
  │                                                                      │
  │        Client ──► Backend ──[apiKey resolved]──► LLM Provider        │
  │                                                                      │
  ├──────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │  AGENT SANDBOX (K8s Pod + Egress Proxy)                              │
  │  ─────────────────────────────────────                               │
  │  1. SandboxService.startPod() generates tdsk_ph_* tokens             │
  │     for each secret ID, stores mapping: { token -> secretId }        │
  │  2. Tokens injected into pod environment (not real values)           │
  │  3. User code in sandbox uses tdsk_ph_* tokens in HTTP headers       │
  │  4. iptables DNAT redirects all outbound traffic to EgressProxy      │
  │  5. EgressProxy identifies pod by source IP                          │
  │  6. EgressProxy scans headers, replaces tdsk_ph_* with real values   │
  │  7. Request forwarded to external service with real credentials       │
  │                                                                      │
  │        Sandbox Pod ──[tdsk_ph_*]──► EgressProxy ──[real]──► External │
  │                                                                      │
  └──────────────────────────────────────────────────────────────────────┘
```

### Egress Proxy Protocol Handling

The Egress Proxy operates as a transparent MITM proxy with protocol sniffing:

- **HTTP traffic** is piped directly to the internal MITM proxy with an injected `X-TDSK-Real-IP` header for pod identification.
- **HTTPS traffic** (detected by the `0x16` TLS ClientHello byte) has its SNI hostname extracted, gets converted into an HTTP CONNECT tunnel, and is then forwarded. The MITM proxy generates per-hostname certificates signed by the platform's CA, allowing it to inspect and modify HTTPS headers before forwarding.

## Access Control

### Who Can Create Secrets

- **Admin+ role** required. The `checkPermission(req, EPermAction.create, EPermResource.secret, ...)` call enforces this.
- For provider-scoped secrets, the provider must belong to the caller's org.
- For agent-scoped secrets, the agent must belong to the caller's org.

### Who Can Read Secret Metadata

- **Member+ role** can see secret names, IDs, descriptions, and scope identifiers.
- Secret `value` and `encryptedValue` fields are stripped by the `Secret.sanitize()` method, which removes both fields via `omitKeys(this, ['value', 'encryptedValue'])`.

### Who Can Read Secret Values

- **Admin+ role** only. The `canAccessSecretValue(userRole)` function returns `true` only for `admin`, `owner`, and `super` roles.
- Even for admins, the API returns the `encryptedValue` (the base64-encoded ciphertext), not the decrypted plaintext. Plaintext values exist only transiently in backend memory during secret resolution.

### Who Can Update / Delete Secrets

- **Admin+ role** required for both `update` and `delete` operations.
- Deletion is blocked if any provider references the secret as its API key (`secretId` foreign key), returning a `409 Conflict` with guidance to unlink the provider first.

### Raw Values Are Never Exposed

The platform enforces a strict principle: **secret plaintext never leaves the backend process boundary**.

- API responses return sanitized objects (no `value` or `encryptedValue`).
- LLM API keys are resolved server-side and injected into outbound requests; they are never included in session tokens or client responses.
- Sandbox pods receive opaque `tdsk_ph_*` placeholder tokens, not real values. The real values are substituted at the network boundary by the Egress Proxy.
- The `Secret.sanitize()` method is called on every API response that returns secret data, enforcing this at the model level.
