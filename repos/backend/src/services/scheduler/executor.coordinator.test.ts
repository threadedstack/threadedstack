import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TasksBlockFence } from '@tdsk/domain'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// executor.ts imports AgentRunner + resolveAgentConfig at module load; stub them
// so importing the helper functions never pulls in the heavy agent runtime.
vi.mock(`@tdsk/agent`, () => ({ AgentRunner: { run: vi.fn() } }))
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: vi.fn(),
}))

// Spy on authorTaskProposal so persistTaskProposals tests can assert call args
// without touching the DB (mirrors executor.task.test.ts pattern).
const authorTaskProposalMock = vi.fn()
vi.mock(`@TBE/utils/agent/taskPromotion`, () => ({
  authorTaskProposal: (...args: unknown[]) => authorTaskProposalMock(...args),
  markTaskPromoted: vi.fn(),
}))

import { buildCoordinatorContext, persistTaskProposals } from './executor'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildApp = (services: Record<string, any>) =>
  ({ locals: { db: { services } } }) as any

const schedule = (overrides: Record<string, unknown> = {}) =>
  ({ id: `sd_1`, orgId: `org-1`, prompt: `hello`, ...overrides }) as any

const fenced = (fence: string, payload: unknown) =>
  `preamble text\n\n\`\`\`${fence}\n${JSON.stringify(payload)}\n\`\`\`\ntrailer`

/** Build a schedule whose prompt contains the coordinator-initiative marker. */
const coordSchedule = (initiative: string, overrides: Record<string, unknown> = {}) =>
  schedule({
    prompt: `You are the coordinator. <!-- coordinator-initiative: ${initiative} --> Decompose and delegate.`,
    ...overrides,
  })

/** Build a minimal task-proposal row stub. */
const makeProposal = (overrides: Record<string, unknown> = {}) => ({
  id: `tp_par1`,
  title: `P4d ops tier root`,
  priority: `P1`,
  status: `scanned`,
  prUrl: null,
  parentId: null,
  initiative: `P4d ops tier`,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// buildCoordinatorContext
// ---------------------------------------------------------------------------

describe(`buildCoordinatorContext`, () => {
  it(`returns '' when the schedule prompt lacks the coordinator-initiative marker`, async () => {
    const listByInitiative = vi.fn()
    const out = await buildCoordinatorContext(
      buildApp({ taskProposal: { listByInitiative } }),
      schedule({ prompt: `no marker here` })
    )
    expect(out).toBe(``)
    expect(listByInitiative).not.toHaveBeenCalled()
  })

  it(`returns '' when the schedule has no prompt`, async () => {
    const listByInitiative = vi.fn()
    const out = await buildCoordinatorContext(
      buildApp({ taskProposal: { listByInitiative } }),
      schedule({ prompt: undefined })
    )
    expect(out).toBe(``)
    expect(listByInitiative).not.toHaveBeenCalled()
  })

  it(`renders the initiative heading and lists parent + children when marker is present`, async () => {
    const parent = makeProposal({
      id: `tp_par1`,
      title: `P4d ops tier root`,
      priority: `P1`,
      status: `scanned`,
      prUrl: null,
      parentId: null,
      initiative: `P4d ops tier`,
    })
    const child1 = makeProposal({
      id: `tp_chi1`,
      title: `Monitor egress failures`,
      priority: `P1`,
      status: `pending`,
      prUrl: null,
      parentId: `tp_par1`,
      initiative: `P4d ops tier`,
    })
    const child2 = makeProposal({
      id: `tp_chi2`,
      title: `Alert on repeated 5xx`,
      priority: `P2`,
      status: `promoted`,
      prUrl: `https://github.com/org/repo/pull/42`,
      parentId: `tp_par1`,
      initiative: `P4d ops tier`,
    })

    const listByInitiative = vi.fn().mockResolvedValue({ data: [parent, child1, child2] })

    const out = await buildCoordinatorContext(
      buildApp({ taskProposal: { listByInitiative } }),
      coordSchedule(`P4d ops tier`)
    )

    expect(listByInitiative).toHaveBeenCalledWith(`org-1`, `P4d ops tier`)

    // Heading
    expect(out).toContain(`## Initiative: P4d ops tier`)

    // Parent is listed under "Parents:"
    expect(out).toContain(`tp_par1`)
    expect(out).toContain(`P4d ops tier root`)

    // Children appear under their parent group
    expect(out).toContain(`tp_chi1`)
    expect(out).toContain(`Monitor egress failures`)
    expect(out).toContain(`tp_chi2`)
    expect(out).toContain(`Alert on repeated 5xx`)

    // Child with prUrl shows the URL
    expect(out).toContain(`https://github.com/org/repo/pull/42`)

    // Child without prUrl shows "none"
    expect(out).toContain(`none`)

    // Contains the coordinator instructions
    expect(out).toContain(`tdsk-tasks`)
    expect(out).toContain(`delegateTask`)
  })

  it(`returns '' when listByInitiative returns empty data`, async () => {
    const listByInitiative = vi.fn().mockResolvedValue({ data: [] })
    const out = await buildCoordinatorContext(
      buildApp({ taskProposal: { listByInitiative } }),
      coordSchedule(`P4d ops tier`)
    )
    expect(out).toBe(``)
  })

  it(`returns '' and never throws when the service rejects`, async () => {
    const listByInitiative = vi.fn().mockRejectedValue(new Error(`db down`))
    const out = await buildCoordinatorContext(
      buildApp({ taskProposal: { listByInitiative } }),
      coordSchedule(`P4d ops tier`)
    )
    expect(out).toBe(``)
  })

  it(`handles an orphaned child (parentId not null but no matching parent row) by listing it under Orphans`, async () => {
    const orphan = makeProposal({
      id: `tp_orp1`,
      title: `Orphaned child`,
      priority: `P2`,
      status: `pending`,
      prUrl: null,
      parentId: `tp_foreign_par`,
      initiative: `P4d ops tier`,
    })

    const listByInitiative = vi.fn().mockResolvedValue({ data: [orphan] })

    const out = await buildCoordinatorContext(
      buildApp({ taskProposal: { listByInitiative } }),
      coordSchedule(`P4d ops tier`)
    )

    expect(out).toContain(`Orphans`)
    expect(out).toContain(`tp_orp1`)
    expect(out).toContain(`tp_foreign_par`)
  })

  it(`parses initiative name with whitespace trim from the marker`, async () => {
    const listByInitiative = vi.fn().mockResolvedValue({ data: [] })
    // marker with extra spaces around the name
    const sc = schedule({
      prompt: `desc <!-- coordinator-initiative:   spaced name   --> end`,
    })
    await buildCoordinatorContext(buildApp({ taskProposal: { listByInitiative } }), sc)
    expect(listByInitiative).toHaveBeenCalledWith(`org-1`, `spaced name`)
  })
})

// ---------------------------------------------------------------------------
// persistTaskProposals — parentId + initiative forwarding
// ---------------------------------------------------------------------------

describe(`persistTaskProposals — parentId and initiative forwarding`, () => {
  it(`forwards parentId and initiative from parsed tdsk-tasks entry to authorTaskProposal`, async () => {
    authorTaskProposalMock.mockResolvedValue({ id: `tp_chi1`, status: `scanned` })

    const stdout = fenced(TasksBlockFence, [
      {
        title: `Monitor egress failures`,
        description: `watch the proxy logs for repeated 5xx`,
        priority: `P1`,
        evidence: `egress logs show 3 consecutive failures`,
        sourceSignal: `log`,
        dedupeKey: `log:egress-failures`,
        initiative: `P4d ops tier`,
        parentId: `tp_par1`,
      },
    ])

    const app = buildApp({})
    await persistTaskProposals(
      app,
      schedule({ id: `sd_coord` }),
      `ag_coord`,
      `th_1`,
      stdout
    )

    expect(authorTaskProposalMock).toHaveBeenCalledTimes(1)
    const [db, orgId, agentId, entry, meta] = authorTaskProposalMock.mock.calls[0]
    expect(db).toBe(app.locals.db)
    expect(orgId).toBe(`org-1`)
    expect(agentId).toBe(`ag_coord`)
    expect(entry.parentId).toBe(`tp_par1`)
    expect(entry.initiative).toBe(`P4d ops tier`)
    expect(meta).toEqual({ threadId: `th_1`, scheduleId: `sd_coord` })
  })

  it(`works normally (no parentId/initiative) for plain sensor proposals`, async () => {
    authorTaskProposalMock.mockResolvedValue({ id: `tp_plain`, status: `scanned` })

    const stdout = fenced(TasksBlockFence, [
      {
        title: `Flaky test`,
        description: `it flakes`,
        priority: `P1`,
        evidence: `CI run 42`,
        sourceSignal: `ci`,
        dedupeKey: `ci:flaky-test`,
      },
    ])

    await persistTaskProposals(buildApp({}), schedule(), `ag_1`, `th_1`, stdout)

    expect(authorTaskProposalMock).toHaveBeenCalledTimes(1)
    const [, , , entry] = authorTaskProposalMock.mock.calls[0]
    // parentId and initiative should be absent / undefined (not set in input)
    expect(entry.parentId).toBeUndefined()
    expect(entry.initiative).toBeUndefined()
  })
})
