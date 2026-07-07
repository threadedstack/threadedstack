import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TasksBlockFence, ETaskProposalStatus, TaskPickupsBlockFence } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the helper functions never pulls in the heavy agent runtime.
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))

// Spy on the promotion-pipeline helpers so the persist functions can be asserted
// without touching the DB (mirrors executor.test.ts mocking sibling utils).
const authorTaskProposalMock = vi.fn()
const markTaskPromotedMock = vi.fn()
vi.mock(`@TBE/utils/agent/taskPromotion`, () => ({
  authorTaskProposal: (...args: unknown[]) => authorTaskProposalMock(...args),
  markTaskPromoted: (...args: unknown[]) => markTaskPromotedMock(...args),
}))

import {
  promptOptsIn,
  buildRunOutcomeContext,
  buildOpenProposalsDigest,
  buildTaskBacklogContext,
  persistTaskProposals,
  persistTaskPickups,
} from './executor'
import { RehydrationInterruptMarker } from './rehydrator'

const buildApp = (services: Record<string, any>) =>
  ({ locals: { db: { services } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `org-1`, prompt: `hello`, ...overrides }) as any

const fenced = (fence: string, payload: unknown) =>
  `preamble text\n\n\`\`\`${fence}\n${JSON.stringify(payload)}\n\`\`\`\ntrailer`

beforeEach(() => {
  vi.clearAllMocks()
})

describe(`buildRunOutcomeContext`, () => {
  it(`flags error + short-success anomalies and omits the running row`, async () => {
    const listByOrg = vi.fn().mockResolvedValue({
      data: [
        { id: `sr_running`, status: `running`, startedAt: `2026-07-04T03:00:00Z` },
        {
          id: `sr_err`,
          status: `error`,
          error: `  boom failure  `,
          startedAt: `2026-07-04T02:00:00Z`,
        },
        {
          id: `sr_fast`,
          status: `success`,
          durationMs: 1200,
          startedAt: `2026-07-04T01:00:00Z`,
        },
      ],
    })
    const out = await buildRunOutcomeContext(
      buildApp({ scheduleRun: { listByOrg } }),
      schedule()
    )

    expect(listByOrg).toHaveBeenCalledWith(`org-1`, { limit: 50 })
    expect(out).toContain(`## Recent run outcomes`)
    expect(out).toContain(`sr_err`)
    expect(out).toContain(`boom failure`)
    // error text is trimmed
    expect(out).not.toContain(`  boom failure  `)
    // short success is flagged and carries its duration
    expect(out).toContain(`sr_fast`)
    expect(out).toContain(`possibly empty / no-op run`)
    expect(out).toContain(`1200ms`)
    // the currently-running row is never surfaced
    expect(out).not.toContain(`sr_running`)
  })

  it(`flags a long-running success interrupted by a backend restart (rehydrated)`, async () => {
    const listByOrg = vi.fn().mockResolvedValue({
      data: [
        // The 07:30-style null cycle: marked success by the rehydrator after a
        // deploy severed its exec stream. Duration is LONG (34 min), so the
        // duration-based fast-empty check must NOT be what catches it.
        {
          id: `sr_severed`,
          status: `success`,
          durationMs: 2_054_173,
          error: `${RehydrationInterruptMarker} — the runtime process had already exited by the time the new backend inspected the pod; ...`,
          startedAt: `2026-07-07T07:30:55Z`,
        },
        // A genuinely normal long success — must stay unflagged.
        {
          id: `sr_normal`,
          status: `success`,
          durationMs: 900_000,
          error: null,
          startedAt: `2026-07-07T06:30:00Z`,
        },
      ],
    })
    const out = await buildRunOutcomeContext(
      buildApp({ scheduleRun: { listByOrg } }),
      schedule()
    )

    expect(out).toContain(`## Recent run outcomes`)
    // the interrupted long-success is surfaced as a possibly-empty run
    expect(out).toContain(`sr_severed`)
    expect(out).toContain(`INTERRUPTED by a backend restart`)
    // its long duration must NOT be reported as a fast/empty duration
    expect(out).not.toContain(`2054173ms`)
    // the normal long success is never surfaced
    expect(out).not.toContain(`sr_normal`)
  })

  it(`returns '' when all runs are normal (success + long enough)`, async () => {
    const listByOrg = vi.fn().mockResolvedValue({
      data: [
        { id: `sr_ok`, status: `success`, durationMs: 999_999, startedAt: `x` },
        { id: `sr_ok2`, status: `success`, durationMs: null, startedAt: `y` },
      ],
    })
    const out = await buildRunOutcomeContext(
      buildApp({ scheduleRun: { listByOrg } }),
      schedule()
    )
    expect(out).toBe(``)
  })

  it(`returns '' and never throws when the service rejects`, async () => {
    const listByOrg = vi.fn().mockRejectedValue(new Error(`db down`))
    const out = await buildRunOutcomeContext(
      buildApp({ scheduleRun: { listByOrg } }),
      schedule()
    )
    expect(out).toBe(``)
  })
})

describe(`buildOpenProposalsDigest`, () => {
  it(`lists both pending and scanned dedupeKeys`, async () => {
    const listByStatus = vi.fn(async (_org: string, status: string) =>
      status === ETaskProposalStatus.pending
        ? {
            data: [
              { dedupeKey: `ci:aaa`, priority: `P1`, title: `Alpha`, status: `pending` },
            ],
          }
        : {
            data: [
              {
                dedupeKey: `health:bbb`,
                priority: `P0`,
                title: `Beta`,
                status: `scanned`,
              },
            ],
          }
    )
    const out = await buildOpenProposalsDigest(
      buildApp({ taskProposal: { listByStatus } }),
      schedule()
    )

    expect(out).toContain(`## Recently proposed backlog (do not duplicate)`)
    expect(out).toContain(`ci:aaa`)
    expect(out).toContain(`health:bbb`)
    expect(out).toContain(`(pending)`)
    expect(out).toContain(`(scanned)`)
  })

  it(`returns '' when there are no open proposals`, async () => {
    const listByStatus = vi.fn().mockResolvedValue({ data: [] })
    const out = await buildOpenProposalsDigest(
      buildApp({ taskProposal: { listByStatus } }),
      schedule()
    )
    expect(out).toBe(``)
  })
})

describe(`buildTaskBacklogContext`, () => {
  it(`lists the scanned backlog with tp_ ids in the order returned (P0 first)`, async () => {
    const listBacklog = vi.fn().mockResolvedValue({
      data: [
        {
          id: `tp_p0`,
          priority: `P0`,
          title: `Fix prod outage`,
          sourceSignal: `health`,
          evidence: `500s in prod`,
          description: `restart the pod`,
        },
        {
          id: `tp_p3`,
          priority: `P3`,
          title: `Tidy logs`,
          sourceSignal: `log`,
          evidence: `noisy warns`,
          description: `lower log level`,
        },
      ],
    })
    const out = await buildTaskBacklogContext(
      buildApp({ taskProposal: { listBacklog } }),
      schedule()
    )

    expect(listBacklog).toHaveBeenCalledWith(`org-1`, 12)
    expect(out).toContain(`## Proposed backlog (sensor-detected)`)
    expect(out).toContain(`tp_p0`)
    expect(out).toContain(`tp_p3`)
    // listBacklog already orders P0 first — assert the injected order preserves it
    expect(out.indexOf(`tp_p0`)).toBeLessThan(out.indexOf(`tp_p3`))
    expect(out).toContain(`signal: health`)
    expect(out).toContain(`evidence: 500s in prod`)
  })

  it(`returns '' when the backlog is empty`, async () => {
    const listBacklog = vi.fn().mockResolvedValue({ data: [] })
    const out = await buildTaskBacklogContext(
      buildApp({ taskProposal: { listBacklog } }),
      schedule()
    )
    expect(out).toBe(``)
  })
})

describe(`persistTaskProposals`, () => {
  it(`authors one proposal per parsed entry`, async () => {
    authorTaskProposalMock.mockResolvedValue({ id: `tp_1`, status: `scanned` })
    const stdout = fenced(TasksBlockFence, [
      {
        title: `Flaky test`,
        description: `it flakes`,
        priority: `P1`,
        evidence: `CI run 42`,
        sourceSignal: `ci`,
        dedupeKey: `ci:flaky-test`,
      },
      {
        title: `Slow query`,
        description: `n+1`,
        priority: `P2`,
        evidence: `logs`,
        sourceSignal: `log`,
        dedupeKey: `log:slow-query`,
      },
    ])
    const app = buildApp({})
    await persistTaskProposals(app, schedule({ id: `sd_9` }), `ag_1`, `th_1`, stdout)

    expect(authorTaskProposalMock).toHaveBeenCalledTimes(2)
    const [db, orgId, agentId, entry, meta] = authorTaskProposalMock.mock.calls[0]
    expect(db).toBe(app.locals.db)
    expect(orgId).toBe(`org-1`)
    expect(agentId).toBe(`ag_1`)
    expect(entry.dedupeKey).toBe(`ci:flaky-test`)
    expect(meta).toEqual({ threadId: `th_1`, scheduleId: `sd_9` })
  })

  it(`does nothing when stdout has no tasks block`, async () => {
    await persistTaskProposals(buildApp({}), schedule(), `ag_1`, `th_1`, `just a report`)
    expect(authorTaskProposalMock).not.toHaveBeenCalled()
  })

  it(`never throws when authoring a single entry fails`, async () => {
    authorTaskProposalMock.mockRejectedValueOnce(new Error(`scan blew up`))
    const stdout = fenced(TasksBlockFence, [
      {
        title: `t`,
        description: `d`,
        priority: `P0`,
        evidence: `e`,
        sourceSignal: `ci`,
        dedupeKey: `ci:t`,
      },
    ])
    await expect(
      persistTaskProposals(buildApp({}), schedule(), `ag_1`, `th_1`, stdout)
    ).resolves.toBeUndefined()
    expect(authorTaskProposalMock).toHaveBeenCalledTimes(1)
  })
})

describe(`persistTaskPickups`, () => {
  it(`promotes one proposal per parsed pickup`, async () => {
    markTaskPromotedMock.mockResolvedValue(`promoted`)
    const stdout = fenced(TaskPickupsBlockFence, [
      { proposalId: `tp_1`, prUrl: `https://github.com/x/y/pull/1` },
      { proposalId: `tp_2`, note: `picked up` },
    ])
    const app = buildApp({})
    await persistTaskPickups(app, schedule(), `ag_1`, stdout)

    expect(markTaskPromotedMock).toHaveBeenCalledTimes(2)
    const [db, orgId, pickup, by] = markTaskPromotedMock.mock.calls[0]
    expect(db).toBe(app.locals.db)
    expect(orgId).toBe(`org-1`)
    expect(pickup.proposalId).toBe(`tp_1`)
    expect(by).toBe(`ag_1`)
  })

  it(`does nothing when stdout has no pickup block`, async () => {
    await persistTaskPickups(buildApp({}), schedule(), `ag_1`, `report only`)
    expect(markTaskPromotedMock).not.toHaveBeenCalled()
  })
})

describe(`promptOptsIn`, () => {
  it(`is true only when the prompt embeds the fence label`, () => {
    expect(
      promptOptsIn(
        schedule({ prompt: `emit a ${TasksBlockFence} block` }),
        TasksBlockFence
      )
    ).toBe(true)
    expect(promptOptsIn(schedule({ prompt: `no marker here` }), TasksBlockFence)).toBe(
      false
    )
    expect(promptOptsIn(schedule({ prompt: undefined }), TasksBlockFence)).toBe(false)
    expect(
      promptOptsIn(
        schedule({ prompt: `pick from ${TaskPickupsBlockFence}` }),
        TaskPickupsBlockFence
      )
    ).toBe(true)
  })
})
