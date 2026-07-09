import { describe, it, expect } from 'vitest'

import { CeoAgentId, CmoAgentId } from '@TDB/seeds/agentSchedules'
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

/** Wire the two activated agents to body sandboxes with the given starting config. */
const seedBodies = (
  fake: ReturnType<typeof makeFakeService>,
  cmoConfig: Record<string, any>,
  ceoConfig: Record<string, any>
) => {
  fake.agents.set(CmoAgentId, { environment: { sandboxId: `sb_cmo0001` } })
  fake.agents.set(CeoAgentId, { environment: { sandboxId: `sb_ceo0001` } })
  fake.sandboxes.set(`sb_cmo0001`, { config: cmoConfig })
  fake.sandboxes.set(`sb_ceo0001`, { config: ceoConfig })
}

describe(`ResidentActivations`, () => {
  it(`declares the CMO + CEO as the activated residents`, () => {
    expect(ResidentActivations).toEqual([CmoAgentId, CeoAgentId])
  })
})

describe(`reconcileResidentActivations`, () => {
  it(`sets config.resident on a not-yet-active sandbox, preserving every other key`, async () => {
    const fake = makeFakeService()
    seedBodies(
      fake,
      { image: `img-cmo`, runtime: `claude-code`, envVars: { A: `1` } },
      { image: `img-ceo`, runtime: `claude-code` }
    )

    const summary = await reconcileResidentActivations(fake.service)

    expect(summary).toMatchObject({ activated: 2, unchanged: 0, errors: 0 })
    const cmo = fake.sandboxes.get(`sb_cmo0001`)!.config!
    expect(cmo.resident).toEqual({ agentId: CmoAgentId })
    // Every other key preserved (read-merge-write, never a bare replace).
    expect(cmo.image).toBe(`img-cmo`)
    expect(cmo.runtime).toBe(`claude-code`)
    expect(cmo.envVars).toEqual({ A: `1` })
    expect(fake.sandboxes.get(`sb_ceo0001`)!.config!.resident).toEqual({
      agentId: CeoAgentId,
    })
    expect(fake.sandboxes.get(`sb_ceo0001`)!.config!.image).toBe(`img-ceo`)
  })

  it(`is idempotent — a sandbox already bound to the right agent reports unchanged and writes nothing`, async () => {
    const fake = makeFakeService()
    seedBodies(
      fake,
      { image: `img-cmo`, resident: { agentId: CmoAgentId } },
      { image: `img-ceo`, resident: { agentId: CeoAgentId } }
    )
    const before = JSON.parse(JSON.stringify([...fake.sandboxes]))

    const summary = await reconcileResidentActivations(fake.service)

    expect(summary).toMatchObject({ activated: 0, unchanged: 2, errors: 0 })
    expect(JSON.parse(JSON.stringify([...fake.sandboxes]))).toEqual(before)
  })

  it(`RE-BINDS a sandbox whose resident flag points at the WRONG agent`, async () => {
    const fake = makeFakeService()
    // CMO body mis-bound to some other agent; CEO already correct.
    seedBodies(
      fake,
      { image: `img-cmo`, resident: { agentId: `ag_wrong01` } },
      { image: `img-ceo`, resident: { agentId: CeoAgentId } }
    )

    const summary = await reconcileResidentActivations(fake.service)

    // CMO re-bound (activated), CEO untouched (unchanged).
    expect(summary).toMatchObject({ activated: 1, unchanged: 1, errors: 0 })
    expect(fake.sandboxes.get(`sb_cmo0001`)!.config!.resident).toEqual({
      agentId: CmoAgentId,
    })
    expect(summary.results.find((r) => r.agentId === CmoAgentId)?.action).toBe(
      `activated`
    )
  })

  it(`captures failures without throwing — missing agent, missing sandboxId, missing sandbox`, async () => {
    const fake = makeFakeService()
    // CMO agent exists + points at a sandbox that does NOT exist.
    fake.agents.set(CmoAgentId, { environment: { sandboxId: `sb_cmo0001` } })
    // CEO agent has no environment.sandboxId at all.
    fake.agents.set(CeoAgentId, { environment: {} })

    const summary = await reconcileResidentActivations(fake.service)

    expect(summary).toMatchObject({ activated: 0, unchanged: 0, errors: 2 })
    const cmo = summary.results.find((r) => r.agentId === CmoAgentId)!
    expect(cmo.action).toBe(`error`)
    expect(cmo.message).toContain(`body sandbox sb_cmo0001 not found`)
    const ceo = summary.results.find((r) => r.agentId === CeoAgentId)!
    expect(ceo.action).toBe(`error`)
    expect(ceo.message).toContain(`no environment.sandboxId`)
  })

  it(`surfaces an update failure as an error, not a throw`, async () => {
    const fake = makeFakeService()
    seedBodies(fake, { image: `img-cmo` }, { image: `img-ceo` })
    const failing = {
      agent: fake.service.agent,
      sandbox: {
        get: fake.service.sandbox.get,
        update: async () => ({ error: new Error(`write refused`) }),
      },
    }

    const summary = await reconcileResidentActivations(failing)

    expect(summary.errors).toBe(2)
    expect(summary.results.every((r) => r.action === `error`)).toBe(true)
    expect(summary.results[0].message).toContain(`write refused`)
  })
})
