import type { TAnyObj } from '@tdsk/domain'
import type { TDBTaskProposalSelect } from '@TDB/types'
import type { TSyncRecordService } from '@TDB/seeds/dev-loop/syncTaskProposals'

import { describe, it, expect, vi } from 'vitest'

import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import {
  taskProposalRecordId,
  taskProposalRecordData,
  syncTaskProposalRecord,
  syncTaskProposalRecords,
  TaskProposalsCollectionName,
} from '@TDB/seeds/dev-loop/syncTaskProposals'

/** A full table row fixture — every column the schema defines. */
const row = (over: Partial<TDBTaskProposalSelect> = {}): TDBTaskProposalSelect =>
  ({
    id: `tp_AbCdEfG`,
    title: `Fix the flaky sandbox test`,
    description: `The sandbox tunnel test flakes on slow CI runners.`,
    priority: `P1`,
    evidence: `ci run https://github.com/x/y/actions/runs/1 failed twice`,
    sourceSignal: `ci`,
    dedupeKey: `ci:sandbox-tunnel-flake`,
    repos: [`sandbox`],
    status: `scanned`,
    scanResult: { passed: true, findings: [] },
    auditVerdict: null,
    meta: { threadId: `th_1`, scheduleId: `sd_lSst6Tq` },
    prUrl: null,
    reason: null,
    initiative: null,
    parentId: null,
    orgId: `og_0000001`,
    agentId: `ag_lvUbjp_`,
    createdAt: new Date(`2026-07-01T00:00:00Z`),
    updatedAt: new Date(`2026-07-01T00:00:00Z`),
    ...over,
  }) as TDBTaskProposalSelect

/**
 * An in-memory record-service slice mirroring the real one's project +
 * collection scoping and its { data } / {} return shapes.
 */
const memoryService = () => {
  const store = new Map<string, TAnyObj>()
  const key = (projectId: string, collection: string, id: string) =>
    `${projectId}:${collection}:${id}`

  const get = vi.fn(async (projectId: string, collection: string, id: string) => {
    const data = store.get(key(projectId, collection, id))
    return data ? { data: { id, data } } : {}
  })
  const upsert = vi.fn(
    async (
      projectId: string,
      collection: string,
      input: { id?: string; data: TAnyObj }
    ) => {
      store.set(key(projectId, collection, input.id as string), input.data)
      return { data: { id: input.id, data: input.data } }
    }
  )

  return { service: { get, upsert } satisfies TSyncRecordService, store, get, upsert }
}

describe(`taskProposalRecordId`, () => {
  it(`derives the record id deterministically as the table id (pickupTask correlator)`, () => {
    // pickupTask locates a proposal ONLY via records.get(id) — during 4a the
    // work cycle sees tp_ ids from the legacy backlog, so identity is required.
    expect(taskProposalRecordId(row())).toBe(`tp_AbCdEfG`)
  })
})

describe(`taskProposalRecordData`, () => {
  it(`maps columns to the ⑤b-2 collection schema and keeps the table id as legacyId`, () => {
    const data = taskProposalRecordData(row())
    expect(data).toMatchObject({
      legacyId: `tp_AbCdEfG`,
      title: `Fix the flaky sandbox test`,
      description: `The sandbox tunnel test flakes on slow CI runners.`,
      evidence: `ci run https://github.com/x/y/actions/runs/1 failed twice`,
      dedupeKey: `ci:sandbox-tunnel-flake`,
      status: `scanned`,
      priority: `P1`,
      sourceSignal: `ci`,
      repos: [`sandbox`],
      scanResult: { passed: true, findings: [] },
      meta: { threadId: `th_1`, scheduleId: `sd_lSst6Tq` },
      // Table agentId -> collection proposedByAgentId (trusted-caller semantics).
      proposedByAgentId: `ag_lvUbjp_`,
    })
  })

  it(`drops orgId + base timestamps and omits null optional columns`, () => {
    const data = taskProposalRecordData(row())
    expect(data).not.toHaveProperty(`orgId`)
    expect(data).not.toHaveProperty(`createdAt`)
    expect(data).not.toHaveProperty(`updatedAt`)
    expect(data).not.toHaveProperty(`agentId`)
    // Null optional columns are omitted, not written as null.
    expect(data).not.toHaveProperty(`prUrl`)
    expect(data).not.toHaveProperty(`reason`)
    expect(data).not.toHaveProperty(`initiative`)
    expect(data).not.toHaveProperty(`parentId`)
    expect(data).not.toHaveProperty(`auditVerdict`)
  })
})

describe(`syncTaskProposalRecords`, () => {
  it(`creates every missing record, scoped to the ops project + collection`, async () => {
    const { service, get, upsert } = memoryService()
    const rows = [row(), row({ id: `tp_2222222`, dedupeKey: `ci:other` })]

    const summary = await syncTaskProposalRecords(service, rows, OpsProjectId)

    expect(summary).toMatchObject({ created: 2, updated: 0, unchanged: 0, errors: 0 })
    expect(get).toHaveBeenCalledWith(
      OpsProjectId,
      TaskProposalsCollectionName,
      `tp_AbCdEfG`
    )
    expect(upsert).toHaveBeenCalledWith(OpsProjectId, TaskProposalsCollectionName, {
      id: `tp_2222222`,
      data: expect.objectContaining({ legacyId: `tp_2222222` }),
    })
  })

  it(`is idempotent: a re-run over unchanged rows writes 0 records`, async () => {
    const { service, upsert } = memoryService()
    const rows = [row(), row({ id: `tp_2222222`, dedupeKey: `ci:other` })]

    const first = await syncTaskProposalRecords(service, rows, OpsProjectId)
    expect(first).toMatchObject({ created: 2, updated: 0, unchanged: 0, errors: 0 })
    expect(upsert).toHaveBeenCalledTimes(2)

    const second = await syncTaskProposalRecords(service, rows, OpsProjectId)
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 2, errors: 0 })
    // No new writes on the re-run — the drift compare short-circuits.
    expect(upsert).toHaveBeenCalledTimes(2)
  })

  it(`updates exactly the changed row on a re-run (e.g. a pickup promoted it)`, async () => {
    const { service, upsert } = memoryService()
    const unchanged = row({ id: `tp_2222222`, dedupeKey: `ci:other` })

    await syncTaskProposalRecords(service, [row(), unchanged], OpsProjectId)
    const promoted = row({
      status: `promoted`,
      prUrl: `https://github.com/x/y/pull/9`,
      reason: `Picked by work cycle`,
    })

    const summary = await syncTaskProposalRecords(
      service,
      [promoted, unchanged],
      OpsProjectId
    )
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 1, errors: 0 })
    expect(upsert).toHaveBeenLastCalledWith(OpsProjectId, TaskProposalsCollectionName, {
      id: `tp_AbCdEfG`,
      data: expect.objectContaining({
        status: `promoted`,
        prUrl: `https://github.com/x/y/pull/9`,
      }),
    })
  })

  it(`ignores jsonb key-order differences in the stored document (no false updates)`, async () => {
    const { service, store, upsert } = memoryService()
    await syncTaskProposalRecords(service, [row()], OpsProjectId)
    // Simulate a jsonb round trip reordering the stored document's keys.
    const stored = store.get(`${OpsProjectId}:${TaskProposalsCollectionName}:tp_AbCdEfG`)!
    const reordered = Object.fromEntries(Object.entries(stored).reverse())
    store.set(`${OpsProjectId}:${TaskProposalsCollectionName}:tp_AbCdEfG`, reordered)

    const summary = await syncTaskProposalRecords(service, [row()], OpsProjectId)
    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 1, errors: 0 })
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it(`records a get failure without throwing and keeps syncing the rest`, async () => {
    const { service } = memoryService()
    service.get = vi
      .fn()
      .mockResolvedValueOnce({ error: new Error(`db down`) })
      .mockResolvedValue({})

    const summary = await syncTaskProposalRecords(
      service,
      [row(), row({ id: `tp_2222222` })],
      OpsProjectId
    )
    expect(summary).toMatchObject({ created: 1, errors: 1 })
    expect(summary.results[0]).toMatchObject({ id: `tp_AbCdEfG`, action: `error` })
  })

  it(`records an upsert failure without throwing`, async () => {
    const { service } = memoryService()
    service.upsert = vi.fn().mockResolvedValue({ error: new Error(`nope`) })

    const summary = await syncTaskProposalRecords(service, [row()], OpsProjectId)
    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 0, errors: 1 })
  })
})

describe(`syncTaskProposalRecord (single row)`, () => {
  it(`creates a missing record, scoped to the given project + collection`, async () => {
    const { service, get, upsert } = memoryService()

    const result = await syncTaskProposalRecord(service, row(), OpsProjectId)

    expect(result).toEqual({ id: `tp_AbCdEfG`, action: `created` })
    expect(get).toHaveBeenCalledWith(
      OpsProjectId,
      TaskProposalsCollectionName,
      `tp_AbCdEfG`
    )
    expect(upsert).toHaveBeenCalledWith(OpsProjectId, TaskProposalsCollectionName, {
      id: `tp_AbCdEfG`,
      data: expect.objectContaining({ legacyId: `tp_AbCdEfG`, status: `scanned` }),
    })
  })

  it(`reports 'unchanged' on a re-run and writes nothing`, async () => {
    const { service, upsert } = memoryService()
    await syncTaskProposalRecord(service, row(), OpsProjectId)
    expect(upsert).toHaveBeenCalledTimes(1)

    const result = await syncTaskProposalRecord(service, row(), OpsProjectId)
    expect(result).toEqual({ id: `tp_AbCdEfG`, action: `unchanged` })
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it(`reports 'updated' when the row's mapped document drifts (e.g. a promote)`, async () => {
    const { service } = memoryService()
    await syncTaskProposalRecord(service, row(), OpsProjectId)

    const result = await syncTaskProposalRecord(
      service,
      row({ status: `promoted`, prUrl: `https://github.com/x/y/pull/9` }),
      OpsProjectId
    )
    expect(result).toEqual({ id: `tp_AbCdEfG`, action: `updated` })
  })

  it(`resolves an upsert failure to an 'error' result without throwing`, async () => {
    const { service } = memoryService()
    service.upsert = vi.fn().mockResolvedValue({ error: new Error(`nope`) })

    const result = await syncTaskProposalRecord(service, row(), OpsProjectId)
    expect(result).toMatchObject({ id: `tp_AbCdEfG`, action: `error` })
    expect(result.message).toContain(`nope`)
  })

  it(`resolves a thrown service error to an 'error' result without throwing`, async () => {
    const { service } = memoryService()
    service.get = vi.fn().mockRejectedValue(new Error(`db exploded`))

    const result = await syncTaskProposalRecord(service, row(), OpsProjectId)
    expect(result).toMatchObject({ id: `tp_AbCdEfG`, action: `error` })
    expect(result.message).toContain(`db exploded`)
  })
})
