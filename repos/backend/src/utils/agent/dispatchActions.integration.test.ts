import type { Schedule } from '@tdsk/domain'

import { ESandboxType, ActionsBlockFence } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── End-to-end proof of the generic effect surface (generalization ②) ──────────
//
// This test wires the WHOLE chain with real code — nothing in the dispatch path
// is mocked. An agent's stdout carrying a ```tdsk-actions``` block flows:
//
//   stdout → parseActionsBlock → dispatchActions → invokeAction
//          → FunctionExecutor.execute → the ① `records` capability
//          → a record persisted in a Collection → read back by a query.
//
// The ONLY mocks are the same three the ① records-capability test mocks
// (functionExecutor.test.ts): the V8 sandbox provider (`@tdsk/sandbox`), the
// TypeScript transpiler (`esbuild`), and the logger. There is no live DB — the ①
// test proved the records bridge against an in-memory `db.services.record`
// stand-in that runs in the standard `pnpm --filter @tdsk/backend test` unit
// suite, and this test reuses that exact harness so it runs there too with no
// external K8s/DB dependency.
//
// The mocked isolate does not blindly hardcode a payload: it reconstructs the
// Function's real `context` out of the wrapper code the executor feeds it and
// runs recordProposal's real body against it, so the `title: "Ship it"` argument
// genuinely originates in the stdout block and lands in the persisted record.

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

// Real dispatch path — parser, core, and executor are all unmocked.
import { dispatchActions } from './dispatchActions'

// ── Fixtures ───────────────────────────────────────────────────────────────

const ProjectId = `proj-e2e`

/**
 * The consumer-defined Function the effect surface invokes. Its body upserts the
 * incoming args into the `proposals` Collection via the ① `records` capability —
 * exactly how sub-project ⑤ would later re-express `persistTaskProposals`.
 */
const RecordProposalFn = {
  id: `fn_recordProposal`,
  name: `recordProposal`,
  language: `typescript`,
  projectId: ProjectId,
  content: `export default async (req, context) => {
  await context.records.upsert('proposals', { data: context.args })
  return { ok: true }
}`,
}

/**
 * In-memory stand-in for the db, mirroring the ① records-capability harness
 * (functionExecutor.test.ts): a real upsert/query keyed by (projectId,
 * collection) so a round trip actually persists, plus a `function.list` that
 * resolves a project-scoped Function by name (what `invokeAction` calls).
 */
const makeFakeDb = (funcs: (typeof RecordProposalFn)[] = [RecordProposalFn]) => {
  const store = new Map<string, Map<string, { id: string; data: any }>>()
  const key = (p: string, c: string) => `${p}::${c}`

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
        const rec = { id, data: input.data }
        store.get(k)!.set(id, rec)
        return { data: { id } }
      }
    ),
    query: vi.fn(
      async (
        projectId: string,
        collection: string,
        query: { where?: Array<{ field: string; value: unknown }> } = {}
      ) => {
        let rows = Array.from(store.get(key(projectId, collection))?.values() ?? [])
        for (const f of query.where ?? [])
          rows = rows.filter((r) => r.data?.[f.field] === f.value)
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
  }

  const fn = {
    list: vi.fn(async ({ where }: { where: { projectId: string; name: string } }) => ({
      data: funcs.filter((f) => f.projectId === where.projectId && f.name === where.name),
    })),
  }

  return { db: { services: { record, function: fn } } as any, record, fn, store }
}

const fence = (json: string) => `\`\`\`${ActionsBlockFence}\n${json}\n\`\`\``

const buildApp = (db: unknown) => ({ locals: { db } }) as any

const buildSchedule = (actions?: unknown): Schedule =>
  ({ id: `sch-e2e`, projectId: ProjectId, actions }) as any

/**
 * Reconstruct the Function's `context` object from the wrapper code the executor
 * hands the isolate. `buildWrapperCode` embeds it as
 * `const context = JSON.parse("<escaped-json>");`, so we reverse the double
 * JSON.stringify: parse the string literal back to the inner JSON string, then
 * parse that to the object. This lets the mocked isolate run recordProposal's
 * real body against the REAL args that flowed from the tdsk-actions block.
 */
const contextFromWrapper = (wrapper: string): { args: Record<string, unknown> } => {
  const match = wrapper.match(/const context = JSON\.parse\(("(?:\\.|[^"\\])*")\)/)
  if (!match) throw new Error(`could not extract context from wrapper code`)
  return JSON.parse(JSON.parse(match[1]))
}

/** Mocked isolate that runs recordProposal's real body against the real context. */
const runRecordProposalBody = () =>
  mockEvaluate.mockImplementation(async (code: string, opts: any) => {
    const context = contextFromWrapper(code)
    await opts.bridges[`records.upsert`](
      JSON.stringify([`proposals`, { data: context.args }])
    )
    return { output: ``, result: { success: true, output: { ok: true } } }
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue(mockSandbox)
  mockClose.mockResolvedValue(undefined)
  mockReset.mockResolvedValue(undefined)
  mockEvaluate.mockResolvedValue({ output: ``, result: { success: true, output: null } })
})

describe(`dispatchActions — end-to-end effect surface (②)`, () => {
  it(`drives a consumer Function from a tdsk-actions block that persists into a Collection, read back by a query`, async () => {
    const { db, record, fn } = makeFakeDb()
    const app = buildApp(db)
    const schedule = buildSchedule({ functions: [`recordProposal`] })
    runRecordProposalBody()

    const stdout = `The agent decided to record a proposal.\n\n${fence(
      `[{ "function": "recordProposal", "args": { "title": "Ship it" } }]`
    )}\n\nAll done.`

    await dispatchActions(app, schedule, `ag_test`, stdout)

    // Resolved by name against the schedule's project + the opt-in allowlist.
    expect(fn.list).toHaveBeenCalledWith({
      where: { projectId: ProjectId, name: `recordProposal` },
    })

    // The ① records bridge persisted under the Function's own project.
    expect(record.upsert).toHaveBeenCalledTimes(1)
    expect(record.upsert).toHaveBeenCalledWith(ProjectId, `proposals`, {
      data: { title: `Ship it` },
    })

    // Read the record back by an unfiltered query — the record the block drove in.
    const { data: rows } = await db.services.record.query(ProjectId, `proposals`, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].data.title).toBe(`Ship it`)

    // …and a filtered query round-trips the same record, proving the arg from the
    // stdout block reached the persisted Collection end-to-end.
    const { data: filtered } = await db.services.record.query(ProjectId, `proposals`, {
      where: [{ field: `title`, value: `Ship it` }],
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].data.title).toBe(`Ship it`)
  })

  it(`persists nothing when the action names a Function outside the schedule allowlist`, async () => {
    const { db, record, fn } = makeFakeDb()
    const app = buildApp(db)
    // The Function exists and is resolvable, but the schedule allowlist omits it.
    const schedule = buildSchedule({ functions: [`someOtherFn`] })
    runRecordProposalBody()

    await dispatchActions(
      app,
      schedule,
      `ag_test`,
      fence(`[{ "function": "recordProposal", "args": { "title": "Ship it" } }]`)
    )

    // The allowlist gate rejects before any resolution or execution.
    expect(fn.list).not.toHaveBeenCalled()
    expect(record.upsert).not.toHaveBeenCalled()
    expect(mockEvaluate).not.toHaveBeenCalled()

    // Nothing landed in the Collection.
    const { data: rows } = await db.services.record.query(ProjectId, `proposals`, {})
    expect(rows).toHaveLength(0)
  })
})
