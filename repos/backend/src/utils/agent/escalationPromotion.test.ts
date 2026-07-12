import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EEscalationStatus, EEscalationTarget } from '@tdsk/domain'
import { openEscalation, resolveEscalation } from './escalationPromotion'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const makeDb = () => {
  const escalationClaimOpen = vi
    .fn()
    .mockResolvedValue({ data: { id: `es_1`, status: EEscalationStatus.routed } })
  const escalationGet = vi.fn()
  const escalationUpdate = vi.fn().mockResolvedValue({ data: {} })
  const openByDedupeKey = vi.fn().mockResolvedValue({ data: null })
  return {
    db: {
      services: {
        escalation: {
          claimOpen: escalationClaimOpen,
          get: escalationGet,
          update: escalationUpdate,
          openByDedupeKey,
        },
      },
    } as any,
    escalationClaimOpen,
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
    m.escalationClaimOpen.mockResolvedValue({
      data: { id: `es_1`, status: EEscalationStatus.routed },
    })
    const res = await openEscalation(m.db, `og_1`, `ag_1`, {
      ...baseInput,
      target: EEscalationTarget.app,
    })
    expect(res.deduped).toBe(false)
    expect(res.status).toBe(EEscalationStatus.routed)
    expect(res.routable).toBe(true)
    const insert = m.escalationClaimOpen.mock.calls[0][0]
    expect(insert.status).toBe(EEscalationStatus.routed)
    expect(insert.orgId).toBe(`og_1`)
    expect(insert.agentId).toBe(`ag_1`)
    expect(insert.target).toBe(EEscalationTarget.app)
  })

  it(`keeps secrets at status open with routable false — hard line, never routed`, async () => {
    m.escalationClaimOpen.mockResolvedValue({
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
    const insert = m.escalationClaimOpen.mock.calls[0][0]
    expect(insert.status).toBe(EEscalationStatus.open)
    expect(insert.target).toBe(EEscalationTarget.secrets)
  })

  it(`keeps ops at status open with routable false (pre-P4d)`, async () => {
    m.escalationClaimOpen.mockResolvedValue({
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
    const insert = m.escalationClaimOpen.mock.calls[0][0]
    expect(insert.status).toBe(EEscalationStatus.open)
    expect(insert.target).toBe(EEscalationTarget.ops)
  })

  it(`dedupes when claimOpen loses the race — the existing open row is returned`, async () => {
    m.escalationClaimOpen.mockResolvedValue({ data: null, conflict: true })
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
    expect(m.escalationClaimOpen).toHaveBeenCalled()
    expect(m.openByDedupeKey).toHaveBeenCalledWith(`og_1`, baseInput.dedupeKey)
  })

  it(`throws when claimOpen loses the race but no open row can be found (extremely rare)`, async () => {
    m.escalationClaimOpen.mockResolvedValue({ data: null, conflict: true })
    m.openByDedupeKey.mockResolvedValue({ data: null })
    await expect(
      openEscalation(m.db, `og_1`, `ag_1`, {
        ...baseInput,
        target: EEscalationTarget.app,
      })
    ).rejects.toThrow(`lost the dedupeKey race but no open row was found`)
  })

  it(`derives dedupeKey from target and title when not provided`, async () => {
    m.escalationClaimOpen.mockResolvedValue({
      data: { id: `es_4`, status: EEscalationStatus.routed },
    })
    const inputWithoutKey = {
      title: `Cache miss spike`,
      problem: `Cache miss rate is too high`,
      target: EEscalationTarget.app,
    }
    await openEscalation(m.db, `og_1`, `ag_1`, inputWithoutKey as any)
    const expectedKey = `${EEscalationTarget.app}:Cache miss spike`
    const insert = m.escalationClaimOpen.mock.calls[0][0]
    expect(insert.dedupeKey).toBe(expectedKey)
  })

  it(`throws when the DB create fails`, async () => {
    m.escalationClaimOpen.mockResolvedValue({ error: { message: `DB write failed` } })
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
