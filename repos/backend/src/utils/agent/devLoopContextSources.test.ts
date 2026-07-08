import type { TContextSource, TRecordQuery } from '@tdsk/domain'

import { EQueryOp } from '@tdsk/domain'
import { describe, it, expect, vi } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the legacy builders never pulls in the heavy agent runtime
// (mirrors executor.task.test.ts / executor.verify.test.ts).
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))
vi.mock(`@TBE/utils/agent/taskPromotion`, () => ({
  authorTaskProposal: vi.fn(),
  markTaskPromoted: vi.fn(),
}))
vi.mock(`@TBE/utils/agent/escalationPromotion`, () => ({
  openEscalation: vi.fn(),
  resolveEscalation: vi.fn(),
}))

import { buildContextSourcesSection } from './contextSources'
import {
  buildVerifyContext,
  buildEscalationContext,
  buildTaskBacklogContext,
  buildCoordinatorContext,
  buildOpenProposalsDigest,
} from '@TBE/services/scheduler/executor'
import {
  DevTaskBacklogSource,
  DevEscalationsSource,
  DevOpenProposalsSource,
  DevCoordinatorLedgerSource,
  DevVerificationsRecentSource,
  DevVerificationsInFlightSource,
} from '@tdsk/database/seeds/agentSchedules'
import { DevLoopCollectionDefs } from '@tdsk/database/seeds/dev-loop/collections'
import {
  RecordQueryMaxLimit,
  RecordQueryDefaultLimit,
} from '@tdsk/database/utils/database/recordQuery'

// ── Rendering-parity tests for the ⑤b-3 dev-loop context sources ─────────────
//
// Each test seeds ONE in-memory dataset, runs the LEGACY executor builder over
// it (via mocked db services that reproduce the real service reads), renders
// the NEW declarative source over the same rows as ⑤b-2 collection records
// (via an in-memory record.query that mirrors compileRecordQuery semantics:
// text-compare eq/ne/in, single-field text orderBy, default createdAt-desc,
// limit ≤ RecordQueryMaxLimit), and asserts the source render carries every
// FACT the legacy builder injected (field-level — titles, statuses, ids,
// dedupeKeys, PR numbers — not byte-equality; the Phase 4 prompt rewrites own
// comprehension of the new JSON format). Record ids must render: the cutover
// prompts reference records by id in follow-up tdsk-actions effects.
//
// Parity map:
//   DevTaskBacklogSource           → buildTaskBacklogContext   (executor.ts:646)
//   DevOpenProposalsSource         → buildOpenProposalsDigest  (executor.ts:613)
//   DevEscalationsSource           → buildEscalationContext    (executor.ts:769)
//   DevVerificationsInFlightSource → buildVerifyContext        (executor.ts:891, in-flight half)
//   DevVerificationsRecentSource   → buildVerifyContext        (executor.ts:891, done-set half)
//   DevCoordinatorLedgerSource     → buildCoordinatorContext   (executor.ts:1140)

// ── In-memory record store mirroring compileRecordQuery semantics ────────────

type TRow = Record<string, unknown> & { id: string }

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Evaluate a TRecordQuery over rows the way the compiled SQL would: every
 * comparison is TEXT against `data ->> field`; SQL NULL (absent/null field)
 * matches NO operator; orderBy is a single-field text sort; omitted orderBy is
 * newest-first (createdAt desc — seed order is oldest-first, so reverse). */
const evalQuery = (rows: TRow[], query: TRecordQuery = {}): TRow[] => {
  let out = rows.filter((row) =>
    (query.where ?? []).every((f) => {
      const value = row[f.field]
      if (value === undefined || value === null) return false
      const text = String(value)
      if (f.op === EQueryOp.in)
        return Array.isArray(f.value) && f.value.map(String).includes(text)
      if (f.op === EQueryOp.ne) return text !== String(f.value)
      if (f.op === EQueryOp.eq) return text === String(f.value)
      throw new Error(`Query op not modeled in this harness: ${String(f.op)}`)
    })
  )

  out = query.orderBy
    ? [...out].sort(
        (a, b) =>
          (query.orderBy!.direction === `desc` ? -1 : 1) *
          cmp(String(a[query.orderBy!.field]), String(b[query.orderBy!.field]))
      )
    : [...out].reverse()

  const limit = Math.min(
    typeof query.limit === `number` ? query.limit : RecordQueryDefaultLimit,
    RecordQueryMaxLimit
  )
  return out.slice(0, limit)
}

/** Render ONE source through the REAL buildContextSourcesSection over the
 * store, with the row's `id` as the record id (the live cutover copies each
 * table row into a record keyed by the same id). */
const renderSource = async (source: TContextSource, store: Record<string, TRow[]>) => {
  const query = vi.fn(async (_pj: string, collection: string, q: TRecordQuery) => ({
    data: evalQuery(store[collection] ?? [], q).map(({ id, ...data }) => ({ id, data })),
  }))
  const app = { locals: { db: { services: { record: { query } } } } } as any
  return buildContextSourcesSection(app, {
    id: `sd_x`,
    orgId: `og_0000001`,
    projectId: `pj_tIly2F1`,
    contextSources: [source],
  } as any)
}

const legacyApp = (services: Record<string, unknown>) =>
  ({ locals: { db: { services } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `og_0000001`, prompt: `hello`, ...overrides }) as any

const byStatus = <T extends TRow>(rows: T[], status: string) =>
  rows.filter((r) => r.status === status)

// ── Seed data (oldest-first — evalQuery's default order reverses it) ─────────

const proposals: TRow[] = [
  {
    id: `tp_p3`,
    title: `Tidy noisy logs`,
    description: `lower the warn level on the proxy`,
    priority: `P3`,
    evidence: `noisy warns in proxy logs`,
    sourceSignal: `log`,
    dedupeKey: `log:tidy-noisy`,
    status: `scanned`,
    initiative: null,
    parentId: null,
    prUrl: null,
    proposedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `tp_p0`,
    title: `Fix prod outage`,
    description: `restart loop in the backend pod`,
    priority: `P0`,
    evidence: `500s from /_/health`,
    sourceSignal: `health`,
    dedupeKey: `health:outage`,
    status: `scanned`,
    initiative: null,
    parentId: null,
    prUrl: null,
    proposedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `tp_pend`,
    title: `Investigate flaky test`,
    description: `tunnel test flakes on CI`,
    priority: `P1`,
    evidence: `CI run 42 red`,
    sourceSignal: `ci`,
    dedupeKey: `ci:flaky-tunnel`,
    status: `pending`,
    initiative: null,
    parentId: null,
    prUrl: null,
    proposedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `tp_rej`,
    title: `Rejected injection attempt`,
    description: `scan said no`,
    priority: `P2`,
    evidence: `n/a`,
    sourceSignal: `sensor`,
    dedupeKey: `sensor:rejected`,
    status: `rejected`,
    initiative: null,
    parentId: null,
    prUrl: null,
    proposedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `tp_par`,
    title: `Init A parent`,
    description: `root of initiative A`,
    priority: `P1`,
    evidence: `roadmap`,
    sourceSignal: `planning`,
    dedupeKey: `init:a-root`,
    status: `promoted`,
    initiative: `Init A`,
    parentId: null,
    prUrl: `https://github.com/x/y/pull/7`,
    proposedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `tp_child`,
    title: `Init A child task`,
    description: `bounded child of the parent`,
    priority: `P2`,
    evidence: `decomposition`,
    sourceSignal: `coordinator`,
    dedupeKey: `init:a-child`,
    status: `scanned`,
    initiative: `Init A`,
    parentId: `tp_par`,
    prUrl: null,
    proposedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `tp_b`,
    title: `Init B parent`,
    description: `root of initiative B`,
    priority: `P2`,
    evidence: `roadmap`,
    sourceSignal: `planning`,
    dedupeKey: `init:b-root`,
    status: `pending`,
    initiative: `Init B`,
    parentId: null,
    prUrl: null,
    proposedByAgentId: `ag_lvUbjp_`,
  },
]

const escalations: TRow[] = [
  {
    id: `es_open`,
    title: `Health probe flapping`,
    problem: `the startup probe flaps on deploy`,
    status: `open`,
    target: `app`,
    dedupeKey: `app:health-flap`,
    proposedPatch: `raise the probe timeout to 30s`,
    issueRef: null,
    evidence: [`probe log line`],
    openedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `es_routed`,
    title: `Rotate leaked token`,
    problem: `a token surfaced in pod logs`,
    status: `routed`,
    target: `secrets`,
    dedupeKey: `secrets:token-leak`,
    proposedPatch: null,
    issueRef: `https://github.com/x/y/issues/9`,
    evidence: [`log excerpt`],
    openedByAgentId: `ag_lvUbjp_`,
  },
  {
    id: `es_done`,
    title: `Old resolved thing`,
    problem: `already fixed`,
    status: `resolved`,
    target: `app`,
    dedupeKey: `app:old-thing`,
    proposedPatch: null,
    issueRef: null,
    evidence: [],
    openedByAgentId: `ag_lvUbjp_`,
  },
]

const verifications: TRow[] = [
  {
    id: `vf_ok`,
    prNumber: 90,
    prUrl: `https://github.com/x/y/pull/90`,
    mergeSha: `sha90`,
    probe: { kind: `ci-green` },
    status: `verified`,
    detail: `latest main run green`,
    agentId: `ag_lvUbjp_`,
  },
  {
    id: `vf_bad`,
    prNumber: 91,
    prUrl: `https://github.com/x/y/pull/91`,
    mergeSha: `sha91`,
    probe: { kind: `health` },
    status: `regressed`,
    detail: `health probe failed post-deploy`,
    revertPrUrl: `https://github.com/x/y/pull/95`,
    agentId: `ag_lvUbjp_`,
  },
  {
    id: `vf_pend`,
    prNumber: 101,
    prUrl: `https://github.com/x/y/pull/101`,
    mergeSha: `sha101`,
    probe: { kind: `ci-green` },
    status: `pending`,
    agentId: `ag_lvUbjp_`,
  },
  {
    id: `vf_ver`,
    prNumber: 102,
    prUrl: `https://github.com/x/y/pull/102`,
    mergeSha: `sha102`,
    probe: { kind: `marker-advanced` },
    status: `verifying`,
    agentId: `ag_lvUbjp_`,
  },
]

const store = {
  task_proposals: proposals,
  escalations,
  verifications,
}

// ── Static compatibility with the ⑤b-2 collection schemas ────────────────────

describe(`dev-loop context sources — schema compatibility`, () => {
  const defsByName = Object.fromEntries(DevLoopCollectionDefs.map((d) => [d.name, d]))
  const sources: TContextSource[] = [
    DevTaskBacklogSource,
    DevOpenProposalsSource,
    DevEscalationsSource,
    DevVerificationsInFlightSource,
    DevVerificationsRecentSource,
    DevCoordinatorLedgerSource,
  ]

  it(`every source targets a ⑤b-2 collection, filters/orders ONLY schema fields, and respects the API limit`, () => {
    for (const source of sources) {
      const def = defsByName[source.collection]
      // compileRecordQuery validates fields against the collection schema and
      // THROWS on a miss — a non-schema field would render nothing at cutover.
      expect(def, `collection ${source.collection}`).toBeDefined()
      const fields = new Set(def.schema.map((f) => f.name))
      for (const filter of source.query.where ?? [])
        expect(fields.has(filter.field), `${source.as} where ${filter.field}`).toBe(true)
      if (source.query.orderBy)
        expect(
          fields.has(source.query.orderBy.field),
          `${source.as} orderBy ${source.query.orderBy.field}`
        ).toBe(true)
      expect(source.query.limit).toBeDefined()
      expect(source.query.limit!).toBeLessThanOrEqual(RecordQueryMaxLimit)
      expect(source.query.limit!).toBeGreaterThan(0)
    }
  })
})

// ── DevTaskBacklogSource ↔ buildTaskBacklogContext (executor.ts:646) ──────────

describe(`DevTaskBacklogSource ↔ buildTaskBacklogContext`, () => {
  const services = {
    taskProposal: {
      // Real listBacklog: status=scanned, priority asc (P0 first), capped.
      listBacklog: vi.fn(async (_org: string, limit: number) => ({
        data: byStatus(proposals, `scanned`)
          .sort((a, b) => cmp(String(a.priority), String(b.priority)))
          .slice(0, limit),
      })),
    },
  }

  it(`renders the scanned backlog with the legacy facts (ids, priorities, titles, signals, evidence), P0 first`, async () => {
    const legacy = await buildTaskBacklogContext(legacyApp(services), schedule())
    const rendered = await renderSource(DevTaskBacklogSource, store)

    expect(rendered).toContain(`## Proposed backlog (sensor-detected)`)
    for (const p of byStatus(proposals, `scanned`)) {
      for (const out of [legacy, rendered]) {
        expect(out).toContain(p.id as string)
        expect(out).toContain(p.title as string)
        expect(out).toContain(p.priority as string)
        expect(out).toContain(p.sourceSignal as string)
        expect(out).toContain(p.evidence as string)
        expect(out).toContain(p.description as string)
      }
    }
    // Priority order survives (P0 → P2 → P3) in BOTH renders.
    for (const out of [legacy, rendered]) {
      expect(out.indexOf(`tp_p0`)).toBeLessThan(out.indexOf(`tp_child`))
      expect(out.indexOf(`tp_child`)).toBeLessThan(out.indexOf(`tp_p3`))
    }
    // Non-scanned rows never enter the backlog. Exclusion is by RECORD id —
    // `tp_par` still appears as tp_child's parentId link, which is correct.
    for (const absent of [`tp_pend`, `tp_rej`, `tp_par`, `tp_b`])
      expect(rendered).not.toContain(`"id": "${absent}"`)
  })
})

// ── DevOpenProposalsSource ↔ buildOpenProposalsDigest (executor.ts:613) ───────

describe(`DevOpenProposalsSource ↔ buildOpenProposalsDigest`, () => {
  const services = {
    taskProposal: {
      listByStatus: vi.fn(async (_org: string, status: string) => ({
        data: byStatus(proposals, status),
      })),
    },
  }

  it(`renders every pending + scanned proposal with the legacy facts (dedupeKeys, priorities, titles, statuses)`, async () => {
    const legacy = await buildOpenProposalsDigest(legacyApp(services), schedule())
    const rendered = await renderSource(DevOpenProposalsSource, store)

    expect(rendered).toContain(`## Recently proposed backlog (do not duplicate)`)
    const open = [...byStatus(proposals, `pending`), ...byStatus(proposals, `scanned`)]
    expect(open.length).toBeGreaterThan(2)
    for (const p of open) {
      for (const out of [legacy, rendered]) {
        expect(out).toContain(p.dedupeKey as string)
        expect(out).toContain(p.priority as string)
        expect(out).toContain(p.title as string)
        expect(out).toContain(p.status as string)
      }
    }
    // Record ids render (the cutover prompts reference proposals by id).
    for (const p of open) expect(rendered).toContain(`"id": "${p.id}"`)
    // Terminal rows are excluded from the digest in both worlds.
    for (const out of [legacy, rendered]) {
      expect(out).not.toContain(`tp_rej`)
      expect(out).not.toContain(`init:a-root`)
    }
  })
})

// ── DevEscalationsSource ↔ buildEscalationContext (executor.ts:769) ───────────

describe(`DevEscalationsSource ↔ buildEscalationContext`, () => {
  const services = {
    escalation: {
      listByStatus: vi.fn(async (_org: string, status: string) => ({
        data: byStatus(escalations, status),
      })),
    },
  }

  it(`renders routed + open escalations with the legacy facts (ids, statuses, targets, titles, problems, patch, issueRef), routed first`, async () => {
    const legacy = await buildEscalationContext(legacyApp(services), schedule())
    const rendered = await renderSource(DevEscalationsSource, store)

    expect(rendered).toContain(
      `## Open escalations (do NOT re-raise; act on routed ones)`
    )
    for (const es of [escalations[0], escalations[1]]) {
      for (const out of [legacy, rendered]) {
        expect(out).toContain(es.id as string)
        expect(out).toContain(es.title as string)
        expect(out).toContain(es.status as string)
        expect(out).toContain(es.target as string)
        expect(out).toContain(es.problem as string)
      }
    }
    // The actionable extras the legacy bullet carried are field-level present.
    for (const out of [legacy, rendered]) {
      expect(out).toContain(`raise the probe timeout to 30s`)
      expect(out).toContain(`https://github.com/x/y/issues/9`)
      // Routed entries lead (the steward can act on them).
      expect(out.indexOf(`es_routed`)).toBeLessThan(out.indexOf(`es_open`))
      // Resolved escalations never re-surface.
      expect(out).not.toContain(`es_done`)
    }
    expect(rendered).toContain(`"id": "es_routed"`)
    expect(rendered).toContain(`"id": "es_open"`)
  })
})

// ── DevVerifications*Source ↔ buildVerifyContext (executor.ts:891) ────────────

describe(`DevVerificationsInFlightSource + DevVerificationsRecentSource ↔ buildVerifyContext`, () => {
  const services = {
    verification: {
      listByStatus: vi.fn(async (_org: string, status: string) => ({
        data: byStatus(verifications, status),
      })),
      // Real list({orderBy createdAt desc, limit}): newest rows first.
      list: vi.fn(async ({ limit }: { limit: number }) => ({
        data: [...verifications].reverse().slice(0, limit),
      })),
    },
  }

  it(`the two sources carry the legacy facts: the in-flight rows (pending first) and the terminal done-set PR numbers`, async () => {
    const legacy = await buildVerifyContext(legacyApp(services), schedule())
    const inFlight = await renderSource(DevVerificationsInFlightSource, store)
    const recent = await renderSource(DevVerificationsRecentSource, store)

    // Legacy injected the done-set PR numbers + the in-flight count (2).
    expect(legacy).toContain(`90`)
    expect(legacy).toContain(`91`)
    expect(legacy).toContain(`In-flight this list is what needs probing next: 2`)

    // In-flight source: the SAME two rows legacy counted, pending before
    // verifying, with the probe facts the prompt needs to run them.
    expect(inFlight).toContain(`## Verifications in flight (probe these)`)
    for (const v of [verifications[2], verifications[3]]) {
      expect(inFlight).toContain(`"id": "${v.id}"`)
      expect(inFlight).toContain(String(v.prNumber))
      expect(inFlight).toContain(v.status as string)
      expect(inFlight).toContain(v.mergeSha as string)
    }
    expect(inFlight).toContain(`ci-green`)
    expect(inFlight).toContain(`marker-advanced`)
    expect(inFlight.indexOf(`vf_pend`)).toBeLessThan(inFlight.indexOf(`vf_ver`))
    expect(inFlight).not.toContain(`vf_ok`)
    expect(inFlight).not.toContain(`vf_bad`)

    // Recent-terminal source: every done-set PR number legacy injected, with
    // its terminal status (and the revert PR on the regressed row).
    expect(recent).toContain(
      `## Recent terminal verifications (done-set — skip these PR numbers)`
    )
    expect(recent).toContain(`"prNumber": 90`)
    expect(recent).toContain(`"prNumber": 91`)
    expect(recent).toContain(`verified`)
    expect(recent).toContain(`regressed`)
    expect(recent).toContain(`https://github.com/x/y/pull/95`)
    expect(recent).toContain(`"id": "vf_ok"`)
    expect(recent).toContain(`"id": "vf_bad"`)
    expect(recent).not.toContain(`vf_pend`)
    expect(recent).not.toContain(`vf_ver`)
  })
})

// ── DevCoordinatorLedgerSource ↔ buildCoordinatorContext (executor.ts:1140) ───

describe(`DevCoordinatorLedgerSource ↔ buildCoordinatorContext`, () => {
  const services = {
    taskProposal: {
      listByInitiative: vi.fn(async (_org: string, initiative: string) => ({
        data: proposals.filter((p) => p.initiative === initiative),
      })),
    },
  }

  it(`renders every initiative-carrying proposal with the legacy ledger facts (ids, priorities, titles, statuses, prUrls, parent links)`, async () => {
    const legacy = await buildCoordinatorContext(
      legacyApp(services),
      schedule({ prompt: `<!-- coordinator-initiative: Init A -->` })
    )
    const rendered = await renderSource(DevCoordinatorLedgerSource, store)

    // Every fact the legacy Init A ledger injected is present in the render.
    for (const p of [proposals[4], proposals[5]]) {
      for (const out of [legacy, rendered]) {
        expect(out).toContain(p.id as string)
        expect(out).toContain(p.title as string)
        expect(out).toContain(p.priority as string)
        expect(out).toContain(p.status as string)
      }
    }
    expect(legacy).toContain(`https://github.com/x/y/pull/7`)
    expect(rendered).toContain(`https://github.com/x/y/pull/7`)

    // The hierarchy facts the prompt rebuilds app-side: the initiative name on
    // every row and the child → parent link.
    expect(rendered).toContain(`"initiative": "Init A"`)
    expect(rendered).toContain(`"parentId": "tp_par"`)
    expect(rendered).toContain(`"id": "tp_par"`)
    expect(rendered).toContain(`"id": "tp_child"`)
    // The static source cannot express the runtime-resolved initiative filter,
    // so it injects ALL initiatives (grouped) — the prompt selects its own.
    expect(rendered).toContain(`"initiative": "Init B"`)
    expect(rendered).toContain(`"id": "tp_b"`)
    expect(rendered.indexOf(`Init A`)).toBeLessThan(rendered.indexOf(`Init B`))
    // Initiative-less proposals never enter the ledger in either world.
    for (const out of [legacy, rendered]) {
      expect(out).not.toContain(`tp_p0`)
      expect(out).not.toContain(`tp_pend`)
    }
  })
})
