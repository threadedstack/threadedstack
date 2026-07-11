import type { TKubeSandboxConfig } from '@tdsk/domain'

import { EImagePullPolicy, ESandboxRuntime, DefaultResources } from '@tdsk/domain'
import {
  OpsProjectId,
  OpsProjectName,
  CtoAgentId,
  EngOneAgentId,
  EngTwoAgentId,
} from '@TDB/seeds/agentSchedules'
import { ResidentActivations } from '@TDB/seeds/resident/activations'

/**
 * The BOOT RECIPE for a resident agent's body sandbox — the complete config a
 * seat needs to come up working, captured in git (mirrors the live CEO body,
 * the proven-working prod seat). Every field earned its place by breaking a
 * real activation when it was missing:
 *
 * - `image` + `imagePullPolicy`: the jobs PREWARM image (monorepo cloned +
 *   pnpm install baked at /workspace). The plain sandbox preset image has no
 *   /workspace projects, so the resident launcher finds nothing and crashes.
 * - `setupScript`: refreshes the baked clone (git fetch + hard reset to
 *   origin/main + frozen install) and wires the git push auth header from the
 *   pod's injected token, so the seat works on CURRENT main, not the image's
 *   build-time snapshot. The resident launcher (podManifest.ts) self-builds
 *   `@tdsk/resident` when dist is missing, so no build step belongs here.
 * - `initScript`: pre-accepts the claude-code workspace trust dialog for root
 *   (`claude -p` runs as root in the pod). Without it EVERY turn ends
 *   "did not complete cleanly".
 * - `envVars`: the egress MITM CA paths for curl/git (the sandbox
 *   entrypoint's cert mount), the sandbox marker, and the claude-code
 *   background-task kill switch (see [[project-agent-workcycle-background-bug]]).
 * - `promptCommand`: injects the agent's `{soul}` as the system prompt and
 *   skips permission prompts — a resident has no human to answer them.
 *
 * The `resident` activation flag deliberately stays OUT of this recipe:
 * activation is owned by `reconcileResidentActivations` (the inert-first
 * pattern — ship the body, THEN flip it live via the activations list).
 */
export const ResidentBodyConfig: TKubeSandboxConfig = {
  image: `ghcr.io/threadedstack/tdsk-jobs:latest`,
  imagePullPolicy: EImagePullPolicy.Always,
  runtime: ESandboxRuntime.claudeCode,
  sshEnabled: true,
  idleTimeoutMinutes: 120,
  resources: DefaultResources,
  envVars: {
    GODEBUG: `x509negativeserial=1`,
    IS_SANDBOX: `1`,
    CURL_CA_BUNDLE: `/usr/local/share/ca-certificates/tdsk-proxy.crt`,
    GIT_SSL_CAINFO: `/usr/local/share/ca-certificates/tdsk-proxy.crt`,
    CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: `1`,
  },
  initScript: `mkdir -p /root && printf '{"projects":{"/workspace":{"hasTrustDialogAccepted":true}}}' > /root/.claude.json && echo ready`,
  setupScript: `if [ -n "\${TDSK_GIT_0_TOKEN:-}" ]; then AUTH=$(printf "x-access-token:%s" "$TDSK_GIT_0_TOKEN" | base64 | tr -d "\\n"); git config http.extraHeader "Authorization: Basic $AUTH"; git config user.name "\${TDSK_GIT_USER_NAME:-ThreadedStack Steward}"; git config user.email "\${TDSK_GIT_USER_EMAIL:-steward@threadedstack.app}"; fi; git fetch origin main && git reset --hard origin/main && pnpm install --frozen-lockfile --prefer-offline`,
  promptCommand: `claude -p --dangerously-skip-permissions --append-system-prompt '{soul}' '{prompt}'`,
}

/**
 * The BOOT-CRITICAL subset of the recipe the deploy reconcile re-asserts onto
 * live body sandboxes (envVars is asserted separately, key-by-key). The other
 * recipe fields (runtime, sshEnabled, resources, idleTimeoutMinutes) seed a
 * new seat correctly but may legitimately diverge on a live one (a bigger
 * resource grant, a different idle window), so the reconcile leaves them alone.
 */
export const ResidentBootCriticalFields = [
  `image`,
  `imagePullPolicy`,
  `initScript`,
  `setupScript`,
  `promptCommand`,
] as const satisfies readonly (keyof TKubeSandboxConfig)[]

/** The agent + sandbox service slice the body reconcile needs. */
export type TResidentBodyService = {
  agent: {
    get: (id: string) => Promise<{
      data?: { environment?: Record<string, any> | null } | null
      error?: any
    }>
    getProjectConfig: (
      agentId: string,
      projectId: string
    ) => Promise<{ data?: any; error?: any }>
    addProject: (
      agentId: string,
      projectId: string,
      alias?: string
    ) => Promise<{ data?: any; error?: any }>
  }
  sandbox: {
    get: (
      id: string
    ) => Promise<{ data?: { config?: Record<string, any> | null } | null; error?: any }>
    update: (data: {
      id: string
      config: Record<string, any>
    }) => Promise<{ data?: any; error?: any }>
  }
}

export type TResidentBodiesAction = `asserted` | `unchanged` | `error`
export type TResidentBodiesBinding = `bound` | `unchanged` | `error`

export type TResidentBodiesSummary = {
  asserted: number
  unchanged: number
  bound: number
  errors: number
  results: {
    agentId: string
    sandboxId?: string
    action: TResidentBodiesAction
    binding?: TResidentBodiesBinding
    message?: string
  }[]
}

/** True when every boot-critical field (and every recipe envVar) already
 * carries the recipe value — the no-write fast path. */
const carriesRecipe = (config: Record<string, any>): boolean => {
  for (const field of ResidentBootCriticalFields)
    if (config[field] !== ResidentBodyConfig[field]) return false
  for (const [key, value] of Object.entries(ResidentBodyConfig.envVars ?? {}))
    if (config.envVars?.[key] !== value) return false
  return true
}

/**
 * Ensure each activated resident's body sandbox carries the boot recipe and
 * its agent is bound to the ops project. This is the durability half of the
 * recipe: seeds (fullorg.ts) give a NEW seat the recipe at creation; this
 * reconcile RE-ASSERTS it on every deploy so a config wipe, a preset-shaped
 * re-seed, or hand-edit drift can strand a seat for at most one deploy cycle
 * (exactly the guarantee `reconcileResidentActivations` gives the resident flag).
 *
 * Per agentId in the git-declared ResidentActivations list:
 * 1. Resolve the body sandbox via `agent.environment.sandboxId` (the SAME
 *    resolution the watchdog and the activation reconcile use).
 * 2. READ-MERGE-WRITE the boot-critical fields (image, imagePullPolicy,
 *    initScript, setupScript, promptCommand) plus the recipe's envVars KEYS
 *    onto the config. Every other key — the resident flag, runtimeCommand,
 *    idleTimeoutMinutes, resources, extra envVars — is preserved untouched.
 * 3. Bind the agent to the ops project (create-if-absent, never removed) so
 *    its resident API calls don't 403 with "Agent is not bound to this project".
 *
 * The boot-critical fields are re-asserted UNCONDITIONALLY (no evolved-marker
 * guard like resident_configs' `evolvedByAgent`): sandbox configs have no such
 * mechanism, agents never self-edit their body sandbox config (their evolution
 * surface is updateResidentConfig, which writes resident_configs records), so
 * any divergence on these fields is out-of-band drift — the exact failure class
 * this reconcile exists to erase. Fields residents MAY legitimately outgrow
 * (resources, idleTimeoutMinutes) are deliberately not asserted.
 *
 * Never throws — every outcome lands in the summary.
 */
export const reconcileResidentBodies = async (
  service: TResidentBodyService,
  log: (msg: string) => void = () => {}
): Promise<TResidentBodiesSummary> => {
  const summary: TResidentBodiesSummary = {
    asserted: 0,
    unchanged: 0,
    bound: 0,
    errors: 0,
    results: [],
  }

  const fail = (agentId: string, message?: string, sandboxId?: string) => {
    summary.errors++
    summary.results.push({ agentId, sandboxId, action: `error`, message })
    log(`  ❌ resident body ${agentId} — ${message ?? `unknown error`}`)
  }

  for (const agentId of ResidentActivations) {
    try {
      const agentRes = await service.agent.get(agentId)
      if (agentRes.error) {
        fail(agentId, `agent lookup failed: ${agentRes.error.message}`)
        continue
      }
      const sandboxId = agentRes.data?.environment?.sandboxId as string | undefined
      if (!sandboxId) {
        fail(agentId, `agent has no environment.sandboxId (no body sandbox)`)
        continue
      }

      const sbRes = await service.sandbox.get(sandboxId)
      if (sbRes.error) {
        fail(agentId, `sandbox lookup failed: ${sbRes.error.message}`, sandboxId)
        continue
      }
      if (!sbRes.data) {
        fail(agentId, `body sandbox ${sandboxId} not found`, sandboxId)
        continue
      }

      const config = (sbRes.data.config ?? {}) as Record<string, any>
      let action: TResidentBodiesAction = `unchanged`
      if (carriesRecipe(config)) {
        summary.unchanged++
        log(`  ➖ resident body ${agentId} — recipe already on ${sandboxId}`)
      } else {
        // Read-merge-write: assert ONLY the boot-critical fields + the
        // recipe's envVars keys; every other config key rides along untouched.
        const updated = await service.sandbox.update({
          id: sandboxId,
          config: {
            ...config,
            image: ResidentBodyConfig.image,
            imagePullPolicy: ResidentBodyConfig.imagePullPolicy,
            initScript: ResidentBodyConfig.initScript,
            setupScript: ResidentBodyConfig.setupScript,
            promptCommand: ResidentBodyConfig.promptCommand,
            envVars: { ...config.envVars, ...ResidentBodyConfig.envVars },
          },
        })
        if (updated.error) {
          fail(agentId, `recipe assert failed: ${updated.error.message}`, sandboxId)
          continue
        }
        action = `asserted`
        summary.asserted++
        log(`  ✅ resident body ${agentId} — boot recipe asserted on ${sandboxId}`)
      }

      // Ops-project binding (create-if-absent, additive only): without the
      // agent_projects row every resident API call 403s.
      let binding: TResidentBodiesBinding = `unchanged`
      const linked = await service.agent.getProjectConfig(agentId, OpsProjectId)
      if (linked.error) {
        const added = await service.agent.addProject(
          agentId,
          OpsProjectId,
          OpsProjectName
        )
        if (added.error) {
          binding = `error`
          summary.errors++
          log(
            `  ❌ resident body ${agentId} — ops project bind failed: ${added.error.message}`
          )
        } else {
          binding = `bound`
          summary.bound++
          log(`  ✅ resident body ${agentId} — bound to ops project ${OpsProjectId}`)
        }
      }

      summary.results.push({
        agentId,
        sandboxId,
        action,
        binding,
        ...(binding === `error` && { message: `ops project bind failed` }),
      })
    } catch (err: any) {
      fail(agentId, err?.message)
    }
  }

  return summary
}

/**
 * The LLM provider fallback chain a resident body authenticates through.
 * Resident LLM auth flows through SANDBOX provider links ONLY (working
 * residents have ZERO agent_providers rows): the pod injects each linked
 * provider's secret via RuntimeProviderEnvMap (the anthropic-brand OAuth link
 * becomes CLAUDE_CODE_OAUTH_TOKEN), with the GLM and OpenRouter links as
 * priority-ordered fallbacks. Provider ids are PROD-RANDOM (minted at provider
 * creation), so the chain is asserted BY NAME — the only durable handle a git
 * seed has on an out-of-band prod provider. When a name is absent the reconcile
 * is FAIL-SOFT: on a fresh org the seed providers remain linked and the seat
 * still boots — degraded LLM auth is a known state the sensor's silent-turns
 * signal catches.
 */
export const ResidentProviderChain: { name: string; priority: number }[] = [
  { name: `Claude Subscription OAuth`, priority: 0 },
  { name: `ZAI GLM (fallback)`, priority: 1 },
  { name: `OpenRouter (fallback)`, priority: 2 },
]

/** The agent + provider + sandbox-provider-links service slice the chain
 * reconcile needs. */
export type TResidentChainService = {
  agent: {
    get: (id: string) => Promise<{
      data?: { environment?: Record<string, any> | null } | null
      error?: any
    }>
  }
  provider: {
    findByName: (name: string) => Promise<{ data?: { id: string } | null; error?: any }>
  }
  links: {
    list: (sandboxId: string) => Promise<{
      data?: { providerId: string; priority: number }[]
      error?: any
    }>
    replace: (
      sandboxId: string,
      links: { providerId: string; priority: number }[]
    ) => Promise<{ error?: any }>
  }
}

export type TResidentChainAction = `asserted` | `unchanged` | `skipped` | `error`

export type TResidentChainSummary = {
  asserted: number
  unchanged: number
  skipped: number
  errors: number
  results: {
    agentId: string
    sandboxId?: string
    action: TResidentChainAction
    message?: string
  }[]
}

/** True when both link sets carry the same providerId+priority pairs,
 * order-insensitive. */
const sameChain = (
  a: { providerId: string; priority: number }[],
  b: { providerId: string; priority: number }[]
): boolean => {
  if (a.length !== b.length) return false
  const key = (links: { providerId: string; priority: number }[]) =>
    links
      .map((l) => `${l.providerId}:${l.priority ?? 0}`)
      .sort()
      .join(`|`)
  return key(a) === key(b)
}

/**
 * Ensure each activated resident's body sandbox carries the REAL provider chain
 * (ResidentProviderChain) as its sandbox provider links. This closes the last
 * seed-vs-prod drift class: the git seeds link the SEED providers (placeholder
 * secrets), so a fresh seat gets continuous LLM 502s until its links are
 * hand-mirrored from a working seat — this reconcile does that mirroring on
 * every deploy, by NAME (ids are prod-local).
 *
 * Per agentId in the git-declared ResidentActivations list:
 * 1. Resolve the body sandbox via `agent.environment.sandboxId` (the SAME
 *    resolution reconcileResidentBodies and the watchdog use).
 * 2. Resolve EVERY chain name via `provider.findByName`. If ANY name resolves
 *    to nothing, the seat is `skipped` (fail-soft — the links are NOT touched,
 *    a partial chain would strip a seat's working fallbacks).
 * 3. Compare the current links to the desired providerId+priority set,
 *    ORDER-INSENSITIVE. Equal → `unchanged`. Else REPLACE the full link set in
 *    one slice call (the runner does delete+insert) → `asserted`.
 *
 * Links apply at POD CREATION (the pod manifest injects provider secrets when
 * the pod is built), so an asserted chain reaches a drifted LIVE pod only on
 * recreation — the watchdog's natural churn or a deliberate delete picks it up.
 *
 * Never throws — every outcome lands in the summary.
 */
export const reconcileResidentProviderChains = async (
  service: TResidentChainService,
  log: (msg: string) => void = () => {}
): Promise<TResidentChainSummary> => {
  const summary: TResidentChainSummary = {
    asserted: 0,
    unchanged: 0,
    skipped: 0,
    errors: 0,
    results: [],
  }

  const fail = (agentId: string, message?: string, sandboxId?: string) => {
    summary.errors++
    summary.results.push({ agentId, sandboxId, action: `error`, message })
    log(`  ❌ resident chain ${agentId} — ${message ?? `unknown error`}`)
  }

  for (const agentId of ResidentActivations) {
    try {
      const agentRes = await service.agent.get(agentId)
      if (agentRes.error) {
        fail(agentId, `agent lookup failed: ${agentRes.error.message}`)
        continue
      }
      const sandboxId = agentRes.data?.environment?.sandboxId as string | undefined
      if (!sandboxId) {
        fail(agentId, `agent has no environment.sandboxId (no body sandbox)`)
        continue
      }

      // Resolve EVERY chain name BEFORE touching links: one unresolvable name
      // makes the whole chain unprovable, so the seat's links stay untouched.
      const desired: { providerId: string; priority: number }[] = []
      const missing: string[] = []
      let lookupError: string | undefined
      for (const { name, priority } of ResidentProviderChain) {
        const found = await service.provider.findByName(name)
        if (found.error) {
          lookupError = `provider lookup "${name}" failed: ${found.error.message}`
          break
        }
        if (!found.data?.id) missing.push(name)
        else desired.push({ providerId: found.data.id, priority })
      }
      if (lookupError) {
        fail(agentId, lookupError, sandboxId)
        continue
      }
      if (missing.length) {
        summary.skipped++
        summary.results.push({
          agentId,
          sandboxId,
          action: `skipped`,
          message: `provider name(s) not found: ${missing.join(`, `)}`,
        })
        log(
          `  ⏭️  resident chain ${agentId} — skipped, missing provider(s): ${missing.join(`, `)}`
        )
        continue
      }

      const current = await service.links.list(sandboxId)
      if (current.error) {
        fail(agentId, `links list failed: ${current.error.message}`, sandboxId)
        continue
      }
      if (sameChain(current.data ?? [], desired)) {
        summary.unchanged++
        summary.results.push({ agentId, sandboxId, action: `unchanged` })
        log(`  ➖ resident chain ${agentId} — chain already on ${sandboxId}`)
        continue
      }

      const replaced = await service.links.replace(sandboxId, desired)
      if (replaced.error) {
        fail(agentId, `links replace failed: ${replaced.error.message}`, sandboxId)
        continue
      }
      summary.asserted++
      summary.results.push({ agentId, sandboxId, action: `asserted` })
      log(`  ✅ resident chain ${agentId} — provider chain asserted on ${sandboxId}`)
    } catch (err: any) {
      fail(agentId, err?.message)
    }
  }

  return summary
}

/**
 * The GIT provider a code-pushing resident authenticates its `gh`/`git`
 * operations through, resolved BY NAME (ids are prod-local, same as the LLM
 * chain). The link is a `sandbox_project_providers` row scoped to the ops
 * project: the pod entrypoint injects the provider's token as
 * `TDSK_GIT_0_TOKEN`, which the body recipe's setupScript turns into the git
 * `http.extraHeader` auth. Without it a seat clones read-only and every `gh pr
 * create` / `git push` fails unauthenticated — the last seed-vs-prod drift class
 * (the existing seats were linked by hand; this reconcile makes it reproducible).
 */
export const ResidentRepoProviderName = `ThreadedStack Repo`

/** The branch a code-pushing seat's repo link tracks (matches the live seats). */
export const ResidentRepoBranch = `main`

/**
 * The resident seats that push code and therefore need the git repo link. The
 * strategy seats (CEO/CMO) operate on records + external connectors, never the
 * monorepo, so they deliberately carry NO repo link. Adding an engineer seat is
 * a one-line append here (plus ResidentActivations + a config seed).
 */
export const ResidentRepoSeats: string[] = [CtoAgentId, EngOneAgentId, EngTwoAgentId]

/** The agent + provider + sandbox-project-provider-links slice the repo-link
 * reconcile needs. `list`/`add` operate on the `sandbox_project_providers`
 * table (create-if-absent — a single fixed link, never a chain replace). */
export type TResidentRepoLinkService = {
  agent: {
    get: (id: string) => Promise<{
      data?: { environment?: Record<string, any> | null } | null
      error?: any
    }>
  }
  provider: {
    findByName: (name: string) => Promise<{ data?: { id: string } | null; error?: any }>
  }
  repoLinks: {
    list: (
      sandboxId: string,
      projectId: string
    ) => Promise<{ data?: { providerId: string }[]; error?: any }>
    add: (link: {
      sandboxId: string
      projectId: string
      providerId: string
      priority: number
      branch: string
    }) => Promise<{ error?: any }>
  }
}

export type TResidentRepoLinkAction = `added` | `unchanged` | `skipped` | `error`

export type TResidentRepoLinkSummary = {
  added: number
  unchanged: number
  skipped: number
  errors: number
  results: {
    agentId: string
    sandboxId?: string
    action: TResidentRepoLinkAction
    message?: string
  }[]
}

/**
 * Ensure each code-pushing resident seat carries the git repo link
 * (`sandbox_project_providers` → the ThreadedStack Repo provider, scoped to the
 * ops project). This closes drift-5: the git seeds do not link the repo
 * provider onto a body sandbox, so a fresh code-pushing seat clones read-only
 * and cannot push or open PRs until the link is hand-added from a working seat —
 * this reconcile adds it on every deploy, by NAME (ids are prod-local).
 *
 * Per agentId in ResidentRepoSeats:
 * 1. Resolve the body sandbox via `agent.environment.sandboxId` (the SAME
 *    resolution the other body reconciles use).
 * 2. Resolve the repo provider by NAME. Absent → `skipped` (fail-soft, on a
 *    fresh org the provider may not exist yet; a seat with no push auth is a
 *    known degraded state the sensor catches, never a reason to fail a deploy).
 * 3. If a link to that provider already exists for (sandbox, ops project) →
 *    `unchanged`. Else ADD it (create-if-absent, priority 0, branch main). The
 *    unique index on (sandbox, project, provider) makes the add idempotent.
 *
 * The link applies at POD CREATION (the entrypoint injects the git token when
 * the pod is built), so an added link reaches a live seat on its next pod
 * recreation — the watchdog's natural churn or a deliberate delete.
 *
 * Never throws — every outcome lands in the summary.
 */
export const reconcileResidentRepoLinks = async (
  service: TResidentRepoLinkService,
  log: (msg: string) => void = () => {}
): Promise<TResidentRepoLinkSummary> => {
  const summary: TResidentRepoLinkSummary = {
    added: 0,
    unchanged: 0,
    skipped: 0,
    errors: 0,
    results: [],
  }

  const fail = (agentId: string, message?: string, sandboxId?: string) => {
    summary.errors++
    summary.results.push({ agentId, sandboxId, action: `error`, message })
    log(`  ❌ resident repo link ${agentId} — ${message ?? `unknown error`}`)
  }

  for (const agentId of ResidentRepoSeats) {
    try {
      const agentRes = await service.agent.get(agentId)
      if (agentRes.error) {
        fail(agentId, `agent lookup failed: ${agentRes.error.message}`)
        continue
      }
      const sandboxId = agentRes.data?.environment?.sandboxId as string | undefined
      if (!sandboxId) {
        fail(agentId, `agent has no environment.sandboxId (no body sandbox)`)
        continue
      }

      const found = await service.provider.findByName(ResidentRepoProviderName)
      if (found.error) {
        fail(agentId, `provider lookup failed: ${found.error.message}`, sandboxId)
        continue
      }
      if (!found.data?.id) {
        summary.skipped++
        summary.results.push({
          agentId,
          sandboxId,
          action: `skipped`,
          message: `repo provider "${ResidentRepoProviderName}" not found`,
        })
        log(
          `  ⏭️  resident repo link ${agentId} — skipped, provider "${ResidentRepoProviderName}" not found`
        )
        continue
      }
      const providerId = found.data.id

      const current = await service.repoLinks.list(sandboxId, OpsProjectId)
      if (current.error) {
        fail(agentId, `repo links list failed: ${current.error.message}`, sandboxId)
        continue
      }
      if ((current.data ?? []).some((l) => l.providerId === providerId)) {
        summary.unchanged++
        summary.results.push({ agentId, sandboxId, action: `unchanged` })
        log(`  ➖ resident repo link ${agentId} — already on ${sandboxId}`)
        continue
      }

      const added = await service.repoLinks.add({
        sandboxId,
        projectId: OpsProjectId,
        providerId,
        priority: 0,
        branch: ResidentRepoBranch,
      })
      if (added.error) {
        fail(agentId, `repo link add failed: ${added.error.message}`, sandboxId)
        continue
      }
      summary.added++
      summary.results.push({ agentId, sandboxId, action: `added` })
      log(`  ✅ resident repo link ${agentId} — added on ${sandboxId}`)
    } catch (err: any) {
      fail(agentId, err?.message)
    }
  }

  return summary
}
