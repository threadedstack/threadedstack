# SecretsSelector Bug Fix & webProvider Encryption

**Date**: 2026-03-03
**Status**: Approved

---

## Task 1: SecretsSelector errors (P2 — Bug Fix)

### Root Cause

Data source mismatch between selected values and options in AgentDrawer's SecretsSelector:

1. `selectedSecrets` (line 182-184) populated from `agent.secrets` — agent-scoped secrets (FK `secrets.agentId`)
2. `secretsList` options (line 84-92) populated from `fetchSecrets({ orgId })` + `fetchSecrets({ orgId, projectId })` — org-scoped and project-scoped secrets
3. Agent-scoped secrets don't appear in org/project fetch results (exclusive arc)
4. Temporary seeding (line 187-189) is overwritten by async fetch, removing agent secrets from options
5. MUI Autocomplete receives selected values not present in options → errors

### Fix

Merge `agent.secrets` into the fetched secretsList after async load (deduplicate by ID). Remove the fallback chain (`s.id || s.name || s.hashKey || ''`) — use `s.id` directly since agent.secrets are full Secret objects. Remove the now-unnecessary seeding at lines 187-189.

### Files

- `repos/admin/src/components/Agents/AgentDrawer.tsx` — merge agent secrets into fetched list, simplify selectedSecrets mapping

---

## Task 2: Encrypt webProvider.apiKey

### Problem

`TWebProviderConfig.apiKey` stored as plaintext in `agents.environment` JSONB. All other secrets use AES-256-GCM via `secrets` table + `SecretResolver`.

### Fix

Replace `apiKey` with `secretId` on `TWebProviderConfig`. Decrypt in agent runner via `SecretResolver` before passing to `createWebProvider()`. No backward compatibility needed.

### Changes

1. **Domain** (`repos/domain/src/types/ai.types.ts`): Replace `apiKey?: string` with `secretId?: string`
2. **Agent Runner** (`repos/agent/src/runner/runner.ts`): Resolve `secretId` via SecretResolver before `createWebProvider()`
3. **Admin UI** (`repos/admin/src/components/Agents/`): Replace plaintext text field with secret picker dropdown

### Files

- `repos/domain/src/types/ai.types.ts` — type change
- `repos/agent/src/runner/runner.ts` — decrypt before createWebProvider
- `repos/agent/src/tools/definitions/web/webProvider.ts` — no change (receives plain apiKey from runner)
- `repos/agent/src/tools/definitions/web/jinaWebProvider.ts` — no change
- `repos/admin/src/components/Agents/` — secret picker UI
