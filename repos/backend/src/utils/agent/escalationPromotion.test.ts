import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EEscalationStatus, EEscalationTarget } from '@tdsk/domain'
import { openEscalation, resolveEscalation } from './escalationPromotion'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const makeDb = () => {
  const escalationCreateIfAbsent = vi
    .fn()
    .mockResolvedValue({ data: { id: `es_1`, status: EEscalationStatus.routed } })
  const escalationGet = vi.fn()
  const escalationUpdate = vi.fn().mockResolvedValue({ data: {} })
  const openByDedupeKey = vi.fn().mockResolvedValue({ data: null })
  return {
    db: {
      services: {
        escalation: {
          createIfAbsent: escalationCreateIfAbsent,
          get: escalationGet,
          update: escalationUpdate,
          openByDedupeKey,
        },
      },
    } as any,
    escalationCreateIfAbsent,
    escalationGet,
    escalationUpdate,
    openByDedupeKey,
  }
}

const baseInput = {
  title: `Rate limit exceeded`,
  problem: `The API rate limit is exceeded and requests are being rejected`,
  evidence: [`error log line 42`, `monitoring alert`],
  dedupeKey: `app:rate-limit-exceeded`,
}

describe(`openEscalation`, () => {
  let m: ReturnType<typeof makeDb>
  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
  })

  it(`routes app target with status routed and routable true`, async () => {
    m.escalationCreateIfAbsent.mockResolvedValue({
      data: { id: `es_1`, status: EEscalationStatus.routed },
    })
    const res = await openEscalation(m.db, `og_1`, `ag_1`, {
      ...baseInput,
      target: EEscalationTarget.app,
    })
    expect(res.deduped).toBe(false)
    expect(res.status).toBe(EEscalationStatus.routed)
    expect(res.routable).toBe(true)
    const insert = m.escalationCreateIfAbsent.mock.calls[0][0]
    expect(insert.status).toBe(EEscalationStatus.routed)
    expect(insert.orgId).toBe(`og_1`)
    expect(insert.agentId).toBe(`ag_1`)
    expect(insert.target).toBe(EEscalationTarget.app)
  })

  it(`keeps secrets at status open with routable false — hard line, never routed`, async () => {
    m.escalationCreateIfAbsent.mockResolvedValue({
      data: { id: `es_2`, status: EEscalationStatus.open },
    })
    const res = await openEscalation(m.db, `og_1`, `ag_1`, {
      ...baseInput,
      title: `Rotate API key`,
      problem: `Need to rotate a production API key`,
      target: EEscalationTarget.secrets,
      dedupeKey: `secrets:rotate-api-key`,
    })
    expect(res.deduped).toBe(false)
    expect(res.status).toBe(EEscalationStatus.open)
    expect(res.routable).toBe(false)
    const insert = m.escalationCreateIfAbsent.mock.calls[0][0]
    expect(insert.status).toBe(EEscalationStatus.open)
    expect(insert.target).toBe(EEscalationTarget.secrets)
  })

  it(`keeps ops at status open with routable false (pre-P4d)`, async () => {
    m.escalationCreateIfAbsent.mockResolvedValue({
      data: { id: `es_3`, status: EEscalationStatus.open },
    })
    const res = await openEscalation(m.db, `og_1`, `ag_1`, {
      ...baseInput,
      title: `Pod OOM restart`,
      problem: `Backend pod is restarting due to OOM`,
      target: EEscalationTarget.ops,
      dedupeKey: `ops:pod-oom-restart`,
    })
    expect(res.deduped).toBe(false)
    expect(res.status).toBe(EEscalationStatus.open)
    expect(res.routable).toBe(false)
    const insert = m.escalationCreateIfAbsent.mock.calls[0][0]
    expect(insert.status).toBe(EEscalationStatus.open)
    expect(insert.target).toBe(EEscalationTarget.ops)
  })

  it(`dedupes when createIfAbsent reports a conflict (an open row already exists)`, async () => {
    m.escalationCreateIfAbsent.mockResolvedValue({ data: null, conflict: true })
    m.openByDedupeKey.mockResolvedValue({
      data: { id: `es_x`, status: EEscalationStatus.open, orgId: `og_1` },
    })
    const res = await openEscalation(m.db, `og_1`, `ag_1`, {
      ...baseInput,
      target: EEscalationTarget.app,
    })
    expect(res.deduped).toBe(true)
    expect(res.id).toBe(`es_x`)
    expect(res.status).toBe(EEscalationStatus.open)
    expect(res.routable).toBe(false)
    expect(m.openByDedupeKey).toHaveBeenCalledWith(`og_1`, baseInput.dedupeKey)
  })

  it(`simulates two concurrent callers racing the same dedupeKey — exactly one creates`, async () => {
    // Replica A's createIfAbsent wins the partial-unique-index race outright.
    m.escalationCreateIfAbsent.mockResolvedValueOnce({
      data: { id: `es_winner1`, status: EEscalationStatus.routed },
    })
    const winner = await openEscalation(m.db, `og_1`, `ag_1`, {
      ...baseInput,
      target: EEscalationTarget.app,
    })
    expect(winner.deduped).toBe(false)
    expect(winner.id).toBe(`es_winner1`)

    // Replica B's createIfAbsent hits the partial unique index on
    // escalations(org_id, dedupe_key) WHERE status IN ('open','routed') —
    // ON CONFLICT DO NOTHING means zero rows come back (conflict: true), never
    // a thrown error, and the caller re-fetches the winner's row.
    m.escalationCreateIfAbsent.mockResolvedValueOnce({ data: null, conflict: true })
    m.openByDedupeKey.mockResolvedValue({
      data: { id: `es_winner1`, status: EEscalationStatus.routed, orgId: `og_1` },
    })
    const loser = await openEscalation(m.db, `og_1`, `ag_1`, {
      ...baseInput,
      target: EEscalationTarget.app,
    })
    expect(loser.deduped).toBe(true)
    expect(loser.id).toBe(`es_winner1`)

    // Only one escalation row was ever created for the dedupeKey.
    expect(m.escalationCreateIfAbsent).toHaveBeenCalledTimes(2)
  })

  it(`throws when createIfAbsent reports a conflict but the row can't be re-fetched`, async () => {
    m.escalationCreateIfAbsent.mockResolvedValue({ data: null, conflict: true })
    m.openByDedupeKey.mockResolvedValue({ data: null })
    await expect(
      openEscalation(m.db, `og_1`, `ag_1`, {
        ...baseInput,
        target: EEscalationTarget.app,
      })
    ).rejects.toThrow(`conflicting row not found`)
  })

  it(`derives dedupeKey from target and title when not provided`, async () => {
    m.escalationCreateIfAbsent.mockResolvedValue({
      data: { id: `es_4`, status: EEscalationStatus.routed },
    })
    const inputWithoutKey = {
      title: `Cache miss spike`,
      problem: `Cache miss rate is too high`,
      target: EEscalationTarget.app,
    }
    await openEscalation(m.db, `og_1`, `ag_1`, inputWithoutKey as any)
    const expectedKey = `${EEscalationTarget.app}:Cache miss spike`
    const insert = m.escalationCreateIfAbsent.mock.calls[0][0]
    expect(insert.dedupeKey).toBe(expectedKey)
  })

  it(`throws when the DB create fails`, async () => {
    m.escalationCreateIfAbsent.mockResolvedValue({
      error: { message: `DB write failed` },
    })
    await expect(
      openEscalation(m.db, `og_1`, `ag_1`, {
        ...baseInput,
        target: EEscalationTarget.app,
      })
    ).rejects.toThrow(`DB write failed`)
  })
})

describe(`resolveEscalation`, () => {
  let m: ReturnType<typeof makeDb>
  beforeEach(() => {
    vi.clearAllMocks()
    m = makeDb()
  })

  const openRow = (overrides = {}) => ({
    id: `es_1`,
    orgId: `og_1`,
    agentId: `ag_1`,
    status: EEscalationStatus.open,
    resolvedRef: null,
    reason: null,
    ...overrides,
  })

  it(`resolves an open escalation by id and returns 'resolved'`, async () => {
    m.escalationGet.mockResolvedValue({ data: openRow() })
    const result = await resolveEscalation(m.db, `og_1`, {
      id: `es_1`,
      status: `resolved`,
      resolvedRef: `https://github.com/org/repo/pull/99`,
    })
    expect(result).toBe(`resolved`)
    const upd = m.escalationUpdate.mock.calls.at(-1)![0]
    expect(upd.id).toBe(`es_1`)
    expect(upd.status).toBe(`resolved`)
    expect(upd.resolvedRef).toBe(`https://github.com/org/repo/pull/99`)
  })

  it(`resolves by dedupeKey when id is absent`, async () => {
    m.openByDedupeKey.mockResolvedValue({ data: openRow({ id: `es_key_1` }) })
    const result = await resolveEscalation(m.db, `og_1`, {
      dedupeKey: `app:rate-limit-exceeded`,
      status: `resolved`,
      resolvedRef: `https://pr/1`,
    })
    expect(result).toBe(`resolved`)
    const upd = m.escalationUpdate.mock.calls.at(-1)![0]
    expect(upd.id).toBe(`es_key_1`)
  })

  it(`is a no-op for a terminal resolved row — returns null, no update`, async () => {
    m.escalationGet.mockResolvedValue({
      data: openRow({ status: EEscalationStatus.resolved }),
    })
    const result = await resolveEscalation(m.db, `og_1`, {
      id: `es_1`,
      status: `resolved`,
    })
    expect(result).toBeNull()
    expect(m.escalationUpdate).not.toHaveBeenCalled()
  })

  it(`is a no-op for a terminal rejected row — returns null, no update`, async () => {
    m.escalationGet.mockResolvedValue({
      data: openRow({ status: EEscalationStatus.rejected }),
    })
    const result = await resolveEscalation(m.db, `og_1`, {
      id: `es_1`,
      status: `rejected`,
    })
    expect(result).toBeNull()
    expect(m.escalationUpdate).not.toHaveBeenCalled()
  })

  it(`is a no-op for cross-org escalation — returns null, no update`, async () => {
    m.escalationGet.mockResolvedValue({ data: openRow({ orgId: `other_org` }) })
    const result = await resolveEscalation(m.db, `og_1`, {
      id: `es_1`,
      status: `resolved`,
    })
    expect(result).toBeNull()
    expect(m.escalationUpdate).not.toHaveBeenCalled()
  })
})
