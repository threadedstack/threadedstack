import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, it, expect, vi } from 'vitest'

import { EFunLanguage } from '@tdsk/domain'
import { Record as RecordService } from '@TDB/services/record'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import {
  DevTeamFunctionDefs,
  devTeamFunctionRecordFields,
  devTeamFunctionNeedsUpdate,
  reconcileDevTeamFunctions,
} from '@TDB/seeds/dev-team/functions'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

/**
 * An in-memory fake of the function service's Base get/create/update slice,
 * keyed by id — enough to prove the reconcile creates missing Functions,
 * leaves in-sync ones untouched, and updates drifted bodies (git is the
 * source of truth) without a live DB. The Function BODIES' behavior (CAS
 * transitions, identity refusals, lease reaping) is exercised end to end
 * through the real FunctionExecutor in
 * repos/backend/src/utils/agent/devTeamFunctions.test.ts — and the
 * fake-vs-real casUpdate parity suite at the bottom of THIS file pins the
 * body semantics against the REAL record service's casUpdate.
 */
const makeFakeService = () => {
  const rows = new Map<string, any>()
  return {
    rows,
    service: {
      get: async (id: string) => {
        const row = rows.get(id)
        return row ? { data: { ...row } } : {}
      },
      create: async (item: any) => {
        rows.set(item.id, { ...item })
        return { data: { ...item } }
      },
      update: async (item: any) => {
        const row = rows.get(item.id)
        if (!row) return {}
        rows.set(item.id, { ...row, ...item })
        return { data: rows.get(item.id) }
      },
    },
  }
}

const byName = (name: string) => DevTeamFunctionDefs.find((def) => def.name === name)!

describe(`DevTeamFunctionDefs`, () => {
  it(`defines the ten state-machine Functions with unique names + stable ids`, () => {
    expect(DevTeamFunctionDefs).toHaveLength(10)
    expect(DevTeamFunctionDefs.map((def) => def.name)).toEqual([
      `devAddTask`,
      `devClaimTask`,
      `devSubmitPr`,
      `devClaimReview`,
      `devCompleteReview`,
      `devUpdatePr`,
      `devMarkMerged`,
      `devRenewLease`,
      `devReapExpired`,
      `devAbandon`,
    ])
    const ids = DevTeamFunctionDefs.map((def) => def.id)
    expect(new Set(ids).size).toBe(10)
    // Every id is a valid entity id (fn_ prefix + 7 chars = 10-char id shape).
    for (const id of ids) expect(id).toMatch(/^fn_[A-Za-z0-9_-]{7}$/)
  })

  it(`ships every body as plain-JS ESM with a default-export handler`, () => {
    for (const def of DevTeamFunctionDefs) {
      expect(def.language).toBe(EFunLanguage.javascript)
      expect(def.content.startsWith(`export default async (request, context)`)).toBe(true)
      expect(def.description.length).toBeGreaterThan(0)
    }
  })

  it(`gates every Function on the trusted context.caller identity, never args`, () => {
    for (const def of DevTeamFunctionDefs) {
      expect(def.content).toContain(`if (!caller.agentId)`)
      expect(def.content).toContain(`no caller identity`)
    }
  })

  it(`refuses a spoofed identity arg in every Function that accepts one`, () => {
    // devReapExpired takes no identity arg; every other body cross-checks the
    // passed agentId (or createdBy) against the platform-injected caller.
    for (const def of DevTeamFunctionDefs) {
      if (def.name === `devReapExpired`) continue
      expect(def.content).toContain(
        `the platform-injected caller identity is authoritative`
      )
    }
  })

  it(`routes EVERY state transition through records.cas — the machine's only write path`, () => {
    const transitionFns = [
      `devClaimTask`,
      `devSubmitPr`,
      `devClaimReview`,
      `devCompleteReview`,
      `devUpdatePr`,
      `devMarkMerged`,
      `devRenewLease`,
      `devReapExpired`,
      `devAbandon`,
    ]
    for (const name of transitionFns) {
      expect(byName(name).content).toContain(`records.cas(`)
      // A guard loss is a NORMAL outcome, surfaced as conflict — never thrown.
      expect(byName(name).content).toContain(`conflict`)
    }
    // devAddTask is the one non-transition write: a fresh backlog upsert.
    expect(byName(`devAddTask`).content).toContain(`records.upsert('dev_tasks'`)
    expect(byName(`devAddTask`).content).not.toContain(`records.cas(`)
  })

  it(`appends a race-safe {at, from, to, by} history entry on every transition`, () => {
    const transitionFns = [
      `devClaimTask`,
      `devSubmitPr`,
      `devClaimReview`,
      `devCompleteReview`,
      `devUpdatePr`,
      `devMarkMerged`,
      `devReapExpired`,
      `devAbandon`,
    ]
    for (const name of transitionFns) {
      const { content } = byName(name)
      expect(content).toContain(`history.push({ at: new Date(`)
      expect(content).toContain(`history: history`)
    }
    // Lease renewal is NOT a transition — no history entry.
    expect(byName(`devRenewLease`).content).not.toContain(`history.push`)
  })

  it(`platform-enforces reviewer independence in devClaimReview (never own PR)`, () => {
    const { content } = byName(`devClaimReview`)
    expect(content).toContain(`task.data.assignee === agentId`)
    expect(content).toContain(`an author never reviews their own work`)
    // Race-safe: the read assignee rides the CAS guard.
    expect(content).toContain(`assignee: assignee`)
  })

  it(`binds the review verdict to the recorded reviewer AND the exact headSha`, () => {
    const { content } = byName(`devCompleteReview`)
    expect(content).toContain(`you are not the recorded reviewer`)
    expect(content).toContain(`headSha mismatch`)
    expect(content).toContain(`notes are required when requesting changes`)
    expect(content).toContain(`reviewer: agentId, headSha: headSha`)
  })

  it(`devCompleteReview sets a 60-minute obligation lease on BOTH verdicts — never a wedge`, () => {
    const { content } = byName(`devCompleteReview`)
    // approved → the reviewer owes the merge; changes_requested → the author
    // owes the fix. Expiry hands the task to the reaper instead of wedging.
    expect(content).toContain(`const leaseExpiresAt = now + 60 * 60 * 1000`)
    expect(content).toContain(`leaseExpiresAt: leaseExpiresAt`)
    expect(content).not.toContain(`leaseExpiresAt: null`)
  })

  it(`devAbandon is the explicit close-out: any non-terminal state, reason required, holders cleared`, () => {
    const { content } = byName(`devAbandon`)
    expect(content).toContain(`reason is required`)
    expect(content).toContain(`state === 'merged' || state === 'abandoned'`)
    expect(content).toContain(`task is already terminal`)
    // The reason becomes the record's last word; holders + lease are cleared.
    expect(content).toContain(`notes: reason`)
    expect(content).toContain(`assignee: null`)
    expect(content).toContain(`reviewer: null`)
    expect(content).toContain(`leaseExpiresAt: null`)
    // Guarded on the exact state read — a concurrent transition wins.
    expect(content).toContain(`{ state: state }`)
  })

  it(`devUpdatePr voids the stale review: clears reviewer + notes with the new head`, () => {
    const { content } = byName(`devUpdatePr`)
    expect(content).toContain(`state: 'changes_requested', assignee: agentId`)
    expect(content).toContain(`reviewer: null`)
    expect(content).toContain(`notes: ''`)
  })

  it(`devReapExpired guards on the exact lease read and NEVER calls GitHub from the isolate`, () => {
    const { content } = byName(`devReapExpired`)
    expect(content).toContain(`leaseExpiresAt: lease`)
    expect(content).toContain(`candidates`)
    // ALL FOUR leased states are recoverable — including the verdict
    // obligations (approved merge window, changes_requested fix window).
    expect(content).toContain(`['claimed', 'in_review', 'approved', 'changes_requested']`)
    // The CTO reconciles the returned lists against GitHub from its own VM.
    expect(content).not.toContain(`github.com/api`)
    expect(content).not.toContain(`fetch(`)
    expect(content).not.toContain(`context.connect`)
  })

  it(`stamps devAddTask's createdBy from the caller and dedupes open titles + sourceTaskProposalId`, () => {
    const { content } = byName(`devAddTask`)
    expect(content).toContain(`createdBy: caller.agentId`)
    expect(content).toContain(`deduped: true`)
    expect(content).toContain(`state: 'backlog'`)
    // Dual dedupe: exact title AND sourceTaskProposalId, both against open
    // tasks — so re-grooming a not-yet-promoted proposal (new decomposed
    // title) never re-creates a dev_task.
    expect(content).toContain(`field: 'title'`)
    expect(content).toContain(`field: 'sourceTaskProposalId'`)
  })
})

describe(`reconcileDevTeamFunctions`, () => {
  it(`creates the ten Function records in the ops project when missing`, async () => {
    const { service, rows } = makeFakeService()

    const summary = await reconcileDevTeamFunctions(service)

    expect(summary).toMatchObject({ created: 10, updated: 0, unchanged: 0, errors: 0 })
    expect(rows.size).toBe(10)
    for (const def of DevTeamFunctionDefs) {
      const row = rows.get(def.id)
      expect(row).toMatchObject({
        id: def.id,
        name: def.name,
        content: def.content,
        language: EFunLanguage.javascript,
        projectId: OpsProjectId,
      })
    }
  })

  it(`is idempotent — a re-run reports all ten unchanged and writes nothing`, async () => {
    const { service, rows } = makeFakeService()

    await reconcileDevTeamFunctions(service)
    const snapshot = new Map([...rows].map(([id, row]) => [id, { ...row }]))

    const second = await reconcileDevTeamFunctions(service)

    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 10, errors: 0 })
    expect(rows.size).toBe(10)
    for (const [id, row] of snapshot) expect(rows.get(id)).toEqual(row)
  })

  it(`updates a drifted Function body back to the git-versioned source`, async () => {
    const { service, rows } = makeFakeService()
    await reconcileDevTeamFunctions(service)

    const def = DevTeamFunctionDefs[0]
    rows.set(def.id, { ...rows.get(def.id), content: `export default () => 'drifted'` })

    const summary = await reconcileDevTeamFunctions(service)

    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 9, errors: 0 })
    expect(rows.get(def.id).content).toBe(def.content)
  })

  it(`records an error without throwing when a create fails`, async () => {
    const service = {
      get: async () => ({}),
      create: async () => ({ error: new Error(`boom`) }),
      update: async () => ({ data: {} }),
    }
    const summary = await reconcileDevTeamFunctions(service)
    expect(summary.errors).toBe(10)
    expect(summary.created).toBe(0)
    expect(summary.results.every((res) => res.action === `error`)).toBe(true)
  })

  it(`exposes drift detection over every declarative field`, () => {
    const def = DevTeamFunctionDefs[0]
    const inSync = devTeamFunctionRecordFields(def, OpsProjectId)
    expect(devTeamFunctionNeedsUpdate(inSync, def, OpsProjectId)).toBe(false)
    expect(
      devTeamFunctionNeedsUpdate({ ...inSync, content: `x` }, def, OpsProjectId)
    ).toBe(true)
    expect(devTeamFunctionNeedsUpdate({ ...inSync, name: `x` }, def, OpsProjectId)).toBe(
      true
    )
    expect(
      devTeamFunctionNeedsUpdate({ ...inSync, description: null }, def, OpsProjectId)
    ).toBe(true)
    expect(
      devTeamFunctionNeedsUpdate({ ...inSync, language: `typescript` }, def, OpsProjectId)
    ).toBe(true)
    expect(devTeamFunctionNeedsUpdate(inSync, def, `pj_other`)).toBe(true)
  })
})

// ── Fake-vs-real casUpdate parity ─────────────────────────────────────────────
//
// The FunctionExecutor suite (repos/backend/src/utils/agent/
// devTeamFunctions.test.ts) exercises the bodies against an in-memory FAKE
// casUpdate. This suite pins that fake against reality: it runs the REAL
// devClaimTask body against the REAL record service's casUpdate (composed on
// the chainable mock-db queue from services/record.test.ts), through the same
// capability mapping the executor's `createRecordsCapability` performs — so a
// semantic drift between the fake and the shipped SQL guard path fails HERE.

/**
 * The chainable, thenable mock-db node from services/record.test.ts: every
 * builder method returns the same node; awaiting it shifts the next queued
 * result. Each record-service method resolves its collection first (one
 * await), then runs its records op (a second await) — results are enqueued
 * collection-first.
 */
const createMockDb = () => {
  const queue: any[] = []
  const enqueue = (...results: any[]) => {
    for (const result of results) queue.push(result)
  }

  const chain: any = {}
  const methods = [
    `from`,
    `where`,
    `orderBy`,
    `limit`,
    `offset`,
    `values`,
    `onConflictDoUpdate`,
    `returning`,
    `set`,
    `groupBy`,
  ]
  for (const method of methods) chain[method] = vi.fn(() => chain)
  chain.then = (resolve: any, reject: any) => {
    const next = queue.length ? queue.shift() : []
    return next instanceof Error ? reject(next) : resolve(next)
  }

  const db = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  } as any

  return { db, enqueue, chain }
}

describe(`devClaimTask against the REAL record service casUpdate (fake-vs-real parity)`, () => {
  const ProjectId = `pj_ops00001`
  const EngOne = `ag_eng0001`
  const dialect = new PgDialect()
  const render = (chunk: any) => dialect.sqlToQuery(chunk)

  const collectionRow = {
    id: `col_dvtsk1`,
    projectId: ProjectId,
    name: `dev_tasks`,
    description: null,
    schema: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const backlogData = {
    title: `Fix flaky pool test`,
    description: `Stabilize the sandbox pool reuse test`,
    state: `backlog`,
    priority: `P2`,
    assignee: null,
    reviewer: null,
    leaseExpiresAt: null,
    claimedAt: null,
    history: [],
    createdBy: `ag_cto0001`,
  }

  const taskRow = (data: Record<string, unknown>) => ({
    id: `rec_dvt0001`,
    collectionId: collectionRow.id,
    projectId: ProjectId,
    data,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  /** Import the REAL Function body source as an ESM module and run its handler. */
  const runBody = async (source: string, context: Record<string, unknown>) => {
    const mod = await import(
      `data:text/javascript;base64,${Buffer.from(source, `utf8`).toString(`base64`)}`
    )
    return mod.default({}, context)
  }

  /**
   * The executor's `createRecordsCapability` mapping (functionExecutor.ts),
   * backed by the REAL record service — the exact get/cas surface a deployed
   * body sees, minus the JSON bridge marshalling (pure data either way).
   */
  const recordsFromService = (service: RecordService) => ({
    get: async (collection: string, id: string) => {
      const { data, error } = await service.get(ProjectId, collection, id)
      if (error) throw new Error(`records.get failed: ${error.message}`)
      return data ? { id: data.id, data: data.data as Record<string, unknown> } : null
    },
    query: async (collection: string, query: any) => {
      const { data, error } = await service.query(ProjectId, collection, query ?? {})
      if (error) throw new Error(`records.query failed: ${error.message}`)
      return (data ?? []).map((rec) => ({
        id: rec.id,
        data: rec.data as Record<string, unknown>,
      }))
    },
    cas: async (collection: string, id: string, match: any, patch: any) => {
      const { data, error, conflict } = await service.casUpdate(
        ProjectId,
        collection,
        id,
        match,
        patch
      )
      if (error) throw new Error(`records.cas failed: ${error.message}`)
      return conflict || !data
        ? { conflict: true as const }
        : { id: data.id, data: data.data as Record<string, unknown> }
    },
  })

  const claimTaskSource = DevTeamFunctionDefs.find(
    (def) => def.name === `devClaimTask`
  )!.content

  it(`WIN: the body claims a backlog task through the real casUpdate SQL guard path`, async () => {
    const { db, enqueue, chain } = createMockDb()
    const service = new RecordService({ db, config: {} } as any)
    // records.get → collection resolve + the backlog row; records.query (the
    // single-claim gate) → collection resolve + NO held claims; records.cas →
    // collection resolve + the updated row (the guard matched).
    enqueue([collectionRow], [taskRow(backlogData)])
    enqueue([collectionRow], [])
    enqueue(
      [collectionRow],
      [taskRow({ ...backlogData, state: `claimed`, assignee: EngOne })]
    )

    const result = await runBody(claimTaskSource, {
      args: { taskId: `rec_dvt0001` },
      caller: { agentId: EngOne },
      records: recordsFromService(service),
    })

    expect(result).toMatchObject({ ok: true, claimed: true, id: `rec_dvt0001` })
    // The real casUpdate compiled the body's guard into the UPDATE's WHERE:
    // state must still be 'backlog', bound as params (the atomic claim).
    // where calls: [0] get's collection resolve, [1] get's record select,
    // [2] the gate query's collection resolve, [3] the gate query itself,
    // [4] cas's collection resolve, [5] the guarded UPDATE itself.
    expect(db.update).toHaveBeenCalledTimes(1)
    const where = render(chain.where.mock.calls[5][0])
    expect(where.params).toContain(`state`)
    expect(where.params).toContain(`backlog`)
    // And the patch merged via jsonb || with the claim fields the fake asserts.
    const set = render(chain.set.mock.calls[0][0].data)
    expect(set.sql).toMatch(/\|\|/)
    expect(set.params[0]).toContain(`"state":"claimed"`)
    expect(set.params[0]).toContain(`"assignee":"${EngOne}"`)
  })

  it(`CONFLICT: a lost race through the real casUpdate surfaces as the body's normal conflict outcome`, async () => {
    const { db, enqueue } = createMockDb()
    const service = new RecordService({ db, config: {} } as any)
    // The read still sees backlog, the single-claim gate finds no held work,
    // but the guarded UPDATE matches no row (a concurrent claim landed
    // between the read and the CAS) → conflict.
    enqueue([collectionRow], [taskRow(backlogData)])
    enqueue([collectionRow], [])
    enqueue([collectionRow], [])

    const result = await runBody(claimTaskSource, {
      args: { taskId: `rec_dvt0001` },
      caller: { agentId: EngOne },
      records: recordsFromService(service),
    })

    expect(result).toMatchObject({
      ok: true,
      claimed: false,
      conflict: true,
      reason: `another engineer won the claim`,
    })
  })

  it(`SINGLE-CLAIM GATE: refuses a second work claim while one is held (no UPDATE runs)`, async () => {
    const { db, enqueue } = createMockDb()
    const service = new RecordService({ db, config: {} } as any)
    // The read sees backlog, but the gate query finds a task this engineer
    // already holds → refused before any CAS.
    enqueue([collectionRow], [taskRow(backlogData)])
    enqueue(
      [collectionRow],
      [
        {
          ...taskRow({ ...backlogData, state: `claimed`, assignee: EngOne }),
          id: `rec_dvtheld`,
        },
      ]
    )

    const result = await runBody(claimTaskSource, {
      args: { taskId: `rec_dvt0001` },
      caller: { agentId: EngOne },
      records: recordsFromService(service),
    })

    expect(result).toMatchObject({ ok: true, claimed: false, conflict: true })
    expect(result.reason).toContain(`already hold a work claim (rec_dvtheld)`)
    expect(db.update).not.toHaveBeenCalled()
  })
})
