# Sandbox Provider Auth & Runtime Presets

## Context

The sandbox system has 4 runtime presets (claude-code, codex, opencode, custom) but no mechanism to inject AI provider credentials into sandbox pods. AI tools inside sandboxes cannot authenticate with their backing APIs, making them non-functional without manual env var configuration.

This design adds:
1. **Gemini CLI** as a new sandbox runtime
2. **Provider-sandbox linking** via a junction table, enabling provider credentials to be injected into sandbox pods at startup
3. **Env var mapping** that automatically resolves (runtime, provider brand) → environment variables
4. **Dual injection**: MITM placeholders for API key providers, direct injection for complex auth (Sigv4, OAuth2)

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Provider-sandbox relationship | Junction table (`sandbox_providers`) | Supports multiple providers per sandbox (AI auth + git auth). Mirrors agent_providers pattern. |
| Runtime model for CC variants | Same `claude-code` runtime, provider brand determines env vars | Avoids enum bloat. Only `gemini-cli` gets a new ESandboxRuntime entry. |
| Env var mapping approach | Static domain constants | Simple, type-safe, deterministic. Custom setups use existing `envVars` config field. |
| Complex auth (Bedrock/Vertex) | Direct env injection at pod startup | Sigv4/OAuth2 can't use MITM placeholders. Pod is already network-isolated. |
| Bedrock auth | Support both Sigv4 AND AWS_BEARER_TOKEN_BEDROCK | Bearer token path is MITM-compatible; Sigv4 requires direct injection. Provider `authMethod` option selects path. |
| Vertex credential files | InitScript file write (base64 env → file) | Simple, no K8s Secret objects needed. Entrypoint decodes and writes file. |
| Seeding | Seed existing 4 + gemini-cli on org creation | CC variants don't need seeding — they're the same runtime with different providers linked. User handles existing orgs manually. |
| Provider auth scope | All runtimes (claude-code, codex, opencode, gemini-cli) | Comprehensive from day one. |

---

## 1. Data Model

### 1.1 New `sandbox_providers` Junction Table

```sql
CREATE TABLE sandbox_providers (
  id          VARCHAR(10) PRIMARY KEY,
  sandbox_id  VARCHAR(10) NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
  provider_id VARCHAR(10) NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  priority    INTEGER DEFAULT 0,
  model       TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(sandbox_id, provider_id)
);

CREATE INDEX sandbox_providers_sandbox_idx ON sandbox_providers(sandbox_id);
CREATE INDEX sandbox_providers_provider_idx ON sandbox_providers(provider_id);
```

- `priority`: 0 = primary runtime auth. Higher values for secondary providers (future: git auth, etc.)
- `model`: Per-link model override (e.g., `claude-sonnet-4-6`, `glm-4.7`). Injected as `ANTHROPIC_MODEL` or equivalent.
- `ON DELETE RESTRICT`: Prevents deleting a provider linked to sandboxes. User must unlink first.

### 1.2 ESandboxRuntime — One New Entry

```typescript
enum ESandboxRuntime {
  codex = 'codex',
  custom = 'custom',
  openCode = 'opencode',
  claudeCode = 'claude-code',
  geminiCli = 'gemini-cli',     // NEW
}
```

### 1.3 Sandbox Model Update

Add `providers: Provider[]` to the `Sandbox` model class (loaded via join, same as `Agent.providers`).

### 1.4 New `SandboxProvider` Model

```typescript
class SandboxProvider extends Base {
  sandboxId: string
  providerId: string
  priority: number = 0
  model?: string
}
```

Located in `repos/domain/src/models/sandboxProvider.ts`.

---

## 2. Env Var Mapping

### 2.1 Mapping Types

```typescript
type TEnvVarSource = 'secret' | 'option' | 'static'
type TEnvVarInjection = 'mitm' | 'direct' | 'file'

type TRuntimeEnvVar = {
  envVar: string                    // Target env var name in the container
  source: TEnvVarSource             // Where the value comes from
  optionKey?: string                // Key in provider.options (when source='option')
  staticValue?: string              // Fixed value (when source='static')
  injection?: TEnvVarInjection      // How to inject: 'mitm' (default), 'direct', or 'file'
  filePath?: string                 // Destination file path (when injection='file')
  required?: boolean                // If true, startPod() fails without this value
  defaultValue?: string             // Fallback if source value is missing
}
```

### 2.2 Complete Mapping Table

Located in `repos/domain/src/constants/sandbox.ts` as `RuntimeProviderEnvMap`.

#### Claude Code — Direct Anthropic (`anthropic`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `ANTHROPIC_API_KEY` | secret | mitm | yes | Sent as `x-api-key` header |

#### Claude Code — AWS Bedrock, Sigv4 (`amazonBedrock`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `CLAUDE_CODE_USE_BEDROCK` | static: `1` | direct | yes | Enables Bedrock mode |
| `AWS_REGION` | option: `region` | direct | yes | Must be explicit, CC doesn't read .aws config |
| `AWS_ACCESS_KEY_ID` | option: `accessKeyId` | direct | yes | Sigv4 — can't MITM |
| `AWS_SECRET_ACCESS_KEY` | secret | direct | yes | Sigv4 — can't MITM |
| `AWS_SESSION_TOKEN` | option: `sessionToken` | direct | no | For temporary credentials |

#### Claude Code — AWS Bedrock, Bearer Token (`amazonBedrock` with `authMethod=bearer`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `CLAUDE_CODE_USE_BEDROCK` | static: `1` | direct | yes | |
| `AWS_REGION` | option: `region` | direct | yes | |
| `AWS_BEARER_TOKEN_BEDROCK` | secret | mitm | yes | Simpler Bedrock API key auth |

#### Claude Code — Google Vertex AI (`google-vertex`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `CLAUDE_CODE_USE_VERTEX` | static: `1` | direct | yes | Enables Vertex mode |
| `CLOUD_ML_REGION` | option: `region` | direct | no | Default: `global` |
| `ANTHROPIC_VERTEX_PROJECT_ID` | option: `projectId` | direct | yes | GCP project ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | secret | file | yes | Service account JSON → `/tmp/gcloud-sa.json` |

#### Claude Code — Z.ai (`zai`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `ANTHROPIC_AUTH_TOKEN` | secret | mitm | yes | Sent as `Authorization: Bearer` header |
| `ANTHROPIC_BASE_URL` | static | direct | yes | `https://api.z.ai/api/anthropic` |
| `API_TIMEOUT_MS` | static | direct | no | `3000000` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | option: `haikuModel` | direct | no | Default: `glm-4.5-air` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | option: `sonnetModel` | direct | no | Default: `glm-4.7` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | option: `opusModel` | direct | no | Default: `glm-4.7` |

#### Claude Code — OpenRouter (`openrouter`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `ANTHROPIC_API_KEY` | secret | mitm | yes | Sent as `x-api-key` header |
| `ANTHROPIC_BASE_URL` | static | direct | yes | `https://openrouter.ai/api` (CC appends `/v1/messages`) |
| `ANTHROPIC_MODEL` | option: `model` | direct | no | Optional model override |

#### Claude Code — LiteLLM (`custom` brand)

LiteLLM is a generic gateway. Users create a provider with `brand: 'custom'` and configure `baseUrl` + API key. The `custom` brand mapping applies to any Anthropic-compatible gateway.

| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `ANTHROPIC_AUTH_TOKEN` | secret | mitm | yes | LiteLLM master key, sent as `Authorization: Bearer` |
| `ANTHROPIC_BASE_URL` | option: `baseUrl` | direct | yes | User's LiteLLM server URL |
| `ANTHROPIC_MODEL` | option: `model` | direct | no | Optional model override |

#### Claude Code — Ollama (`ollama`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `ANTHROPIC_AUTH_TOKEN` | static | direct | yes | Literal string `ollama` |
| `ANTHROPIC_API_KEY` | static | direct | yes | Empty string `""` |
| `ANTHROPIC_BASE_URL` | option: `baseUrl` | direct | yes | Default: `http://localhost:11434`. Must be pod-reachable. |
| `ANTHROPIC_MODEL` | option: `model` | direct | no | Ollama model name |

#### Codex — OpenAI (`openai`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `OPENAI_API_KEY` | secret | mitm | yes | |

#### Codex — OpenRouter (`openrouter`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `OPENROUTER_API_KEY` | secret | mitm | yes | |

#### Codex — Gemini (`google`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `GEMINI_API_KEY` | secret | mitm | yes | |

#### Gemini CLI — Google AI Studio (`google`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `GOOGLE_API_KEY` | secret | mitm | yes | Google AI Studio API key |

#### Gemini CLI — Google Vertex AI (`google-vertex`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `GOOGLE_API_KEY` | secret | direct | yes | |
| `GOOGLE_GENAI_USE_VERTEXAI` | static | direct | yes | `true` |
| `GOOGLE_APPLICATION_CREDENTIALS` | secret | file | no | Service account JSON → `/tmp/gcloud-sa.json` |
| `GOOGLE_CLOUD_PROJECT` | option: `projectId` | direct | no | |
| `GOOGLE_CLOUD_REGION` | option: `region` | direct | no | |

#### OpenCode — Anthropic (`anthropic`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `ANTHROPIC_API_KEY` | secret | mitm | yes | |

#### OpenCode — OpenAI (`openai`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `OPENAI_API_KEY` | secret | mitm | yes | |

#### OpenCode — OpenRouter (`openrouter`)
| Env Var | Source | Injection | Required | Notes |
|---------|--------|-----------|----------|-------|
| `OPENROUTER_API_KEY` | secret | mitm | yes | |

> **Note**: OpenCode mappings are a starting set covering the most common providers. OpenCode supports 75+ providers via Vercel AI SDK — additional mappings can be added as needed without schema changes.

### 2.3 Model Override Behavior

The `sandbox_providers.model` field is injected as a model-selection env var, but only runtimes that support env-var-based model selection benefit:

| Runtime | Model Env Var | Supported? |
|---------|---------------|------------|
| `claude-code` | `ANTHROPIC_MODEL` | Yes — env var natively supported |
| `codex` | N/A | No — Codex uses `config.json` or `--model` CLI flag. Model override ignored. |
| `gemini-cli` | N/A | No — Gemini CLI uses `--model` CLI flag. Model override ignored. |
| `opencode` | N/A | No — OpenCode uses `opencode.json` config. Model override ignored. |

For runtimes that don't support env var model selection, the junction table `model` field is stored but not injected. Future work could write config files or pass CLI flags.

### 2.4 Bedrock Auth Method Selection

The `amazonBedrock` provider brand supports two auth methods:
- **Sigv4** (default): Uses `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`. Direct injection only.
- **Bearer Token**: Uses `AWS_BEARER_TOKEN_BEDROCK`. MITM-compatible.

Selection is via `provider.options.authMethod`:
- `"sigv4"` (default) → Sigv4 mapping
- `"bearer"` → Bearer token mapping

---

## 3. Injection Flow

### 3.1 Backend `startPod()` Enhancement

In `repos/backend/src/services/sandboxes/sandbox.ts`, after existing secretIds/git token resolution:

```
1. Load sandbox providers via DB join:
   sandboxProviders = db.services.sandboxProvider.listBySandbox(sandboxId)

2. For each linked provider (ordered by priority):
   a. Look up mapping = RuntimeProviderEnvMap[sandbox.runtime][provider.brand]
   b. If no mapping found, skip this provider
   c. If provider.brand === 'amazonBedrock', check provider.options.authMethod
      to select Sigv4 vs Bearer mapping
   d. For each env var entry in the mapping:
      - source='static':
        → Add staticValue to extraEnv
      - source='secret' + injection='mitm':
        → Generate placeholder token (tdsk_ph_<16>)
        → Add placeholder to placeholders map AND extraEnv[envVar]
      - source='secret' + injection='direct':
        → Resolve real value via SecretResolver.resolveApiKey()
        → Add real value to extraEnv[envVar]
      - source='secret' + injection='file':
        → Resolve real value via SecretResolver.resolveApiKey()
        → Base64-encode the value
        → Add encoded value to extraEnv as TDSK_CRED_FILE_<envVar>
        → Add filePath to extraEnv[envVar] (e.g., /tmp/gcloud-sa.json)
      - source='option':
        → Read provider.options[optionKey]
        → Use defaultValue if option is missing
        → Add to extraEnv[envVar]
   e. If junction row has model override:
      → Determine model env var name from runtime (ANTHROPIC_MODEL, OPENAI_MODEL, etc.)
      → Add to extraEnv

3. Validate: if any required env var is missing, throw 400 with descriptive message

4. Continue to buildPodManifest() with enriched extraEnv + placeholders
```

### 3.2 Entrypoint Enhancement

In `deploy/sandbox-entrypoint.sh`, add credential file resolution before starting the AI tool:

```bash
# Decode base64 credential files (for Google Vertex, etc.)
for var in $(env | grep '^TDSK_CRED_FILE_' | cut -d= -f1); do
  target_var="${var#TDSK_CRED_FILE_}"
  target_path="${!target_var}"
  if [ -n "$target_path" ] && [ -n "${!var}" ]; then
    echo "${!var}" | base64 -d > "$target_path"
    chmod 600 "$target_path"
    unset "$var"  # Remove base64 data from env
  fi
done
```

This is generic — any `TDSK_CRED_FILE_<X>` env var gets decoded into the path specified by `<X>`.

### 3.3 MITM Proxy — No Changes Required

The existing `EgressProxy.handleRequest()` in `repos/backend/src/services/proxy/egress.ts` already scans ALL outbound request headers for `tdsk_ph_*` tokens. No changes needed for the MITM path.

---

## 4. Dockerfile Changes

### 4.1 Add Gemini CLI to Sandbox Base Image

In `deploy/Dockerfile.sandbox-base`:

```dockerfile
RUN npm install -g @anthropic-ai/claude-code @openai/codex @google/gemini-cli
```

Adds `gemini-cli` alongside existing tools. The `gemini` binary becomes available in PATH.

### 4.2 Entrypoint Script

Add the credential file resolution block (Section 3.2) to `deploy/sandbox-entrypoint.sh`.

---

## 5. Sandbox Preset Updates

### 5.1 New Gemini CLI Preset

In `repos/domain/src/constants/sandbox.ts`:

```typescript
[ESandboxRuntime.geminiCli]: {
  name: 'Gemini CLI',
  description: 'Google Gemini CLI AI assistant',
  config: {
    sshEnabled: true,
    idleTimeoutMinutes: 30,
    image: DefaultSandboxImage,
    resources: DefaultResources,
    runtime: ESandboxRuntime.geminiCli,
    runtimeCommand: 'gemini',
    initScript: 'echo "Gemini CLI sandbox ready"',
  },
}
```

### 5.2 Runtime Config

```typescript
[ESandboxRuntime.geminiCli]: {
  runtimeCommand: 'gemini',
  initScript: 'echo "Gemini CLI sandbox ready"',
}
```

### 5.3 Org Creation Seeding

No code changes needed in `createOrg.ts` — it iterates `SandboxPresets`, which now includes `geminiCli`. New orgs get 5 built-in sandboxes.

---

## 6. API Endpoints

### 6.1 Sandbox Provider CRUD

```
POST   /_/sandboxes/:id/providers            — Link provider
GET    /_/sandboxes/:id/providers            — List linked providers
DELETE /_/sandboxes/:id/providers/:providerId — Unlink provider
```

**Link provider** request body:
```json
{
  "providerId": "prov_xyz",
  "priority": 0,
  "model": "claude-sonnet-4-6"
}
```

**Validation on link**:
1. Provider and sandbox must belong to the same org
2. Provider brand must exist in `RuntimeProviderEnvMap[sandbox.runtime]`
3. If incompatible, return 400: `"Provider brand 'openai' is not compatible with runtime 'claude-code'. Compatible brands: anthropic, amazonBedrock, google-vertex, zai, openrouter, ollama"`

### 6.2 Sandbox GET Response Update

Include linked providers in responses:
```json
{
  "id": "sb_abc1234",
  "name": "Claude Code",
  "config": { "runtime": "claude-code" },
  "providers": [
    {
      "id": "prov_xyz",
      "brand": "anthropic",
      "name": "My Anthropic Key",
      "priority": 0,
      "model": null
    }
  ]
}
```

---

## 7. Admin UI Changes

### 7.1 Sandbox Detail Page — Provider Section

- **Provider picker**: Dropdown of org providers, filtered by runtime compatibility
- **Linked providers list**: Shows brand icon, name, priority, model override
- **Unlink button**: Per-provider
- **Model override input**: Optional text field per linked provider

### 7.2 Sandbox List — Auth Status

- Badge/icon on sandbox cards indicating provider linkage status
- No provider linked → subtle warning indicator
- Provider linked → brand icon shown

### 7.3 Connect Modal Warning

If no provider is linked and the runtime requires auth:
> "No provider linked. The AI tool may fail to authenticate. Link a provider in sandbox settings."

---

## 8. CLI Changes

### 8.1 `tsa run` — No Changes

The CLI doesn't handle auth. Backend resolves providers at `startPod()` time. CLI remains auth-agnostic.

### 8.2 `tsa sandboxes` — Show Provider Brand

Add a "Provider" column to the sandbox list table showing the primary linked provider brand (or "—" if none).

---

## 9. Security Model

1. **MITM path** (API key providers): Secret values never enter the container. Placeholders are opaque tokens. `printenv` shows `ANTHROPIC_API_KEY=tdsk_ph_xxxxxxxx`. Egress proxy resolves on-the-fly.

2. **Direct path** (Bedrock Sigv4, Vertex): Real credential values are in the container env. Mitigations:
   - Pod is network-isolated (iptables DNAT to egress proxy)
   - Pod runs as unprivileged user `sandbox`
   - No privilege escalation allowed
   - Credentials are scoped to the specific provider

3. **File path** (Vertex service account): Base64-encoded in env, decoded to file by entrypoint, then env var is cleared. File permissions set to `600`.

4. **Provider ownership validation**: `provider.orgId === sandbox.orgId` enforced on link.

5. **Junction table `ON DELETE RESTRICT`**: Can't delete a provider linked to sandboxes.

---

## 10. Files to Modify

| File | Change |
|------|--------|
| `repos/domain/src/types/sandbox.types.ts` | Add `geminiCli` to `ESandboxRuntime`. Add `TRuntimeEnvVar`, `TEnvVarSource`, `TEnvVarInjection` types. |
| `repos/domain/src/constants/sandbox.ts` | Add gemini-cli preset, runtime config, `RuntimeProviderEnvMap` constant. |
| `repos/domain/src/models/sandbox.ts` | Add optional `providers: Provider[]` field. |
| `repos/domain/src/models/sandboxProvider.ts` | **NEW**: `SandboxProvider` model class. |
| `repos/domain/src/types/provider.types.ts` | Add `authMethod` to provider options type if needed. |
| `repos/database/src/schemas/sandboxProviders.ts` | **NEW**: Drizzle schema for junction table. |
| `repos/database/src/services/sandboxProvider.ts` | **NEW**: CRUD service for sandbox_providers. |
| `repos/backend/src/services/sandboxes/sandbox.ts` | Enhance `startPod()` to resolve provider env vars. |
| `repos/backend/src/endpoints/sandboxes/` | **NEW**: `linkProvider.ts`, `listProviders.ts`, `unlinkProvider.ts` endpoints. |
| `repos/backend/src/endpoints/sandboxes/getSandbox.ts` | Include providers in response. |
| `repos/backend/src/endpoints/orgs/createOrg.ts` | Gemini-cli preset auto-seeded (no code change — iterates SandboxPresets). |
| `deploy/Dockerfile.sandbox-base` | Add `@google/gemini-cli` to npm install. |
| `deploy/sandbox-entrypoint.sh` | Add credential file resolution block. |
| `repos/admin/` | Provider picker on sandbox detail, auth status badges, connect modal warning. |
| `repos/repl/src/tasks/run.ts` | Show provider brand in sandbox list. |

---

## 11. Testing Strategy

### Unit Tests
- `RuntimeProviderEnvMap` mapping completeness (every runtime has at least one brand mapping)
- `SandboxProvider` model serialization
- Provider env var generation logic (mock SecretResolver)
- Bedrock auth method selection (Sigv4 vs Bearer)
- Credential file encoding/decoding

### Integration Tests
- Link/unlink provider to sandbox via API
- Connect sandbox with provider → verify env vars in pod
- Connect sandbox without provider → verify no auth env vars (no error)
- MITM placeholder replacement for API key providers
- Direct injection for Bedrock Sigv4
- Credential file write for Vertex
- Brand compatibility validation on link

### E2E / Manual
- Admin UI: link provider to sandbox, see brand badge
- `tsa run` with linked Anthropic provider → Claude Code authenticates
- `tsa run` with linked OpenRouter provider → Claude Code uses OpenRouter
- Connect modal warning when no provider linked
