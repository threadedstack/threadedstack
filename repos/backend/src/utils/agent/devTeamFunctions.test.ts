import { ESandboxType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Behavior tests for the dev-team effect Functions (realtime engineering team, Phase 2) ──
//
// Each test drives the REAL Function body source (imported from the database
// seeds) through the REAL FunctionExecutor: the mocked isolate reconstructs the
// Function's `context` from the wrapper code the executor feeds it (the same
// technique as devLoopFunctions.test.ts), rebuilds `context.records` from the
// executor's host bridges exactly as the wrapper's recordsContextCode does —
// INCLUDING the `records.cas` bridge, backed by a fake casUpdate that honors
// the real semantics (text-compared scalar guards, null matches absent/null,
// shallow jsonb merge, {conflict:true} on guard loss) — then imports the body
// source as a real ESM module and EXECUTES its default export. So these tests
// exercise the shipped state-machine logic: atomic claims, platform-enforced
// reviewer independence, headSha-bound verdicts, lease renewal, and reaping.

const { mockClose, mockEvaluate, mockReset, mockSandbox, mockCreate } = vi.hoisted(() => {
  const mockClose = vi.fn().mockResolvedValue(undefined)
  const mockReset = vi.fn().mockResolvedValue(undefined)
  const mockEvaluate = vi.fn()
  const mockSandbox = { evaluate: mockEvaluate, close: mockClose, reset: mockReset }
  const mockCreate = vi.fn().mockResolvedValue(mockSandbox)
  return { mockClose, mockEvaluate, mockReset, mockSandbox, mockCreate }
})

vi.mock(`@tdsk/sandbox`, () => ({
  createSandboxProvider: vi.fn().mockReturnValue({
    type: ESandboxType.local,
    create: mockCreate,
  }),
}))

vi.mock(`esbuild`, () => ({
  transform: vi
    .fn()
    .mockResolvedValue({ code: `const stripped = true;\nexport default stripped;` }),
}))

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import { DevAddTaskFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devAddTask'
import { DevClaimTaskFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devClaimTask'
import { DevSubmitPrFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devSubmitPr'
import { DevClaimReviewFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devClaimReview'
import { DevCompleteReviewFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devCompleteReview'
import { DevMarkMergedFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devMarkMerged'
import { DevUpdatePrFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devUpdatePr'
import { DevRenewLeaseFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devRenewLease'
import { DevReapExpiredFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devReapExpired'
import { DevAbandonFunctionDef } from '@tdsk/database/seeds/dev-team/functions/devAbandon'

// ── Harness ──────────────────────────────────────────────────────────────────

const ProjectId = `proj-devteam`
const EngOne = { agentId: `ag_eng0001` }
const EngTwo = { agentId: `ag_eng0002` }
const Cto = { agentId: `ag_cto0001` }

const MinuteMs = 60 * 1000

/**
 * In-memory stand-in for db.services.record with op-aware where filtering
 * (`eq` default, `in`, `ne`, `lt` — matching the real compileRecordQuery
 * semantics for the ops the dev-team Functions use; `lt` text-compares like
 * the real `data ->> field < value`, numerically correct for equal-width
 * epoch-ms strings) plus a `casUpdate` honoring the real record service's
 * semantics: every match key text-compares against the stored scalar (`null`
 * matches absent/SQL-NULL), the patch shallow-merges, and a guard loss (or a
 * missing row) returns { conflict: true } instead of a row.
 */
const makeFakeDb = () => {
  const store = new Map<string, Map<string, { id: string; data: any }>>()
  const key = (p: string, c: string) => `${p}::${c}`

  const matches = (rec: { data: any }, f: { field: string; op?: string; value: any }) => {
    const value = rec.data?.[f.field]
    if (f.op === `in`) return Array.isArray(f.value) && f.value.includes(value)
    if (f.op === `ne`) return value !== f.value
    if (f.op === `lt`)
      return value !== undefined && value !== null && String(value) < String(f.value)
    return value === f.value
  }

  const record = {
    upsert: vi.fn(
      async (
        projectId: string,
        collection: string,
        input: { id?: string; data: any }
      ) => {
        const k = key(projectId, collection)
        if (!store.has(k)) store.set(k, new Map())
        const id = input.id ?? `rec_${store.get(k)!.size + 1}`
        store.get(k)!.set(id, { id, data: input.data })
        return { data: { id } }
      }
    ),
    query: vi.fn(
      async (
        projectId: string,
        collection: string,
        query: { where?: Array<{ field: string; op?: string; value: unknown }> } = {}
      ) => {
        let rows = Array.from(store.get(key(projectId, collection))?.values() ?? [])
        for (const f of query.where ?? []) rows = rows.filter((rec) => matches(rec, f))
        return { data: rows }
      }
    ),
    get: vi.fn(async (projectId: string, collection: string, id: string) => {
      const rec = store.get(key(projectId, collection))?.get(id)
      return rec ? { data: rec } : {}
    }),
    delete: vi.fn(async (projectId: string, collection: string, id: string) => {
      const map = store.get(key(projectId, collection))
      const rec = map?.get(id)
      map?.delete(id)
      return rec ? { data: rec } : {}
    }),
    count: vi.fn(async (projectId: string, collection: string) => ({
      data: store.get(key(projectId, collection))?.size ?? 0,
    })),
    // The real casUpdate's semantics, in memory: text-compared scalar guards
    // (jsonb ->> parity), null matches absent/null, SHALLOW merge, conflict on
    // guard loss.
    casUpdate: vi.fn(
      async (
        projectId: string,
        collection: string,
        id: string,
        match: Record<string, string | number | boolean | null>,
        patch: Record<string, unknown>
      ) => {
        const rec = store.get(key(projectId, collection))?.get(id)
        if (!rec) return { conflict: true }
        for (const [field, expected] of Object.entries(match)) {
          const current = rec.data?.[field]
          if (expected === null) {
            if (current !== null && current !== undefined) return { conflict: true }
          } else if (
            current === null ||
            current === undefined ||
            String(current) !== String(expected)
          )
            return { conflict: true }
        }
        rec.data = { ...rec.data, ...patch }
        return { data: rec }
      }
    ),
  }

  const seed = (collection: string, id: string, data: any) => {
    const k = key(ProjectId, collection)
    if (!store.has(k)) store.set(k, new Map())
    store.get(k)!.set(id, { id, data })
  }
  const rows = (collection: string) =>
    Array.from(store.get(key(ProjectId, collection))?.values() ?? [])
  const row = (collection: string, id: string) =>
    store.get(key(ProjectId, collection))?.get(id)

  return { db: { services: { record } } as any, record, seed, rows, row }
}

type THarness = ReturnType<typeof makeFakeDb>

/**
 * Reconstruct the Function's `context` object from the wrapper code the
 * executor hands the isolate (reverse the double JSON.stringify).
 */
const contextFromWrapper = (wrapper: string): Record<string, any> => {
  const match = wrapper.match(/const context = JSON\.parse\(("(?:\\.|[^"\\])*")\)/)
  if (!match) throw new Error(`could not extract context from wrapper code`)
  return JSON.parse(JSON.parse(match[1]))
}

/**
 * Rebuild `context.records` from the executor's host bridges exactly as the
 * wrapper's recordsContextCode does inside the isolate — including `cas`. The
 * JSON round trip means the body sees SNAPSHOTS, exactly like the real isolate
 * boundary (so a post-read store mutation models a true concurrent write).
 */
const recordsFromBridges = (
  bridges: Record<string, (json: string) => Promise<string>>
) => {
  const call = (name: string, args: unknown[]) =>
    bridges[name](JSON.stringify(args)).then((res) => JSON.parse(res))
  return {
    query: (collection: string, query?: unknown) =>
      call(`records.query`, [collection, query]),
    get: (collection: string, id: string) => call(`records.get`, [collection, id]),
    upsert: (collection: string, record: unknown) =>
      call(`records.upsert`, [collection, record]),
    delete: (collection: string, id: string) => call(`records.delete`, [collection, id]),
    count: (collection: string, query?: unknown) =>
      call(`records.count`, [collection, query]),
    cas: (collection: string, id: string, match: unknown, patch: unknown) =>
      call(`records.cas`, [collection, id, match, patch]),
  }
}

/**
 * Mocked isolate that imports the REAL Function body source as an ESM module
 * (`data:` import — the isolate's own `import handler from 'function'`), then
 * EXECUTES its default export and reproduces the wrapper's success/error
 * envelope + JSON output round trip.
 */
const runRealFunctionBody = () =>
  mockEvaluate.mockImplementation(async (wrapperCode: string, opts: any) => {
    const context = contextFromWrapper(wrapperCode)
    if (opts?.bridges) context.records = recordsFromBridges(opts.bridges)
    const mod = await import(
      `data:text/javascript;base64,${Buffer.from(opts.modules.function, `utf8`).toString(`base64`)}`
    )
    try {
      const raw = await mod.default({}, context)
      return {
        output: ``,
        result: { success: true, output: JSON.parse(JSON.stringify(raw ?? null)) },
      }
    } catch (err: any) {
      return {
        output: ``,
        result: { success: false, error: err?.message || String(err) },
      }
    }
  })

/** Execute a seeded dev-team Function def through the REAL FunctionExecutor. */
const runFn = (
  def: { id: string; name: string; content: string; language: string },
  h: THarness,
  args: Record<string, unknown>,
  caller?: { agentId?: string; scheduleId?: string }
) =>
  FunctionExecutor.execute(
    { ...def, projectId: ProjectId },
    { db: h.db, context: { args, caller } }
  )

/** Seed one dev_tasks record with sane backlog defaults. */
const seedTask = (h: THarness, id: string, overrides: Record<string, unknown> = {}) =>
  h.seed(`dev_tasks`, id, {
    title: `Fix flaky pool test`,
    description: `Stabilize the sandbox pool reuse test`,
    state: `backlog`,
    priority: `P2`,
    assignee: null,
    reviewer: null,
    leaseExpiresAt: null,
    claimedAt: null,
    prNumber: null,
    prUrl: null,
    branch: null,
    headSha: null,
    evidence: null,
    sourceTaskProposalId: null,
    notes: null,
    history: [],
    createdBy: Cto.agentId,
    ...overrides,
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(mockSandbox)
  mockClose.mockResolvedValue(undefined)
  mockReset.mockResolvedValue(undefined)
  runRealFunctionBody()
})

// ── devClaimTask — the atomic work claim ──────────────────────────────────────

describe(`devClaimTask Function`, () => {
  it(`wins the backlog claim: assignee + claimedAt + 20-minute lease + history entry`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`)
    const before = Date.now()

    const result = await runFn(DevClaimTaskFunctionDef, h, { taskId: `dt_1` }, EngOne)

    expect(result.success).toBe(true)
    expect(result.output).toMatchObject({ ok: true, claimed: true, id: `dt_1` })

    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data.state).toBe(`claimed`)
    expect(data.assignee).toBe(EngOne.agentId)
    expect(data.claimedAt).toBeGreaterThanOrEqual(before)
    expect(data.leaseExpiresAt).toBeGreaterThanOrEqual(before + 20 * MinuteMs)
    expect(data.leaseExpiresAt).toBeLessThanOrEqual(Date.now() + 20 * MinuteMs)
    expect(data.history).toHaveLength(1)
    expect(data.history[0]).toMatchObject({
      from: `backlog`,
      to: `claimed`,
      by: EngOne.agentId,
    })
  })

  it(`exactly one of two racing engineers wins — the loser gets conflict as a NORMAL outcome`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`)

    const first = await runFn(DevClaimTaskFunctionDef, h, { taskId: `dt_1` }, EngOne)
    const second = await runFn(DevClaimTaskFunctionDef, h, { taskId: `dt_1` }, EngTwo)

    expect(first.output).toMatchObject({ ok: true, claimed: true })
    expect(second.output).toMatchObject({ ok: true, claimed: false, conflict: true })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.assignee).toBe(EngOne.agentId)
  })

  it(`refuses a spoofed agentId arg — the platform-injected caller is authoritative`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`)

    const result = await runFn(
      DevClaimTaskFunctionDef,
      h,
      { taskId: `dt_1`, agentId: EngTwo.agentId },
      EngOne
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `agentId mismatch: the platform-injected caller identity is authoritative`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`backlog`)
  })

  it(`rejects a missing caller identity and a missing task`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`)

    const noCaller = await runFn(DevClaimTaskFunctionDef, h, { taskId: `dt_1` })
    expect(noCaller.output).toEqual({ ok: false, reason: `no caller identity` })

    const ghost = await runFn(DevClaimTaskFunctionDef, h, { taskId: `dt_ghost` }, EngOne)
    expect(ghost.output).toEqual({ ok: false, reason: `task not found` })
  })
})

// ── devSubmitPr — author attaches the PR ──────────────────────────────────────

describe(`devSubmitPr Function`, () => {
  const claimedBy = (h: THarness, agentId: string) =>
    seedTask(h, `dt_1`, {
      state: `claimed`,
      assignee: agentId,
      claimedAt: Date.now() - MinuteMs,
      leaseExpiresAt: Date.now() + 10 * MinuteMs,
      history: [{ at: `t0`, from: `backlog`, to: `claimed`, by: agentId }],
    })

  it(`records the PR: pr_open + prNumber/prUrl/branch/headSha, lease nulled, history appended`, async () => {
    const h = makeFakeDb()
    claimedBy(h, EngOne.agentId)

    const result = await runFn(
      DevSubmitPrFunctionDef,
      h,
      {
        taskId: `dt_1`,
        prNumber: 42,
        prUrl: ` https://github.com/x/pull/42 `,
        branch: ` eng/fix-pool `,
        headSha: ` abc123 `,
      },
      EngOne
    )

    expect(result.output).toMatchObject({ ok: true, submitted: true, prNumber: 42 })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data).toMatchObject({
      state: `pr_open`,
      prNumber: 42,
      prUrl: `https://github.com/x/pull/42`,
      branch: `eng/fix-pool`,
      headSha: `abc123`,
      leaseExpiresAt: null,
    })
    expect(data.history).toHaveLength(2)
    expect(data.history[1]).toMatchObject({
      from: `claimed`,
      to: `pr_open`,
      by: EngOne.agentId,
    })
  })

  it(`refuses a caller that does not hold the work claim`, async () => {
    const h = makeFakeDb()
    claimedBy(h, EngOne.agentId)

    const result = await runFn(
      DevSubmitPrFunctionDef,
      h,
      { taskId: `dt_1`, prNumber: 42, prUrl: `u`, branch: `b`, headSha: `s` },
      EngTwo
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `you do not hold the work claim on this task`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`claimed`)
  })

  it(`validates prNumber and the required PR fields`, async () => {
    const h = makeFakeDb()
    claimedBy(h, EngOne.agentId)

    const badPr = await runFn(
      DevSubmitPrFunctionDef,
      h,
      { taskId: `dt_1`, prNumber: `nope`, prUrl: `u`, branch: `b`, headSha: `s` },
      EngOne
    )
    expect(badPr.output).toEqual({
      ok: false,
      reason: `prNumber must be a positive integer`,
    })

    const missing = await runFn(
      DevSubmitPrFunctionDef,
      h,
      { taskId: `dt_1`, prNumber: 42, prUrl: `u`, branch: `b` },
      EngOne
    )
    expect(missing.output).toEqual({
      ok: false,
      reason: `prUrl, branch and headSha are required`,
    })
  })
})

// ── devClaimReview — platform-enforced reviewer independence ──────────────────

describe(`devClaimReview Function`, () => {
  const prOpenBy = (h: THarness, authorId: string) =>
    seedTask(h, `dt_1`, {
      state: `pr_open`,
      assignee: authorId,
      prNumber: 42,
      prUrl: `https://github.com/x/pull/42`,
      branch: `eng/fix-pool`,
      headSha: `abc123`,
      history: [],
    })

  it(`REFUSES the author's own PR — reviewer can never equal assignee`, async () => {
    const h = makeFakeDb()
    prOpenBy(h, EngOne.agentId)

    const result = await runFn(DevClaimReviewFunctionDef, h, { taskId: `dt_1` }, EngOne)

    expect(result.output).toEqual({
      ok: false,
      reason: `you authored this PR, an author never reviews their own work`,
    })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data.state).toBe(`pr_open`)
    expect(data.reviewer).toBeNull()
  })

  it(`the OTHER engineer wins the review: in_review + reviewer + lease + the reviewed headSha back`, async () => {
    const h = makeFakeDb()
    prOpenBy(h, EngOne.agentId)
    const before = Date.now()

    const result = await runFn(DevClaimReviewFunctionDef, h, { taskId: `dt_1` }, EngTwo)

    expect(result.output).toMatchObject({ ok: true, claimed: true, headSha: `abc123` })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data.state).toBe(`in_review`)
    expect(data.reviewer).toBe(EngTwo.agentId)
    expect(data.leaseExpiresAt).toBeGreaterThanOrEqual(before + 20 * MinuteMs)
    expect(data.history[0]).toMatchObject({
      from: `pr_open`,
      to: `in_review`,
      by: EngTwo.agentId,
    })
  })

  it(`a held review conflicts as a normal outcome`, async () => {
    const h = makeFakeDb()
    prOpenBy(h, EngOne.agentId)
    await runFn(DevClaimReviewFunctionDef, h, { taskId: `dt_1` }, EngTwo)

    const again = await runFn(DevClaimReviewFunctionDef, h, { taskId: `dt_1` }, EngTwo)

    expect(again.output).toMatchObject({ ok: true, claimed: false, conflict: true })
  })
})

// ── devCompleteReview — verdict bound to reviewer + headSha ───────────────────

describe(`devCompleteReview Function`, () => {
  const inReview = (h: THarness) =>
    seedTask(h, `dt_1`, {
      state: `in_review`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      prNumber: 42,
      headSha: `abc123`,
      leaseExpiresAt: Date.now() + 10 * MinuteMs,
      history: [],
    })

  it(`REFUSES a caller that is not the recorded reviewer`, async () => {
    const h = makeFakeDb()
    inReview(h)

    const result = await runFn(
      DevCompleteReviewFunctionDef,
      h,
      { taskId: `dt_1`, verdict: `approved`, headSha: `abc123` },
      EngOne
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `you are not the recorded reviewer on this task`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`in_review`)
  })

  it(`REFUSES a stale headSha — a new push voids the review`, async () => {
    const h = makeFakeDb()
    inReview(h)

    const result = await runFn(
      DevCompleteReviewFunctionDef,
      h,
      { taskId: `dt_1`, verdict: `approved`, headSha: `stale99` },
      EngTwo
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `headSha mismatch, a new push voided this review; re-review the current head`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`in_review`)
  })

  it(`records approved: state + notes + the reviewer's 60-minute merge lease + history`, async () => {
    const h = makeFakeDb()
    inReview(h)
    const before = Date.now()

    const result = await runFn(
      DevCompleteReviewFunctionDef,
      h,
      { taskId: `dt_1`, verdict: `approved`, headSha: `abc123`, notes: ` ship it ` },
      EngTwo
    )

    expect(result.output).toMatchObject({ ok: true, completed: true, state: `approved` })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data).toMatchObject({ state: `approved`, notes: `ship it` })
    // The verdict is an OBLIGATION: the recorded reviewer owes the merge
    // inside a fresh 60-minute lease (never null — a wedge state otherwise).
    expect(data.leaseExpiresAt).toBeGreaterThanOrEqual(before + 60 * MinuteMs)
    expect(data.leaseExpiresAt).toBeLessThanOrEqual(Date.now() + 60 * MinuteMs)
    expect(data.history[0]).toMatchObject({
      from: `in_review`,
      to: `approved`,
      by: EngTwo.agentId,
    })
  })

  it(`changes_requested REQUIRES actionable notes, then records them with the author's fix lease`, async () => {
    const h = makeFakeDb()
    inReview(h)
    const before = Date.now()

    const noNotes = await runFn(
      DevCompleteReviewFunctionDef,
      h,
      { taskId: `dt_1`, verdict: `changes_requested`, headSha: `abc123` },
      EngTwo
    )
    expect(noNotes.output).toEqual({
      ok: false,
      reason: `notes are required when requesting changes`,
    })

    const withNotes = await runFn(
      DevCompleteReviewFunctionDef,
      h,
      {
        taskId: `dt_1`,
        verdict: `changes_requested`,
        headSha: `abc123`,
        notes: `missing test for the conflict path`,
      },
      EngTwo
    )
    expect(withNotes.output).toMatchObject({ ok: true, state: `changes_requested` })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data.notes).toBe(`missing test for the conflict path`)
    // The author owes the fix inside a fresh 60-minute lease.
    expect(data.leaseExpiresAt).toBeGreaterThanOrEqual(before + 60 * MinuteMs)
    expect(data.leaseExpiresAt).toBeLessThanOrEqual(Date.now() + 60 * MinuteMs)
  })

  it(`rejects an invalid verdict`, async () => {
    const h = makeFakeDb()
    inReview(h)

    const result = await runFn(
      DevCompleteReviewFunctionDef,
      h,
      { taskId: `dt_1`, verdict: `lgtm`, headSha: `abc123` },
      EngTwo
    )
    expect(result.output).toEqual({
      ok: false,
      reason: `invalid verdict: lgtm (approved | changes_requested)`,
    })
  })
})

// ── devUpdatePr — the author's fix push re-opens the review ───────────────────

describe(`devUpdatePr Function`, () => {
  const changesRequested = (h: THarness) =>
    seedTask(h, `dt_1`, {
      state: `changes_requested`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      prNumber: 42,
      headSha: `abc123`,
      notes: `missing test`,
      leaseExpiresAt: Date.now() + 30 * MinuteMs,
      history: [],
    })

  it(`re-enters pr_open with the new head, clearing reviewer + notes + the fix lease (the stale review is void)`, async () => {
    const h = makeFakeDb()
    changesRequested(h)

    const result = await runFn(
      DevUpdatePrFunctionDef,
      h,
      { taskId: `dt_1`, headSha: `def456` },
      EngOne
    )

    expect(result.output).toMatchObject({ ok: true, updated: true, headSha: `def456` })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data).toMatchObject({
      state: `pr_open`,
      headSha: `def456`,
      reviewer: null,
      notes: ``,
      // pr_open is not a leased state — the verdict's fix lease is cleared.
      leaseExpiresAt: null,
    })
    expect(data.history[0]).toMatchObject({
      from: `changes_requested`,
      to: `pr_open`,
      by: EngOne.agentId,
    })
  })

  it(`refuses a caller that is not the assignee`, async () => {
    const h = makeFakeDb()
    changesRequested(h)

    const result = await runFn(
      DevUpdatePrFunctionDef,
      h,
      { taskId: `dt_1`, headSha: `def456` },
      EngTwo
    )

    expect(result.output).toEqual({
      ok: false,
      reason: `you do not hold the work claim on this task`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.reviewer).toBe(EngTwo.agentId)
  })
})

// ── devMarkMerged — only the recorded reviewer closes the loop ────────────────

describe(`devMarkMerged Function`, () => {
  const approved = (h: THarness) =>
    seedTask(h, `dt_1`, {
      state: `approved`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      prNumber: 42,
      headSha: `abc123`,
      history: [],
    })

  it(`the recorded reviewer marks the merge: approved → merged`, async () => {
    const h = makeFakeDb()
    approved(h)

    const result = await runFn(DevMarkMergedFunctionDef, h, { taskId: `dt_1` }, EngTwo)

    expect(result.output).toMatchObject({ ok: true, merged: true })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data.state).toBe(`merged`)
    expect(data.history[0]).toMatchObject({
      from: `approved`,
      to: `merged`,
      by: EngTwo.agentId,
    })
  })

  it(`refuses everyone else — including the author`, async () => {
    const h = makeFakeDb()
    approved(h)

    const result = await runFn(DevMarkMergedFunctionDef, h, { taskId: `dt_1` }, EngOne)

    expect(result.output).toEqual({
      ok: false,
      reason: `only the recorded reviewer marks a task merged`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`approved`)
  })
})

// ── devRenewLease — claim liveness ────────────────────────────────────────────

describe(`devRenewLease Function`, () => {
  it(`renews the assignee's lease on a claimed task (no history growth)`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`, {
      state: `claimed`,
      assignee: EngOne.agentId,
      leaseExpiresAt: Date.now() + MinuteMs,
      history: [{ at: `t0`, from: `backlog`, to: `claimed`, by: EngOne.agentId }],
    })
    const before = Date.now()

    const result = await runFn(DevRenewLeaseFunctionDef, h, { taskId: `dt_1` }, EngOne)

    expect(result.output).toMatchObject({ ok: true, renewed: true })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data.leaseExpiresAt).toBeGreaterThanOrEqual(before + 20 * MinuteMs)
    // Not a transition — history untouched.
    expect(data.history).toHaveLength(1)
  })

  it(`renews the reviewer's lease on an in_review task`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`, {
      state: `in_review`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      leaseExpiresAt: Date.now() + MinuteMs,
    })

    const result = await runFn(DevRenewLeaseFunctionDef, h, { taskId: `dt_1` }, EngTwo)

    expect(result.output).toMatchObject({ ok: true, renewed: true })
  })

  it(`refuses a seat holding no lease on the task`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`, {
      state: `claimed`,
      assignee: EngOne.agentId,
      leaseExpiresAt: Date.now() + MinuteMs,
    })

    const result = await runFn(DevRenewLeaseFunctionDef, h, { taskId: `dt_1` }, EngTwo)

    expect(result.output).toEqual({
      ok: false,
      reason: `no active lease held on this task (state: claimed)`,
    })
  })

  it(`caps a runaway requested lease at now+60min`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`, {
      state: `claimed`,
      assignee: EngOne.agentId,
      leaseExpiresAt: Date.now() + MinuteMs,
    })

    const result = await runFn(
      DevRenewLeaseFunctionDef,
      h,
      { taskId: `dt_1`, leaseExpiresAt: Date.now() + 24 * 60 * MinuteMs },
      EngOne
    )

    const { leaseExpiresAt } = result.output as any
    expect(leaseExpiresAt).toBeLessThanOrEqual(Date.now() + 60 * MinuteMs)
  })
})

// ── devAddTask — CTO grooming ─────────────────────────────────────────────────

describe(`devAddTask Function`, () => {
  it(`creates a backlog task stamped with the trusted caller as createdBy`, async () => {
    const h = makeFakeDb()

    const result = await runFn(
      DevAddTaskFunctionDef,
      h,
      {
        title: ` Add pool conflict test `,
        description: ` Cover the cas conflict path in the pool `,
        priority: `P1`,
        evidence: `coverage gap in functionExecutor.test.ts`,
      },
      Cto
    )

    expect(result.output).toMatchObject({ ok: true, added: true, state: `backlog` })
    const tasks = h.rows(`dev_tasks`)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].data).toMatchObject({
      title: `Add pool conflict test`,
      description: `Cover the cas conflict path in the pool`,
      state: `backlog`,
      priority: `P1`,
      assignee: null,
      reviewer: null,
      createdBy: Cto.agentId,
    })
    expect(tasks[0].data.history[0]).toMatchObject({
      from: null,
      to: `backlog`,
      by: Cto.agentId,
    })
  })

  it(`coerces an invalid priority to P3 and dedupes an open identical title`, async () => {
    const h = makeFakeDb()

    const first = await runFn(
      DevAddTaskFunctionDef,
      h,
      { title: `Fix docs typo`, description: `d`, priority: `urgent` },
      Cto
    )
    expect((first.output as any).added).toBe(true)
    expect(h.rows(`dev_tasks`)[0].data.priority).toBe(`P3`)

    const dup = await runFn(
      DevAddTaskFunctionDef,
      h,
      { title: `Fix docs typo`, description: `again` },
      Cto
    )
    expect(dup.output).toMatchObject({ ok: true, added: false, deduped: true })
    expect(h.rows(`dev_tasks`)).toHaveLength(1)
  })

  it(`stamps sourceTaskProposalId and dedupes a re-groomed proposal even under a new title`, async () => {
    const h = makeFakeDb()

    const first = await runFn(
      DevAddTaskFunctionDef,
      h,
      {
        title: `Add SSRF unit coverage`,
        description: `Cover the egress guard's redirect path`,
        sourceTaskProposalId: `tp_abc123`,
      },
      Cto
    )
    expect((first.output as any).added).toBe(true)
    expect(h.rows(`dev_tasks`)[0].data.sourceTaskProposalId).toBe(`tp_abc123`)

    // A decomposition of the SAME proposal gives a DIFFERENT title, so only the
    // sourceTaskProposalId dedupe can catch it — it must, or an unpromoted
    // proposal re-grooms unboundedly every cycle.
    const dup = await runFn(
      DevAddTaskFunctionDef,
      h,
      {
        title: `Cover the egress guard redirect branch`,
        description: `same proposal, decomposed differently`,
        sourceTaskProposalId: `tp_abc123`,
      },
      Cto
    )
    expect(dup.output).toMatchObject({
      ok: true,
      added: false,
      deduped: true,
      id: h.rows(`dev_tasks`)[0].id,
    })
    expect(h.rows(`dev_tasks`)).toHaveLength(1)

    // A DIFFERENT proposal with a fresh title is a real, distinct task.
    const other = await runFn(
      DevAddTaskFunctionDef,
      h,
      {
        title: `Add pool reuse test`,
        description: `unrelated proposal`,
        sourceTaskProposalId: `tp_def456`,
      },
      Cto
    )
    expect((other.output as any).added).toBe(true)
    expect(h.rows(`dev_tasks`)).toHaveLength(2)
  })

  it(`refuses a spoofed createdBy and a missing caller`, async () => {
    const h = makeFakeDb()

    const spoof = await runFn(
      DevAddTaskFunctionDef,
      h,
      { title: `t`, description: `d`, createdBy: EngOne.agentId },
      Cto
    )
    expect(spoof.output).toEqual({
      ok: false,
      reason: `createdBy mismatch: the platform-injected caller identity is authoritative`,
    })

    const noCaller = await runFn(DevAddTaskFunctionDef, h, {
      title: `t`,
      description: `d`,
    })
    expect(noCaller.output).toEqual({ ok: false, reason: `no caller identity` })
    expect(h.rows(`dev_tasks`)).toHaveLength(0)
  })
})

// ── devReapExpired — lease reaping, renewal-safe ──────────────────────────────

describe(`devReapExpired Function`, () => {
  it(`reclaims expired claims (→ backlog) and expired reviews (→ pr_open), skipping live leases`, async () => {
    const h = makeFakeDb()
    const now = Date.now()
    seedTask(h, `dt_dead_claim`, {
      state: `claimed`,
      assignee: EngOne.agentId,
      claimedAt: now - 30 * MinuteMs,
      leaseExpiresAt: now - 5 * MinuteMs,
      history: [],
    })
    seedTask(h, `dt_dead_review`, {
      state: `in_review`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      prNumber: 42,
      prUrl: `https://github.com/x/pull/42`,
      branch: `eng/fix`,
      headSha: `abc123`,
      leaseExpiresAt: now - MinuteMs,
      history: [],
    })
    seedTask(h, `dt_alive`, {
      state: `claimed`,
      assignee: EngTwo.agentId,
      leaseExpiresAt: now + 10 * MinuteMs,
    })

    const result = await runFn(DevReapExpiredFunctionDef, h, {}, Cto)

    const output = result.output as any
    expect(output.ok).toBe(true)
    expect(output.conflicts).toEqual([])
    expect(output.reaped).toHaveLength(2)
    expect(output.candidates).toHaveLength(2)

    // Expired claim back to backlog, holder cleared.
    const claim = h.row(`dev_tasks`, `dt_dead_claim`)!.data
    expect(claim).toMatchObject({
      state: `backlog`,
      assignee: null,
      claimedAt: null,
      leaseExpiresAt: null,
    })
    expect(claim.history[0]).toMatchObject({
      from: `claimed`,
      to: `backlog`,
      by: Cto.agentId,
    })

    // Expired review back to pr_open, reviewer cleared, PR anchors intact.
    const review = h.row(`dev_tasks`, `dt_dead_review`)!.data
    expect(review).toMatchObject({
      state: `pr_open`,
      reviewer: null,
      leaseExpiresAt: null,
      prNumber: 42,
      headSha: `abc123`,
    })

    // The candidates carry the GitHub anchors the CTO reconciles with gh.
    const reviewCandidate = output.candidates.find(
      (cand: any) => cand.id === `dt_dead_review`
    )
    expect(reviewCandidate).toMatchObject({
      state: `in_review`,
      reviewer: EngTwo.agentId,
      prNumber: 42,
      prUrl: `https://github.com/x/pull/42`,
      branch: `eng/fix`,
      headSha: `abc123`,
    })

    // The live lease was never touched.
    expect(h.row(`dev_tasks`, `dt_alive`)!.data.state).toBe(`claimed`)
  })

  it(`recovers the verdict wedges: expired approved → pr_open (re-review), expired changes_requested → backlog (rework)`, async () => {
    const h = makeFakeDb()
    const now = Date.now()
    // The reviewer never merged inside its 60-minute merge lease.
    seedTask(h, `dt_dead_approved`, {
      state: `approved`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      prNumber: 42,
      prUrl: `https://github.com/x/pull/42`,
      branch: `eng/fix`,
      headSha: `abc123`,
      leaseExpiresAt: now - MinuteMs,
      history: [],
    })
    // The author never pushed the fix inside its 60-minute fix lease.
    seedTask(h, `dt_dead_changes`, {
      state: `changes_requested`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      claimedAt: now - 90 * MinuteMs,
      prNumber: 43,
      prUrl: `https://github.com/x/pull/43`,
      branch: `eng/fix-2`,
      headSha: `def456`,
      notes: `missing test`,
      leaseExpiresAt: now - 5 * MinuteMs,
      history: [],
    })

    const result = await runFn(DevReapExpiredFunctionDef, h, {}, Cto)

    const output = result.output as any
    expect(output.ok).toBe(true)
    expect(output.conflicts).toEqual([])
    expect(output.reaped).toHaveLength(2)

    // Expired approved re-enters the review race: reviewer cleared, the
    // author's claim and every PR anchor intact.
    const approved = h.row(`dev_tasks`, `dt_dead_approved`)!.data
    expect(approved).toMatchObject({
      state: `pr_open`,
      assignee: EngOne.agentId,
      reviewer: null,
      leaseExpiresAt: null,
      prNumber: 42,
      headSha: `abc123`,
    })
    expect(approved.history[0]).toMatchObject({
      from: `approved`,
      to: `pr_open`,
      by: Cto.agentId,
    })
    // The reviewer owed the merge — it is the reaped entry's holder.
    expect(output.reaped.find((rec: any) => rec.id === `dt_dead_approved`)).toMatchObject(
      { from: `approved`, to: `pr_open`, holder: EngTwo.agentId }
    )

    // Expired changes_requested goes back to rework: assignee AND reviewer
    // cleared, PR anchors intact for the next claimer.
    const changes = h.row(`dev_tasks`, `dt_dead_changes`)!.data
    expect(changes).toMatchObject({
      state: `backlog`,
      assignee: null,
      reviewer: null,
      claimedAt: null,
      leaseExpiresAt: null,
      prNumber: 43,
      branch: `eng/fix-2`,
      headSha: `def456`,
    })
    expect(changes.history[0]).toMatchObject({
      from: `changes_requested`,
      to: `backlog`,
      by: Cto.agentId,
    })
    // The author owed the fix — it is the reaped entry's holder.
    expect(output.reaped.find((rec: any) => rec.id === `dt_dead_changes`)).toMatchObject({
      from: `changes_requested`,
      to: `backlog`,
      holder: EngOne.agentId,
    })
  })

  it(`a renewal landing between the reap's read and its CAS wins — the holder is never clobbered`, async () => {
    const h = makeFakeDb()
    const now = Date.now()
    seedTask(h, `dt_1`, {
      state: `claimed`,
      assignee: EngOne.agentId,
      leaseExpiresAt: now - MinuteMs,
      history: [],
    })

    // Simulate the race: the holder's devRenewLease lands AFTER the reap's
    // read but BEFORE its CAS. Freeze the read (deep copy — the SELECT's
    // result set) before mutating the store, so the body guards on the stale
    // lease while the record already carries the renewed one.
    const impl = h.record.query.getMockImplementation()!
    h.record.query.mockImplementationOnce(async (...args: any[]) => {
      const res = await (impl as any)(...args)
      const snapshot = JSON.parse(JSON.stringify(res))
      h.row(`dev_tasks`, `dt_1`)!.data.leaseExpiresAt = now + 20 * MinuteMs
      return snapshot
    })

    const result = await runFn(DevReapExpiredFunctionDef, h, {}, Cto)

    const output = result.output as any
    expect(output.reaped).toEqual([])
    expect(output.conflicts).toEqual([`dt_1`])
    // The renewed claim survives untouched.
    expect(h.row(`dev_tasks`, `dt_1`)!.data).toMatchObject({
      state: `claimed`,
      assignee: EngOne.agentId,
      leaseExpiresAt: now + 20 * MinuteMs,
    })
  })

  it(`rejects a missing caller identity`, async () => {
    const h = makeFakeDb()
    const result = await runFn(DevReapExpiredFunctionDef, h, {})
    expect(result.output).toEqual({ ok: false, reason: `no caller identity` })
  })
})

// ── devAbandon — the CTO lead's explicit close-out ────────────────────────────

describe(`devAbandon Function`, () => {
  it(`closes out a non-terminal task: abandoned + reason in notes + holders cleared + history`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`, {
      state: `changes_requested`,
      assignee: EngOne.agentId,
      reviewer: EngTwo.agentId,
      claimedAt: Date.now() - 30 * MinuteMs,
      prNumber: 42,
      prUrl: `https://github.com/x/pull/42`,
      branch: `eng/fix`,
      headSha: `abc123`,
      notes: `missing test`,
      leaseExpiresAt: Date.now() + 10 * MinuteMs,
      history: [],
    })

    const result = await runFn(
      DevAbandonFunctionDef,
      h,
      { taskId: `dt_1`, reason: `superseded by the shared-pool refactor in PR #57` },
      Cto
    )

    expect(result.output).toMatchObject({
      ok: true,
      abandoned: true,
      id: `dt_1`,
      state: `abandoned`,
    })
    const { data } = h.row(`dev_tasks`, `dt_1`)!
    expect(data).toMatchObject({
      state: `abandoned`,
      notes: `superseded by the shared-pool refactor in PR #57`,
      assignee: null,
      reviewer: null,
      claimedAt: null,
      leaseExpiresAt: null,
      // The PR anchors stay on the terminal record — the audit trail survives.
      prNumber: 42,
      branch: `eng/fix`,
    })
    expect(data.history[0]).toMatchObject({
      from: `changes_requested`,
      to: `abandoned`,
      by: Cto.agentId,
    })
  })

  it(`REQUIRES a reason — a close-out without the record's last word is refused`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`)

    const result = await runFn(DevAbandonFunctionDef, h, { taskId: `dt_1` }, Cto)

    expect(result.output).toEqual({
      ok: false,
      reason: `reason is required (the close-out is the record's last word)`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`backlog`)
  })

  it(`refuses a terminal task as a normal conflict outcome`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`, { state: `merged`, history: [] })

    const result = await runFn(
      DevAbandonFunctionDef,
      h,
      { taskId: `dt_1`, reason: `cleanup` },
      Cto
    )

    expect(result.output).toMatchObject({
      ok: true,
      abandoned: false,
      conflict: true,
      reason: `task is already terminal (state: merged)`,
    })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`merged`)
  })

  it(`a concurrent transition wins — the CAS guards on the exact state read`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`)

    // Simulate the race: an engineer's devClaimTask lands AFTER the abandon's
    // read but BEFORE its CAS — freeze the read snapshot, then flip the store.
    const impl = h.record.get.getMockImplementation()!
    h.record.get.mockImplementationOnce(async (...args: any[]) => {
      const res = await (impl as any)(...args)
      const snapshot = JSON.parse(JSON.stringify(res))
      h.row(`dev_tasks`, `dt_1`)!.data.state = `claimed`
      h.row(`dev_tasks`, `dt_1`)!.data.assignee = EngOne.agentId
      return snapshot
    })

    const result = await runFn(
      DevAbandonFunctionDef,
      h,
      { taskId: `dt_1`, reason: `stale` },
      Cto
    )

    expect(result.output).toMatchObject({ ok: true, abandoned: false, conflict: true })
    // The engineer's live claim survives untouched.
    expect(h.row(`dev_tasks`, `dt_1`)!.data).toMatchObject({
      state: `claimed`,
      assignee: EngOne.agentId,
    })
  })

  it(`refuses a spoofed agentId arg and a missing caller`, async () => {
    const h = makeFakeDb()
    seedTask(h, `dt_1`)

    const spoof = await runFn(
      DevAbandonFunctionDef,
      h,
      { taskId: `dt_1`, reason: `r`, agentId: EngOne.agentId },
      Cto
    )
    expect(spoof.output).toEqual({
      ok: false,
      reason: `agentId mismatch: the platform-injected caller identity is authoritative`,
    })

    const noCaller = await runFn(DevAbandonFunctionDef, h, {
      taskId: `dt_1`,
      reason: `r`,
    })
    expect(noCaller.output).toEqual({ ok: false, reason: `no caller identity` })
    expect(h.row(`dev_tasks`, `dt_1`)!.data.state).toBe(`backlog`)
  })
})
