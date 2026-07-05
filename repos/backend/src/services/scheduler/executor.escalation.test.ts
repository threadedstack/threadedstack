import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EEscalationStatus,
  EscalationInjectMax,
  EscalationInjectMaxChars,
  EscalationsBlockFence,
  EscalationResolutionsBlockFence,
} from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the helper functions never pulls in the heavy agent runtime.
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))

// Stub the escalation promotion helpers — tests assert on these mocks.
const openEscalationMock = vi.fn()
const resolveEscalationMock = vi.fn()
vi.mock(`@TBE/utils/agent/escalationPromotion`, () => ({
  openEscalation: (...args: unknown[]) => openEscalationMock(...args),
  resolveEscalation: (...args: unknown[]) => resolveEscalationMock(...args),
}))

// Stub task / skill promotion so executor can be imported cleanly.
vi.mock(`@TBE/utils/agent/taskPromotion`, () => ({
  authorTaskProposal: vi.fn(),
  markTaskPromoted: vi.fn(),
}))

import { buildEscalationContext, persistEscalations } from './executor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildApp = (services: Record<string, any>) =>
  ({ locals: { db: { services }, embeddings: null } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `org-1`, prompt: `hello`, ...overrides }) as any

const fenced = (fence: string, payload: unknown) =>
  `preamble\n\n\`\`\`${fence}\n${JSON.stringify(payload)}\n\`\`\`\ntrailer`

/** Build a minimal escalation model stub. */
const makeEs = (
  overrides: Partial<{
    id: string
    status: string
    target: string
    title: string
    problem: string
    proposedPatch: string | null
    issueRef: string | null
  }> = {}
) => ({
  id: `es_1`,
  status: EEscalationStatus.open,
  target: `app`,
  title: `Test escalation`,
  problem: `Something is broken in the system`,
  proposedPatch: null,
  issueRef: null,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// buildEscalationContext
// ---------------------------------------------------------------------------

describe(`buildEscalationContext`, () => {
  it(`returns '' when both open and routed are empty`, async () => {
    const listByStatus = vi.fn().mockResolvedValue({ data: [] })
    const out = await buildEscalationContext(
      buildApp({ escalation: { listByStatus } }),
      schedule()
    )
    expect(out).toBe(``)
    expect(listByStatus).toHaveBeenCalledTimes(2)
  })

  it(`renders routed first then open, newest-first within each group`, async () => {
    const routed = makeEs({
      id: `es_routed`,
      status: EEscalationStatus.routed,
      target: `app`,
      title: `Routed issue`,
      problem: `Routed problem`,
      proposedPatch: `fix code here\nmore lines`,
      issueRef: `https://github.com/org/repo/issues/1`,
    })
    const open = makeEs({
      id: `es_open`,
      status: EEscalationStatus.open,
      target: `secrets`,
      title: `Open issue`,
      problem: `Open problem`,
      proposedPatch: null,
      issueRef: null,
    })
    const listByStatus = vi.fn(async (_org: string, status: string) =>
      status === EEscalationStatus.routed ? { data: [routed] } : { data: [open] }
    )

    const out = await buildEscalationContext(
      buildApp({ escalation: { listByStatus } }),
      schedule()
    )

    expect(out).toContain(`## Open escalations (do NOT re-raise; act on routed ones)`)
    expect(out).toContain(`es_routed`)
    expect(out).toContain(`es_open`)
    // Routed should appear before open
    expect(out.indexOf(`es_routed`)).toBeLessThan(out.indexOf(`es_open`))
    // proposedPatch first line
    expect(out).toContain(`fix code here`)
    // issueRef
    expect(out).toContain(`https://github.com/org/repo/issues/1`)
    // no patch / no issue for open
    expect(out).toContain(`patch: none`)
    expect(out).toContain(`issue: none`)
    // Reminder to emit resolutions block
    expect(out).toContain(`tdsk-escalation-resolutions`)
  })

  it(`caps at EscalationInjectMax entries total`, async () => {
    const routedEntries = Array.from({ length: EscalationInjectMax }, (_, i) =>
      makeEs({ id: `es_r${i}`, status: EEscalationStatus.routed })
    )
    const openEntries = Array.from({ length: 5 }, (_, i) =>
      makeEs({ id: `es_o${i}`, status: EEscalationStatus.open })
    )
    const listByStatus = vi.fn(async (_org: string, status: string) =>
      status === EEscalationStatus.routed
        ? { data: routedEntries }
        : { data: openEntries }
    )

    const out = await buildEscalationContext(
      buildApp({ escalation: { listByStatus } }),
      schedule()
    )

    // Total bullet count: count occurrences of "- es_" prefix
    const bulletMatches = out.match(/^- es_/gm)
    expect(bulletMatches?.length ?? 0).toBeLessThanOrEqual(EscalationInjectMax)
    // Open entries beyond the cap should not appear
    expect(out).not.toContain(`es_o0`) // routed fills the cap
  })

  it(`truncates output at EscalationInjectMaxChars with marker`, async () => {
    // Make entries whose rendered output will exceed EscalationInjectMaxChars.
    // Each entry renders ~700 chars (600-char title + 200-char problem excerpt).
    // 15 entries × 700 chars = 10500 chars > 8000 cap.
    const longTitle = `A`.repeat(600)
    const manyOpen = Array.from({ length: EscalationInjectMax }, (_, i) =>
      makeEs({
        id: `es_big${i}`,
        status: EEscalationStatus.open,
        title: longTitle,
        problem: longTitle,
      })
    )
    const listByStatus = vi.fn(async (_org: string, status: string) =>
      status === EEscalationStatus.open ? { data: manyOpen } : { data: [] }
    )

    const out = await buildEscalationContext(
      buildApp({ escalation: { listByStatus } }),
      schedule()
    )

    expect(out).toContain(`... (truncated)`)
    // The output should be bounded; add a generous slack over EscalationInjectMaxChars
    // because the truncation marker itself is appended after the slice.
    expect(out.length).toBeLessThanOrEqual(EscalationInjectMaxChars + 30)
  })

  it(`returns '' and never throws when the service rejects`, async () => {
    const listByStatus = vi.fn().mockRejectedValue(new Error(`db down`))
    const out = await buildEscalationContext(
      buildApp({ escalation: { listByStatus } }),
      schedule()
    )
    expect(out).toBe(``)
  })
})

// ---------------------------------------------------------------------------
// persistEscalations
// ---------------------------------------------------------------------------

describe(`persistEscalations`, () => {
  it(`calls openEscalation once per parsed escalation entry with correct meta`, async () => {
    openEscalationMock.mockResolvedValue({
      id: `es_1`,
      status: `routed`,
      deduped: false,
      routable: true,
    })

    const payload = [
      {
        title: `Memory leak`,
        problem: `The service leaks memory under load`,
        target: `app`,
        evidence: [`OOM killed`],
        dedupeKey: `app:memory-leak`,
        proposedPatch: `reduce buffer size`,
      },
    ]
    const stdout = fenced(EscalationsBlockFence, payload)
    const app = buildApp({ memory: { create: vi.fn().mockResolvedValue({}) } })

    await persistEscalations(app, schedule({ id: `sd_9` }), `ag_1`, `th_1`, stdout)

    expect(openEscalationMock).toHaveBeenCalledTimes(1)
    const [db, orgId, agentId, input, meta] = openEscalationMock.mock.calls[0]
    expect(db).toBe(app.locals.db)
    expect(orgId).toBe(`org-1`)
    expect(agentId).toBe(`ag_1`)
    expect(input.title).toBe(`Memory leak`)
    expect(input.dedupeKey).toBe(`app:memory-leak`)
    expect(meta).toEqual({ threadId: `th_1`, scheduleId: `sd_9` })
  })

  it(`does not call openEscalation when stdout has no escalations block`, async () => {
    await persistEscalations(
      buildApp({}),
      schedule(),
      `ag_1`,
      `th_1`,
      `just a normal report with no blocks`
    )
    expect(openEscalationMock).not.toHaveBeenCalled()
  })

  it(`calls resolveEscalation and memory.create when resolution status is resolved`, async () => {
    resolveEscalationMock.mockResolvedValue(`resolved`)
    const memorCreateMock = vi.fn().mockResolvedValue({})
    const app = buildApp({ memory: { create: memorCreateMock } })

    const payload = [
      {
        id: `es_abc`,
        status: `resolved`,
        resolvedRef: `https://github.com/org/repo/pull/42`,
      },
    ]
    const stdout = fenced(EscalationResolutionsBlockFence, payload)

    await persistEscalations(app, schedule({ id: `sd_5` }), `ag_2`, `th_2`, stdout)

    expect(resolveEscalationMock).toHaveBeenCalledTimes(1)
    const [db, orgId, res, by] = resolveEscalationMock.mock.calls[0]
    expect(db).toBe(app.locals.db)
    expect(orgId).toBe(`org-1`)
    expect(res.id).toBe(`es_abc`)
    expect(by).toBe(`ag_2`)

    expect(memorCreateMock).toHaveBeenCalledTimes(1)
    const createArg = memorCreateMock.mock.calls[0][0]
    expect(createArg.text).toContain(`Escalation resolved:`)
    expect(createArg.text).toContain(`es_abc`)
    expect(createArg.importance).toBe(6)
    expect(createArg.orgId).toBe(`org-1`)
    expect(createArg.agentId).toBe(`ag_2`)
    expect(createArg.meta).toMatchObject({
      threadId: `th_2`,
      scheduleId: `sd_5`,
      source: `escalation`,
    })
  })

  it(`calls resolveEscalation but NOT memory.create when resolution status is rejected`, async () => {
    resolveEscalationMock.mockResolvedValue(`rejected`)
    const memorCreateMock = vi.fn()
    const app = buildApp({ memory: { create: memorCreateMock } })

    const payload = [{ id: `es_xyz`, status: `rejected`, reason: `not actionable` }]
    const stdout = fenced(EscalationResolutionsBlockFence, payload)

    await persistEscalations(app, schedule(), `ag_3`, `th_3`, stdout)

    expect(resolveEscalationMock).toHaveBeenCalledTimes(1)
    expect(memorCreateMock).not.toHaveBeenCalled()
  })

  it(`resolveEscalation returns null (escalation not found) → memory.create NOT called`, async () => {
    resolveEscalationMock.mockResolvedValue(null)
    const memorCreateMock = vi.fn()
    const app = buildApp({ memory: { create: memorCreateMock } })

    const payload = [{ id: `es_missing`, status: `resolved` }]
    const stdout = fenced(EscalationResolutionsBlockFence, payload)

    await persistEscalations(app, schedule(), `ag_4`, `th_4`, stdout)

    expect(resolveEscalationMock).toHaveBeenCalledTimes(1)
    expect(memorCreateMock).not.toHaveBeenCalled()
  })

  it(`swallows errors from openEscalation — function resolves without throwing`, async () => {
    openEscalationMock.mockRejectedValue(new Error(`db exploded`))
    const payload = [
      { title: `Crash`, problem: `It crashes`, target: `app`, dedupeKey: `app:crash` },
    ]
    const stdout = fenced(EscalationsBlockFence, payload)

    await expect(
      persistEscalations(buildApp({}), schedule(), `ag_5`, `th_5`, stdout)
    ).resolves.toBeUndefined()

    expect(openEscalationMock).toHaveBeenCalledTimes(1)
  })

  it(`swallows errors from resolveEscalation — function resolves without throwing`, async () => {
    resolveEscalationMock.mockRejectedValue(new Error(`resolve blew up`))
    const payload = [{ id: `es_z`, status: `resolved` }]
    const stdout = fenced(EscalationResolutionsBlockFence, payload)

    await expect(
      persistEscalations(buildApp({}), schedule(), `ag_6`, `th_6`, stdout)
    ).resolves.toBeUndefined()
  })
})
