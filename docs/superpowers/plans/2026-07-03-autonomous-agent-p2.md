# Autonomous Agent P2: Real Memory + Self-Direction

> Spec: `docs/superpowers/specs/2026-07-01-autonomous-agent-design.md` sections 4.2 (Memory),
> 4.3 (Decision/Roadmap engine), 11 (P2). Written 2026-07-03, after the prod migration: the
> steward (agent `ag_lvUbjp_`, org `og_0000001` on the PROD Neon DB) runs `brain=runtime`
> (`claude -p` in a K8s pod) with an hourly observer and 4-hourly work cycle.

## Deliverable

A self-directing agent with durable memory: pgvector-backed `memories` store, scored retrieval
(`recency 0.995^hours x importance 1..10 x relevance`), `memory_search`/`memory_write` agent
tools (api brain), executor-injected memory context + structured-output memory capture
(runtime brain), nightly reflection, persisted roadmap + curriculum goal-proposal, compaction
persistence, cross-thread recall.

## Design decisions (grounded in recon 2026-07-03)

1. **No embeddings exist anywhere** (verified). Add a backend `EmbeddingService` that resolves
   an org's embedding provider from provider rows: the FIRST org `ai` provider whose
   `options.embeddingModel` is set (explicit opt-in; deterministic). Key decrypted via the
   existing `SecretResolver` pattern (provider.secretId). Supported brands: `openai`
   (`POST {baseUrl}/embeddings`, model e.g. `text-embedding-3-small`) and `google`
   (`:embedContent`, model e.g. `gemini-embedding-001`, `outputDimensionality` 1536).
   **Graceful degradation is load-bearing:** no embedding provider → embedding columns stay
   NULL and retrieval runs lexical-only (full-text). CI/unit tests never need a key.
2. **Vector column:** drizzle-orm 0.45.1 ships native `vector({dimensions})` + `cosineDistance`
   (verified locally). Dimension fixed at 1536. `CREATE EXTENSION IF NOT EXISTS vector` cannot
   be done by `drizzle-kit push`: it is added to the CLI DB push path (`pushSafe`) so both
   local `pnpm push` guidance and `tdsk release` handle it, and run manually once per DB.
3. **Runtime brain (the steward) cannot call agent tools.** Memory reaches the pod via executor
   injection (a `## Relevant memories` section built next to the existing
   `## Your previous report` section in `buildCliCommand`), and memory WRITES come back via a
   structured-output convention: the executor parses a trailing fenced block
   ` ```tdsk-memories\n[ {"text","importance","kind"} ]\n``` ` from the runtime stdout and
   persists entries server-side (source citation = the continuity thread/message id in `meta`).
   No new pod-side auth surface.
4. **Api brain gets real tools.** `memorySearch`/`memoryWrite` via an injected `IMemoryProvider`
   (mirrors `IWebProvider`), implemented in the backend and wired through `resolveAgentConfig`.
5. **Compaction persistence:** `contextManager` gains an optional `onSummary` callback; the
   runner passes one when a memory provider is configured, persisting the currently-discarded
   summary as a `compaction` memory.
6. **Reflection + curriculum are DATA, not code** (pure-data agent composition, multi-instance
   invariant): two new schedules on the steward using the same runtime brain: a nightly
   reflection cycle (distill recent reports/memories into cited `insight` memories via the
   structured-output block) and a daily goal-proposal cycle (read injected
   roadmap + recent schedule_runs summary, emit an updated `roadmap` memory whose text carries
   each goal's machine-checkable done criterion). The executor injects the current roadmap into
   EVERY cycle prompt (`## Roadmap` section, spec 4.3 "re-derive the subgoal from the roadmap
   each cycle").
7. **Cross-thread recall:** `message.listRecentByAgent(agentId)` (join `threads` on
   `threads.agentId`) feeds reflection injection; `memories` themselves are org/agent-scoped so
   recall spans threads by construction.
8. **Quotas:** none for v1 (enforceQuota is opt-in per route; verified safe to skip).
9. **RBAC:** new `memory` permission resource following the existing resource pattern; routes
   org+agent-scoped: `/_/orgs/:orgId/agents/:agentId/memories` (list/create/update/delete) and
   `POST .../memories/search`. Gated by a new `memories` feature flag (enabled).

## Schema

`memories` table (`repos/database/src/schemas/memories.ts`):
- `id` `mm_` prefix (nanoid pattern), `orgId` FK cascade NOT NULL, `agentId` FK cascade NOT NULL
- `kind` varchar: `fact | insight | reflection | compaction | roadmap` (default `fact`)
- `text` text NOT NULL, `importance` integer 1..10 default 5 (checked)
- `lastAccessedAt` timestamp default now
- `embedding` `vector(1536)` NULL (NULL = lexical-only row)
- `meta` jsonb (citations: `{threadId, messageId, scheduleId, model}`)
- timestamps via `...base`
- Indexes: `(org_id, agent_id)` btree; HNSW `embedding vector_cosine_ops`; GIN
  `to_tsvector('english', text)` expression index for the lexical path.

Scoring (SQL, in `Memory.searchScored`):
`score = pow(0.995, hours_since(greatest(last_accessed_at, created_at))) * importance * relevance`
where relevance = `1 - cosineDistance(embedding, :queryEmbedding)` when both sides have
embeddings, else `ts_rank` normalized, else `1` (pure recency x importance when no query).
Top-K (default 8); returned rows get `lastAccessedAt` bumped.

## Tasks

### Wave A: foundation (domain + database)
- A1 domain: `MemoryIdPrefix`, `EMemoryKind`, `TMemory` types, `Memory` model, `EAgentTool.memorySearch/.memoryWrite`, scoring constants (`MemoryRecencyDecay = 0.995`, `MemorySearchTopK = 8`, `MemoryMaxChars` caps), `memories` feature flag, `memory` perm resource + role grants.
- A2 database: schema + service (`searchScored`, `listRecentByAgent` on message service, roadmap helpers `getRoadmap`/`upsertRoadmap` = latest `kind=roadmap` row per agent), exports, extension bootstrap in CLI `pushSafe` + `CREATE EXTENSION` run on local+prod DBs, unit tests.

### Wave B: backend
- B1 `EmbeddingService` (provider resolution, openai+google clients via fetch, batch embed, null-safe) + unit tests.
- B2 memory endpoints (CRUD + search) with authorize/featureGate + tests.
- B3 executor: memory retrieval injection (`## Relevant memories`, `## Roadmap` sections in `buildCliCommand` AND api-brain prompt assembly), structured-output `tdsk-memories` block parsing + persistence (with citation meta + embedding backfill), tests.
- B4 `resolveAgentConfig`: build backend `MemoryProvider` (search/write via db service + EmbeddingService) and inject into AgentRunner init opts.

### Wave C: agent package (api brain)
- C1 `IMemoryProvider` type, `createMemoryTools`, `#buildTools` wiring, `contextManager.onSummary` + runner wiring, tests.

### Wave E: runtime-brain provider failover (prioritized 2026-07-03 after live Anthropic 529s)

The api brain already has `llmConfigs` failover (P1 A4); the RUNTIME brain (`claude -p` in the pod)
has none, so an Anthropic outage (529 Overloaded) kills the whole cycle. Give the runtime brain
the same resilience by failing over across the sandbox's priority-ordered ai providers. The
`claude` CLI speaks the Anthropic protocol and both ZAI (`ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`)
and OpenRouter (`https://openrouter.ai/api`) expose Anthropic-compatible endpoints — and
`RuntimeProviderEnvMap[claudeCode]` already maps both brands. The only missing piece is per-provider
env resolution + an executor failover loop.

- E1 `resolveProviderEnvChain` (backend util): resolve the linked ai providers into an ORDERED
  list `[{ brand, priority, env: Record<string,string> }]` (one env set PER provider — never merged,
  fixing the current collision on `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL`) plus a MERGED
  `placeholders` map across ALL providers (each domain-scoped; safe to inject all so egress can swap
  whichever token an attempt uses). Reuse the exact per-entry logic in `resolveProviderEnv`
  (static/option/secret, mitm/direct/file, fail-closed allowedDomains). Keep `resolveProviderEnv`
  for the connect/exec paths; `resolveProviderEnvChain` is additive.
- E2 startPod: inject ALL providers' placeholders + the PRIORITY-0 provider's env as the pod default
  (so an un-prefixed `claude -p` uses the primary). The pod must carry every fallback token so egress
  can swap it when a fallback attempt runs.
- E3 executor failover loop (replaces B3b same-provider retry with the superset): resolve the chain;
  run attempt on provider[0] via the normal command; on a transient-upstream failure
  (`isTransientUpstreamFailure`, reused from B3b) advance to provider[1], provider[2], … building
  the retry command with that provider's env vars prefixed inline
  (`env K=V … <promptCommand>` — inline env overrides the pod defaults; ANTHROPIC_AUTH_TOKEN
  precedence over CLAUDE_CODE_OAUTH_TOKEN means a ZAI/OR fallback cleanly overrides the Anthropic
  primary without unsetting). One brief same-provider retry per provider before advancing. Non-transient
  failures do not fail over. Log each failover with from/to brand + detected signal. The final
  attempt's result decides success/persistence. Success on a fallback still persists to the continuity
  thread and parses the memory block normally.
- E4 SECURITY: run the security-reviewer agent over the egress/placeholder changes (multiple tokens
  in one pod; each must stay domain-scoped; a fallback attempt must only be able to reach its own
  provider's domains). Verify no placeholder is injected unscoped and the primary token is never
  widened.
- E5 prod activation (data, post-deploy): link ZAI (`pv_sYKR6UZ`) priority 1 and OpenRouter
  (`pv_UdVXJdu`) priority 2 to sandbox `sb_i42zg3p` via `providerInputs` (order = priority), keeping
  Anthropic OAuth (`pv_hrn_ESR`) at priority 0. Secrets already seeded (`sc_Bz1BK1x`, `sc_yzoM9J6`).

### Wave D: verification + activation
- D1 `pnpm types` all repos; `pnpm test` all repos; hermeticity (`HOME=$(mktemp -d)`) for CI parity.
- D2 integration test: memories CRUD + lexical search against live backend (tier1).
- D3 prod activation (pure data, AFTER the user commits and deploy-on-main lands): embedding provider row (google + `TDSK_GAI_API_KEY` secret, `options.embeddingModel`), roadmap bootstrap memory, nightly reflection schedule (`0 8 * * *`), daily goal-proposal schedule (`0 6 * * *`), both on `ag_lvUbjp_`.
- D4 update SKILL.md files (backend/database/domain/agent) + spec/memory notes.

## Constraints

- No re-exports; exported types in `types/` dirs; PascalCase constants; no useEffect anywhere.
- Never commit (user commits); `pnpm push` for the new table is interactive (user runs it) but
  `CREATE EXTENSION` is idempotent and runs via psql/pushSafe.
- All work verified before "done": types + unit + integration on live K8s where applicable.
