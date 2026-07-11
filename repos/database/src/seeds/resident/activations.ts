import {
  CeoAgentId,
  CmoAgentId,
  CtoAgentId,
  EngOneAgentId,
  EngTwoAgentId,
  EngThreeAgentId,
} from '@TDB/seeds/agentSchedules'

/**
 * Declarative resident ACTIVATION list — the agentIds whose body sandbox must be
 * in resident mode (`sandbox.config.resident = { agentId }`, the flag the
 * watchdog activates off).
 *
 * Kept SEPARATE from the resident config seeds (seeds/resident/records.ts) on
 * purpose: a config can exist while its sandbox is NOT activated — the
 * inert-first pattern (ship the config, verify it, THEN activate by adding the
 * agentId here). Activation used to be a manual SQL flip of
 * `sandbox.config.resident` that no reconcile ever re-asserted, so a sandbox
 * config reset (a PUT that dropped the key, a re-seed) could silently strand a
 * live resident — with its crons already handed off, the seat would then do
 * nothing. This list makes activation git-declared and durable: the reconcile
 * below re-sets the flag on every deploy, so a wipe can strand a resident for at
 * most one deploy cycle. Every activated agent MUST also have a resident config
 * seed (records.ts) + a body sandbox (`agent.environment.sandboxId`).
 */
export const ResidentActivations: string[] = [
  CmoAgentId,
  CeoAgentId,
  // The realtime dev team (Phase 2 go-live): the lead + two engineer seats.
  // Prerequisites verified in prod before this flip: resident_configs seeded,
  // the 10 dev* Functions reconciled, dev_tasks collection live, and the three
  // agents + body sandboxes + provider links created (brain=runtime,
  // environment.sandboxId set — the watchdog's resolution anchor).
  CtoAgentId,
  EngOneAgentId,
  EngTwoAgentId,
  EngThreeAgentId,
]

/** The agent + sandbox service slice the activation reconcile needs. */
export type TResidentActivationService = {
  agent: {
    get: (id: string) => Promise<{
      data?: { environment?: Record<string, any> | null } | null
      error?: any
    }>
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

export type TResidentActivationsAction = `activated` | `unchanged` | `error`

export type TResidentActivationsSummary = {
  activated: number
  unchanged: number
  errors: number
  results: {
    agentId: string
    sandboxId?: string
    action: TResidentActivationsAction
    message?: string
  }[]
}

/**
 * Ensure each activated resident's body sandbox is in resident mode. Per agentId:
 * resolve its body sandbox via the agent's `environment.sandboxId` (the SAME
 * resolution the watchdog uses, so activation targets exactly the sandbox the
 * watchdog boots off), then set `config.resident = { agentId }` unless already so.
 * READ-MERGE-WRITE the FULL config so no other config key is dropped. ADDITIVE
 * ONLY — it never REMOVES the flag (deactivation is a deliberate act, not a
 * reconcile side effect), so a mislisted or removed agentId can never strand a
 * live resident by clearing its flag. A binding to the WRONG agentId is corrected
 * (re-bound to the listed agent). Never throws — every outcome is in the summary.
 */
export const reconcileResidentActivations = async (
  service: TResidentActivationService,
  log: (msg: string) => void = () => {}
): Promise<TResidentActivationsSummary> => {
  const summary: TResidentActivationsSummary = {
    activated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (agentId: string, message?: string) => {
    summary.errors++
    summary.results.push({ agentId, action: `error`, message })
    log(`  ❌ resident activation ${agentId} — ${message ?? `unknown error`}`)
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
        fail(agentId, `sandbox lookup failed: ${sbRes.error.message}`)
        continue
      }
      if (!sbRes.data) {
        fail(agentId, `body sandbox ${sandboxId} not found`)
        continue
      }

      const config = (sbRes.data.config ?? {}) as Record<string, any>
      if (config.resident && config.resident.agentId === agentId) {
        summary.unchanged++
        summary.results.push({ agentId, sandboxId, action: `unchanged` })
        log(`  ➖ resident activation ${agentId} — already active on ${sandboxId}`)
        continue
      }

      // Read-merge-write: preserve every other config key, set/repair resident.
      const updated = await service.sandbox.update({
        id: sandboxId,
        config: { ...config, resident: { agentId } },
      })
      if (updated.error) {
        fail(agentId, `activate failed: ${updated.error.message}`)
        continue
      }
      summary.activated++
      summary.results.push({ agentId, sandboxId, action: `activated` })
      log(`  ✅ resident activation ${agentId} — resident mode set on ${sandboxId}`)
    } catch (err: any) {
      fail(agentId, err?.message)
    }
  }

  return summary
}
