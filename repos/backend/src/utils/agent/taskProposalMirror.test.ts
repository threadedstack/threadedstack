import type { TDBTaskProposalSelect } from '@TDB/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

import { syncTaskProposalRecord } from '@TDB/seeds/dev-loop/syncTaskProposals'

import { mirrorTaskProposalToCollection, OpsProjectId } from './taskProposalMirror'
import { logger } from '@TBE/utils/logger'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TDB/seeds/dev-loop/syncTaskProposals`, () => ({
  syncTaskProposalRecord: vi.fn(),
}))

const mockedSync = vi.mocked(syncTaskProposalRecord)

const row = (over: Partial<TDBTaskProposalSelect> = {}): TDBTaskProposalSelect =>
  ({
    id: `tp_AbCdEfG`,
    title: `Fix the flaky sandbox test`,
    ...over,
  }) as TDBTaskProposalSelect

const db = { services: { record: {} } } as any

describe(`mirrorTaskProposalToCollection`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`does not warn or throw when the sync resolves with a non-error action`, async () => {
    mockedSync.mockResolvedValue({ id: `tp_AbCdEfG`, action: `created` })

    await expect(mirrorTaskProposalToCollection(db, row())).resolves.toBeUndefined()

    expect(mockedSync).toHaveBeenCalledWith(
      db.services.record,
      expect.any(Object),
      OpsProjectId
    )
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it(`warns but does not throw when the sync resolves with an error action`, async () => {
    mockedSync.mockResolvedValue({
      id: `tp_AbCdEfG`,
      action: `error`,
      message: `upsert failed: boom`,
    })

    await expect(mirrorTaskProposalToCollection(db, row())).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [warnMsg] = (logger.warn as any).mock.calls[0]
    expect(warnMsg).toContain(`tp_AbCdEfG`)
    expect(warnMsg).toContain(`upsert failed: boom`)
  })

  it(`catches a thrown/rejected sync and never throws or rejects itself`, async () => {
    mockedSync.mockRejectedValue(new Error(`connection reset`))

    await expect(mirrorTaskProposalToCollection(db, row())).resolves.toBeUndefined()

    expect(logger.warn).toHaveBeenCalledTimes(1)
    const [warnMsg] = (logger.warn as any).mock.calls[0]
    expect(warnMsg).toContain(`tp_AbCdEfG`)
    expect(warnMsg).toContain(`connection reset`)
  })
})
