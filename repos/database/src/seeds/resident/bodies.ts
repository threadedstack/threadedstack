import type { TKubeSandboxConfig } from '@tdsk/domain'

import { EImagePullPolicy, ESandboxRuntime, DefaultResources } from '@tdsk/domain'
import { OpsProjectId, OpsProjectName } from '@TDB/seeds/agentSchedules'
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
