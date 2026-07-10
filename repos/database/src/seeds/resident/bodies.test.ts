import { describe, it, expect } from 'vitest'

import {
  CeoAgentId,
  CmoAgentId,
  CtoAgentId,
  EngOneAgentId,
  EngTwoAgentId,
  OpsProjectId,
  OpsProjectName,
} from '@TDB/seeds/agentSchedules'
import { ResidentActivations } from '@TDB/seeds/resident/activations'
import {
  ResidentBodyConfig,
  ResidentProviderChain,
  reconcileResidentBodies,
  ResidentBootCriticalFields,
  reconcileResidentProviderChains,
} from '@TDB/seeds/resident/bodies'

/**
 * In-memory fake of the agent + sandbox service slice (mirrors
 * activations.test.ts): agents resolve to a body sandbox via
 * `environment.sandboxId`, sandboxes hold a mutable `config`, and
 * agent-project links live in a Set. Enough to prove the body reconcile
 * asserts the boot recipe (preserving every other key), no-ops when the recipe
 * is present, creates the ops-project binding if absent, and captures every
 * failure without a live DB.
 */
const makeFakeService = () => {
  const agents = new Map<string, { environment?: Record<string, any> | null }>()
  const sandboxes = new Map<string, { config?: Record<string, any> | null }>()
  const links = new Set<string>()
  const linkKey = (agentId: string, projectId: string) => `${agentId}:${projectId}`
  return {
    agents,
    sandboxes,
    links,
    linkKey,
    service: {
      agent: {
        get: async (id: string) => ({ data: agents.get(id) ?? null }),
        getProjectConfig: async (agentId: string, projectId: string) =>
          links.has(linkKey(agentId, projectId))
            ? { data: { agentId, projectId } }
            : { error: new Error(`Agent is not linked to this project`) },
        addProject: async (agentId: string, projectId: string, alias?: string) => {
          links.add(linkKey(agentId, projectId))
          return { data: { agentId, projectId, alias }, error: null }
        },
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
}

/** A config already carrying the full boot recipe (plus any extra keys). */
const recipeConfig = (extra: Record<string, any> = {}) => ({
  ...ResidentBodyConfig,
  ...extra,
  envVars: { ...ResidentBodyConfig.envVars, ...(extra.envVars ?? {}) },
})

/** Wire the activated agents to body sandboxes with the given starting configs
 * (per-agent overrides; every listed seat gets a recipe config otherwise) and
 * pre-link every agent to the ops project unless `linked` is false. */
const seedBodies = (
  fake: ReturnType<typeof makeFakeService>,
  configs: Record<string, Record<string, any>> = {},
  linked = true
) => {
  for (const agentId of ResidentActivations) {
    const sandboxId = BodyByAgent[agentId]
    fake.agents.set(agentId, { environment: { sandboxId } })
    fake.sandboxes.set(sandboxId, { config: configs[agentId] ?? recipeConfig() })
    if (linked) fake.links.add(fake.linkKey(agentId, OpsProjectId))
  }
}

describe(`ResidentBodyConfig`, () => {
  it(`carries the complete boot recipe a resident seat needs`, () => {
    // The jobs PREWARM image (monorepo baked at /workspace) — the plain
    // sandbox image has no /workspace projects and the launcher crashes.
    expect(ResidentBodyConfig.image).toBe(`ghcr.io/threadedstack/tdsk-jobs:latest`)
    expect(ResidentBodyConfig.imagePullPolicy).toBe(`Always`)
    // Workspace trust for `claude -p` — without it every turn ends
    // "did not complete cleanly".
    expect(ResidentBodyConfig.initScript).toContain(`hasTrustDialogAccepted`)
    expect(ResidentBodyConfig.initScript).toContain(`/root/.claude.json`)
    // Clone refresh so the seat works on current main, not the image snapshot.
    expect(ResidentBodyConfig.setupScript).toContain(
      `git fetch origin main && git reset --hard origin/main`
    )
    expect(ResidentBodyConfig.setupScript).toContain(
      `pnpm install --frozen-lockfile --prefer-offline`
    )
    // The ${...} shell expansions must reach bash literally (not be
    // interpolated away by the template literal).
    expect(ResidentBodyConfig.setupScript).toContain(`\${TDSK_GIT_0_TOKEN:-}`)
    // Soul-injecting, permission-free prompt command.
    expect(ResidentBodyConfig.promptCommand).toBe(
      `claude -p --dangerously-skip-permissions --append-system-prompt '{soul}' '{prompt}'`
    )
    expect(ResidentBodyConfig.envVars).toEqual({
      GODEBUG: `x509negativeserial=1`,
      IS_SANDBOX: `1`,
      CURL_CA_BUNDLE: `/usr/local/share/ca-certificates/tdsk-proxy.crt`,
      GIT_SSL_CAINFO: `/usr/local/share/ca-certificates/tdsk-proxy.crt`,
      CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: `1`,
    })
    // The activation flag is the activations reconcile's job, never the recipe's.
    expect(ResidentBodyConfig).not.toHaveProperty(`resident`)
  })
})

describe(`reconcileResidentBodies`, () => {
  it(`asserts the boot recipe onto a preset-shaped config, preserving every other key`, async () => {
    const fake = makeFakeService()
    // The proven drift: a seat seeded from the plain claude-code preset.
    const presetShaped = {
      image: `ghcr.io/threadedstack/tdsk-sandbox`,
      runtime: `claude-code`,
      sshEnabled: true,
      idleTimeoutMinutes: 30,
      runtimeCommand: `claude`,
      initScript: `echo "Claude Code sandbox ready"`,
      resident: { agentId: CtoAgentId },
    }
    seedBodies(fake, { [CtoAgentId]: presetShaped })

    const summary = await reconcileResidentBodies(fake.service)

    expect(summary).toMatchObject({
      asserted: 1,
      unchanged: ResidentActivations.length - 1,
      bound: 0,
      errors: 0,
    })
    const cto = fake.sandboxes.get(`sb_cto0001`)!.config!
    for (const field of ResidentBootCriticalFields)
      expect(cto[field]).toBe(ResidentBodyConfig[field])
    expect(cto.envVars).toEqual(ResidentBodyConfig.envVars)
    // Every non-recipe key preserved (read-merge-write, never a bare replace).
    expect(cto.runtimeCommand).toBe(`claude`)
    expect(cto.idleTimeoutMinutes).toBe(30)
    expect(cto.sshEnabled).toBe(true)
    expect(cto.resident).toEqual({ agentId: CtoAgentId })
  })

  it(`re-asserts a single drifted field and merges envVars without dropping extra keys`, async () => {
    const fake = makeFakeService()
    seedBodies(fake, {
      [CmoAgentId]: recipeConfig({
        image: `ghcr.io/threadedstack/tdsk-sandbox`,
        envVars: { EXTRA_VAR: `keep-me`, GODEBUG: `hand-edited` },
      }),
    })

    const summary = await reconcileResidentBodies(fake.service)

    expect(summary).toMatchObject({
      asserted: 1,
      unchanged: ResidentActivations.length - 1,
      errors: 0,
    })
    const cmo = fake.sandboxes.get(`sb_cmo0001`)!.config!
    expect(cmo.image).toBe(ResidentBodyConfig.image)
    // Recipe env keys re-asserted, non-recipe env keys preserved.
    expect(cmo.envVars.GODEBUG).toBe(`x509negativeserial=1`)
    expect(cmo.envVars.EXTRA_VAR).toBe(`keep-me`)
  })

  it(`is idempotent — a config already carrying the recipe reports unchanged and writes nothing`, async () => {
    const fake = makeFakeService()
    seedBodies(fake)
    const before = JSON.parse(JSON.stringify([...fake.sandboxes]))

    const summary = await reconcileResidentBodies(fake.service)

    expect(summary).toMatchObject({
      asserted: 0,
      unchanged: ResidentActivations.length,
      bound: 0,
      errors: 0,
    })
    expect(JSON.parse(JSON.stringify([...fake.sandboxes]))).toEqual(before)
  })

  it(`creates the ops-project binding when absent and leaves existing links alone`, async () => {
    const fake = makeFakeService()
    seedBodies(fake, {}, false)
    // One seat already linked — must NOT be re-bound.
    fake.links.add(fake.linkKey(CeoAgentId, OpsProjectId))

    const summary = await reconcileResidentBodies(fake.service)

    expect(summary).toMatchObject({
      asserted: 0,
      unchanged: ResidentActivations.length,
      bound: ResidentActivations.length - 1,
      errors: 0,
    })
    for (const agentId of ResidentActivations)
      expect(fake.links.has(fake.linkKey(agentId, OpsProjectId))).toBe(true)
    const ceo = summary.results.find((r) => r.agentId === CeoAgentId)!
    expect(ceo.binding).toBe(`unchanged`)
    const cmo = summary.results.find((r) => r.agentId === CmoAgentId)!
    expect(cmo.binding).toBe(`bound`)
  })

  it(`passes the ops project name as the binding alias`, async () => {
    const fake = makeFakeService()
    seedBodies(fake, {}, false)
    const aliases: (string | undefined)[] = []
    const spied = {
      agent: {
        ...fake.service.agent,
        addProject: async (agentId: string, projectId: string, alias?: string) => {
          aliases.push(alias)
          return fake.service.agent.addProject(agentId, projectId, alias)
        },
      },
      sandbox: fake.service.sandbox,
    }

    await reconcileResidentBodies(spied)

    expect(aliases).toEqual(ResidentActivations.map(() => OpsProjectName))
  })

  it(`captures failures without throwing — missing agent, missing sandboxId, missing sandbox`, async () => {
    const fake = makeFakeService()
    // CMO agent exists + points at a sandbox that does NOT exist; CEO agent has
    // no environment.sandboxId; every other listed seat is absent entirely.
    fake.agents.set(CmoAgentId, { environment: { sandboxId: `sb_cmo0001` } })
    fake.agents.set(CeoAgentId, { environment: {} })

    const summary = await reconcileResidentBodies(fake.service)

    expect(summary).toMatchObject({
      asserted: 0,
      unchanged: 0,
      bound: 0,
      errors: ResidentActivations.length,
    })
    const cmo = summary.results.find((r) => r.agentId === CmoAgentId)!
    expect(cmo.action).toBe(`error`)
    expect(cmo.message).toContain(`body sandbox sb_cmo0001 not found`)
    const ceo = summary.results.find((r) => r.agentId === CeoAgentId)!
    expect(ceo.action).toBe(`error`)
    expect(ceo.message).toContain(`no environment.sandboxId`)
  })

  it(`surfaces a config-update failure as an error, not a throw`, async () => {
    const fake = makeFakeService()
    // Drifted configs so every seat needs a write.
    const configs = Object.fromEntries(
      ResidentActivations.map((agentId) => [agentId, { image: `wrong-image` }])
    )
    seedBodies(fake, configs)
    const failing = {
      agent: fake.service.agent,
      sandbox: {
        get: fake.service.sandbox.get,
        update: async () => ({ error: new Error(`write refused`) }),
      },
    }

    const summary = await reconcileResidentBodies(failing)

    expect(summary.errors).toBe(ResidentActivations.length)
    expect(summary.results.every((r) => r.action === `error`)).toBe(true)
    expect(summary.results[0].message).toContain(`write refused`)
  })

  it(`surfaces a binding failure as an error while still asserting the recipe`, async () => {
    const fake = makeFakeService()
    seedBodies(fake, {}, false)
    const failing = {
      agent: {
        ...fake.service.agent,
        addProject: async () => ({ error: new Error(`insert refused`) }),
      },
      sandbox: fake.service.sandbox,
    }

    const summary = await reconcileResidentBodies(failing)

    expect(summary).toMatchObject({
      asserted: 0,
      unchanged: ResidentActivations.length,
      bound: 0,
      errors: ResidentActivations.length,
    })
    expect(summary.results.every((r) => r.binding === `error`)).toBe(true)
  })
})

/** The three REAL providers the chain resolves to, keyed by their durable
 * handle — the NAME (ids are prod-random, these stand in for them). */
const ChainProviderIds: Record<string, string> = {
  'Claude Subscription OAuth': `pv_oauth001`,
  'ZAI GLM (fallback)': `pv_zai00001`,
  'OpenRouter (fallback)': `pv_openrtr1`,
}

/** The desired link set every seat's sandbox must carry. */
const desiredChain = ResidentProviderChain.map(({ name, priority }) => ({
  providerId: ChainProviderIds[name],
  priority,
}))

/**
 * In-memory fake of the agent + provider + links service slice: agents resolve
 * to a body sandbox via `environment.sandboxId`, providers resolve BY NAME
 * (the chain's only durable handle), and each sandbox holds a mutable link
 * set. `replaceCalls` records every replace so tests can prove links were (or
 * were NOT) touched. Enough to prove the chain reconcile asserts by name,
 * no-ops on an order-insensitive match, fail-softs on a missing name, and
 * captures every failure without a live DB.
 */
const makeFakeChainService = () => {
  const agents = new Map<string, { environment?: Record<string, any> | null }>()
  const providersByName = new Map<string, { id: string }>()
  const linksBySandbox = new Map<
    string,
    { providerId: string; priority: number }[]
  >()
  const replaceCalls: {
    sandboxId: string
    links: { providerId: string; priority: number }[]
  }[] = []
  return {
    agents,
    providersByName,
    linksBySandbox,
    replaceCalls,
    service: {
      agent: {
        get: async (id: string) => ({ data: agents.get(id) ?? null }),
      },
      provider: {
        findByName: async (name: string) => ({
          data: providersByName.get(name) ?? null,
        }),
      },
      links: {
        list: async (sandboxId: string) => ({
          data: linksBySandbox.get(sandboxId) ?? [],
        }),
        replace: async (
          sandboxId: string,
          links: { providerId: string; priority: number }[]
        ) => {
          replaceCalls.push({ sandboxId, links })
          linksBySandbox.set(sandboxId, links)
          return { error: null }
        },
      },
    },
  }
}

/** Wire the activated agents to body sandboxes with the given starting link
 * sets (per-agent overrides; every listed seat gets the desired chain
 * otherwise) and register the three real providers by name. */
const seedChains = (
  fake: ReturnType<typeof makeFakeChainService>,
  links: Record<string, { providerId: string; priority: number }[]> = {}
) => {
  for (const [name, id] of Object.entries(ChainProviderIds))
    fake.providersByName.set(name, { id })
  for (const agentId of ResidentActivations) {
    const sandboxId = BodyByAgent[agentId]
    fake.agents.set(agentId, { environment: { sandboxId } })
    fake.linksBySandbox.set(sandboxId, links[agentId] ?? [...desiredChain])
  }
}

describe(`ResidentProviderChain`, () => {
  it(`carries the three real providers by NAME with priorities 0/1/2 and no ids`, () => {
    // The NAME is the only durable handle — ids are prod-random, so the chain
    // must never carry one. A rename here breaks resolution in prod.
    expect(ResidentProviderChain).toEqual([
      { name: `Claude Subscription OAuth`, priority: 0 },
      { name: `ZAI GLM (fallback)`, priority: 1 },
      { name: `OpenRouter (fallback)`, priority: 2 },
    ])
  })
})

describe(`reconcileResidentProviderChains`, () => {
  it(`asserts the chain by name, replacing drifted seed-provider links`, async () => {
    const fake = makeFakeChainService()
    // The proven drift: a fresh seat linked to the SEED providers
    // (placeholder secrets → continuous LLM 502s).
    seedChains(fake, {
      [CtoAgentId]: [
        { providerId: `pv_seed0001`, priority: 0 },
        { providerId: `pv_seed0002`, priority: 1 },
      ],
    })

    const summary = await reconcileResidentProviderChains(fake.service)

    expect(summary).toMatchObject({
      asserted: 1,
      unchanged: ResidentActivations.length - 1,
      skipped: 0,
      errors: 0,
    })
    // Only the drifted seat was written, and now carries the real chain.
    expect(fake.replaceCalls).toHaveLength(1)
    expect(fake.replaceCalls[0].sandboxId).toBe(`sb_cto0001`)
    expect(fake.linksBySandbox.get(`sb_cto0001`)).toEqual(desiredChain)
    const cto = summary.results.find((r) => r.agentId === CtoAgentId)!
    expect(cto).toMatchObject({ action: `asserted`, sandboxId: `sb_cto0001` })
  })

  it(`is order-insensitive — a matching chain in scrambled row order is unchanged`, async () => {
    const fake = makeFakeChainService()
    seedChains(fake, {
      [CmoAgentId]: [desiredChain[2], desiredChain[0], desiredChain[1]],
    })

    const summary = await reconcileResidentProviderChains(fake.service)

    expect(summary).toMatchObject({
      asserted: 0,
      unchanged: ResidentActivations.length,
      skipped: 0,
      errors: 0,
    })
    expect(fake.replaceCalls).toHaveLength(0)
  })

  it(`priority drift on the same providers is NOT a match — the chain is re-asserted`, async () => {
    const fake = makeFakeChainService()
    // Same three providers, wrong fallback order (priorities swapped).
    seedChains(fake, {
      [CeoAgentId]: [
        { providerId: ChainProviderIds[`Claude Subscription OAuth`], priority: 2 },
        { providerId: ChainProviderIds[`ZAI GLM (fallback)`], priority: 1 },
        { providerId: ChainProviderIds[`OpenRouter (fallback)`], priority: 0 },
      ],
    })

    const summary = await reconcileResidentProviderChains(fake.service)

    expect(summary).toMatchObject({ asserted: 1, errors: 0 })
    expect(fake.linksBySandbox.get(`sb_ceo0001`)).toEqual(desiredChain)
  })

  it(`fail-softs when a chain name is missing — seats are skipped and links untouched`, async () => {
    const fake = makeFakeChainService()
    // A drifted seat that WOULD be replaced if the chain were resolvable.
    const drifted = [{ providerId: `pv_seed0001`, priority: 0 }]
    seedChains(fake, { [CtoAgentId]: drifted })
    // A fresh org: one real provider is absent (only seed providers exist).
    fake.providersByName.delete(`ZAI GLM (fallback)`)

    const summary = await reconcileResidentProviderChains(fake.service)

    expect(summary).toMatchObject({
      asserted: 0,
      unchanged: 0,
      skipped: ResidentActivations.length,
      errors: 0,
    })
    // Fail-soft: NOTHING was written — the drifted seat keeps its links (the
    // seat still boots; degraded LLM auth is the sensor's silent-turns signal).
    expect(fake.replaceCalls).toHaveLength(0)
    expect(fake.linksBySandbox.get(`sb_cto0001`)).toEqual(drifted)
    for (const result of summary.results) {
      expect(result.action).toBe(`skipped`)
      expect(result.message).toContain(`ZAI GLM (fallback)`)
    }
  })

  it(`captures failures without throwing — missing agent, missing sandboxId, lookup refused`, async () => {
    const fake = makeFakeChainService()
    for (const [name, id] of Object.entries(ChainProviderIds))
      fake.providersByName.set(name, { id })
    // CMO agent has no environment.sandboxId; every other seat is absent.
    fake.agents.set(CmoAgentId, { environment: {} })

    const summary = await reconcileResidentProviderChains(fake.service)

    expect(summary).toMatchObject({
      asserted: 0,
      unchanged: 0,
      skipped: 0,
      errors: ResidentActivations.length,
    })
    const cmo = summary.results.find((r) => r.agentId === CmoAgentId)!
    expect(cmo.action).toBe(`error`)
    expect(cmo.message).toContain(`no environment.sandboxId`)

    // A provider lookup ERROR (db refused) is an error, never a silent skip.
    const lookupFailing = makeFakeChainService()
    seedChains(lookupFailing)
    const summary2 = await reconcileResidentProviderChains({
      ...lookupFailing.service,
      provider: {
        findByName: async () => ({ data: null, error: new Error(`db refused`) }),
      },
    })
    expect(summary2.errors).toBe(ResidentActivations.length)
    expect(summary2.results[0].message).toContain(`db refused`)
  })

  it(`surfaces list and replace failures as errors, not throws`, async () => {
    const listFailing = makeFakeChainService()
    seedChains(listFailing)
    const listSummary = await reconcileResidentProviderChains({
      ...listFailing.service,
      links: {
        ...listFailing.service.links,
        list: async () => ({ error: new Error(`list refused`) }),
      },
    })
    expect(listSummary.errors).toBe(ResidentActivations.length)
    expect(listSummary.results[0].message).toContain(`list refused`)

    const replaceFailing = makeFakeChainService()
    // Every seat drifted so every seat attempts a replace.
    seedChains(
      replaceFailing,
      Object.fromEntries(
        ResidentActivations.map((agentId) => [
          agentId,
          [{ providerId: `pv_seed0001`, priority: 0 }],
        ])
      )
    )
    const replaceSummary = await reconcileResidentProviderChains({
      ...replaceFailing.service,
      links: {
        ...replaceFailing.service.links,
        replace: async () => ({ error: new Error(`replace refused`) }),
      },
    })
    expect(replaceSummary.errors).toBe(ResidentActivations.length)
    expect(replaceSummary.results.every((r) => r.action === `error`)).toBe(true)
    expect(replaceSummary.results[0].message).toContain(`replace refused`)
  })

  it(`summary totals always reconcile with the per-seat results`, async () => {
    const fake = makeFakeChainService()
    // Mixed run: one drifted (asserted), one seat's agent missing (error),
    // the rest already carrying the chain (unchanged).
    seedChains(fake, {
      [CtoAgentId]: [{ providerId: `pv_seed0001`, priority: 0 }],
    })
    fake.agents.delete(EngTwoAgentId)

    const summary = await reconcileResidentProviderChains(fake.service)

    expect(summary).toMatchObject({
      asserted: 1,
      unchanged: ResidentActivations.length - 2,
      skipped: 0,
      errors: 1,
    })
    expect(summary.results).toHaveLength(ResidentActivations.length)
    const counted = { asserted: 0, unchanged: 0, skipped: 0, errors: 0 }
    for (const r of summary.results)
      counted[r.action === `error` ? `errors` : r.action]++
    expect(counted).toEqual({
      asserted: summary.asserted,
      unchanged: summary.unchanged,
      skipped: summary.skipped,
      errors: summary.errors,
    })
  })
})
