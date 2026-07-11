import { describe, it, expect } from 'vitest'

import {
  CeoAgentId,
  CmoAgentId,
  CtoAgentId,
  EngOneAgentId,
  EngTwoAgentId,
  EngThreeAgentId,
} from '@TDB/seeds/agentSchedules'
import {
  ResidentActivations,
  reconcileResidentActivations,
} from '@TDB/seeds/resident/activations'

/**
 * In-memory fake of the agent + sandbox service slice: agents resolve to a body
 * sandbox via `environment.sandboxId`, and sandboxes hold a mutable `config`.
 * Enough to prove the activation reconcile sets `config.resident` (preserving
 * other keys), no-ops when already active, re-binds a wrong agentId, and captures
 * every failure without a live DB.
 */
const makeFakeService = () => {
  const agents = new Map<string, { environment?: Record<string, any> | null }>()
  const sandboxes = new Map<string, { config?: Record<string, any> | null }>()
  return {
    agents,
    sandboxes,
    service: {
      agent: {
        get: async (id: string) => ({ data: agents.get(id) ?? null }),
      },
      sandbox: {
        get: async (id: string) => ({ data: sandboxes.get(id) ?? null }),
        update: async ({ id, config }: { id: string; config: Record<string, any> }) => {
          const sb = sandboxes.get(id)
          if (!sb) return { error: new Error(`sandbox not found`) }
          sb.config = config
          return { data: { id, config } }
        },
      },
    },
  }
}

/** Every activated seat's body sandbox id, keyed by agent id. */
const BodyByAgent: Record<string, string> = {
  [CmoAgentId]: `sb_cmo0001`,
  [CeoAgentId]: `sb_ceo0001`,
  [CtoAgentId]: `sb_cto0001`,
  [EngOneAgentId]: `sb_eng0001`,
  [EngTwoAgentId]: `sb_eng0002`,
  [EngThreeAgentId]: `sb_eng0003`,
}

/** Wire the activated agents to body sandboxes with the given starting configs
 * (per-agent overrides; every listed seat gets a default config otherwise). */
const seedBodies = (
  fake: ReturnType<typeof makeFakeService>,
  configs: Record<string, Record<string, any>> = {}
) => {
  for (const agentId of ResidentActivations) {
    const sandboxId = BodyByAgent[agentId]
    fake.agents.set(agentId, { environment: { sandboxId } })
    fake.sandboxes.set(sandboxId, {
      config: configs[agentId] ?? { image: `img-${agentId}` },
    })
  }
}

describe(`ResidentActivations`, () => {
  it(`declares the exec seats AND the realtime dev team as the activated residents`, () => {
    expect(ResidentActivations).toEqual([
      CmoAgentId,
      CeoAgentId,
      CtoAgentId,
      EngOneAgentId,
      EngTwoAgentId,
      EngThreeAgentId,
    ])
  })
})

describe(`reconcileResidentActivations`, () => {
  it(`sets config.resident on a not-yet-active sandbox, preserving every other key`, async () => {
    const fake = makeFakeService()
    seedBodies(fake, {
      [CmoAgentId]: { image: `img-cmo`, runtime: `claude-code`, envVars: { A: `1` } },
    })

    const summary = await reconcileResidentActivations(fake.service)

    expect(summary).toMatchObject({
      activated: ResidentActivations.length,
      unchanged: 0,
      errors: 0,
    })
    const cmo = fake.sandboxes.get(`sb_cmo0001`)!.config!
    expect(cmo.resident).toEqual({ agentId: CmoAgentId })
    // Every other key preserved (read-merge-write, never a bare replace).
    expect(cmo.image).toBe(`img-cmo`)
    expect(cmo.runtime).toBe(`claude-code`)
    expect(cmo.envVars).toEqual({ A: `1` })
    // Every listed seat is bound to its own agent — incl. the dev-team seats.
    for (const agentId of ResidentActivations)
      expect(fake.sandboxes.get(BodyByAgent[agentId])!.config!.resident).toEqual({
        agentId,
      })
  })

  it(`is idempotent — a sandbox already bound to the right agent reports unchanged and writes nothing`, async () => {
    const fake = makeFakeService()
    const configs = Object.fromEntries(
      ResidentActivations.map((agentId) => [
        agentId,
        { image: `img-${agentId}`, resident: { agentId } },
      ])
    )
    seedBodies(fake, configs)
    const before = JSON.parse(JSON.stringify([...fake.sandboxes]))

    const summary = await reconcileResidentActivations(fake.service)

    expect(summary).toMatchObject({
      activated: 0,
      unchanged: ResidentActivations.length,
      errors: 0,
    })
    expect(JSON.parse(JSON.stringify([...fake.sandboxes]))).toEqual(before)
  })

  it(`RE-BINDS a sandbox whose resident flag points at the WRONG agent`, async () => {
    const fake = makeFakeService()
    // Every seat already correct EXCEPT the CMO body, mis-bound to another agent.
    const configs = Object.fromEntries(
      ResidentActivations.map((agentId) => [
        agentId,
        { image: `img-${agentId}`, resident: { agentId } },
      ])
    )
    configs[CmoAgentId] = { image: `img-cmo`, resident: { agentId: `ag_wrong01` } }
    seedBodies(fake, configs)

    const summary = await reconcileResidentActivations(fake.service)

    // CMO re-bound (activated), everyone else untouched (unchanged).
    expect(summary).toMatchObject({
      activated: 1,
      unchanged: ResidentActivations.length - 1,
      errors: 0,
    })
    expect(fake.sandboxes.get(`sb_cmo0001`)!.config!.resident).toEqual({
      agentId: CmoAgentId,
    })
    expect(summary.results.find((r) => r.agentId === CmoAgentId)?.action).toBe(
      `activated`
    )
  })

  it(`captures failures without throwing — missing agent, missing sandboxId, missing sandbox`, async () => {
    const fake = makeFakeService()
    // CMO agent exists + points at a sandbox that does NOT exist; CEO agent has
    // no environment.sandboxId; every other listed seat is absent entirely.
    fake.agents.set(CmoAgentId, { environment: { sandboxId: `sb_cmo0001` } })
    fake.agents.set(CeoAgentId, { environment: {} })

    const summary = await reconcileResidentActivations(fake.service)

    expect(summary).toMatchObject({
      activated: 0,
      unchanged: 0,
      errors: ResidentActivations.length,
    })
    const cmo = summary.results.find((r) => r.agentId === CmoAgentId)!
    expect(cmo.action).toBe(`error`)
    expect(cmo.message).toContain(`body sandbox sb_cmo0001 not found`)
    const ceo = summary.results.find((r) => r.agentId === CeoAgentId)!
    expect(ceo.action).toBe(`error`)
    expect(ceo.message).toContain(`no environment.sandboxId`)
  })

  it(`surfaces an update failure as an error, not a throw`, async () => {
    const fake = makeFakeService()
    seedBodies(fake)
    const failing = {
      agent: fake.service.agent,
      sandbox: {
        get: fake.service.sandbox.get,
        update: async () => ({ error: new Error(`write refused`) }),
      },
    }

    const summary = await reconcileResidentActivations(failing)

    expect(summary.errors).toBe(ResidentActivations.length)
    expect(summary.results.every((r) => r.action === `error`)).toBe(true)
    expect(summary.results[0].message).toContain(`write refused`)
  })
})
