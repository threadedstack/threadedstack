import { describe, it, expect, beforeEach, vi } from 'vitest'
import { upsertRecord } from './upsertRecord'

const mockUpsertRecordLocal = vi.fn()
const mockRecordsUpsert = vi.fn()

vi.mock('@TAF/services', () => ({
  recordsApi: {
    upsert: (...args: any[]) => mockRecordsUpsert(...args),
  },
}))

vi.mock('@TAF/actions/records/local/upsertRecord', () => ({
  upsertRecord: (...args: any[]) => mockUpsertRecordLocal(...args),
}))

describe('upsertRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should upsert a record and update state', async () => {
    const record = { id: 'r1', data: { a: 1 } }
    mockRecordsUpsert.mockResolvedValueOnce({ data: record })

    const result = await upsertRecord({
      orgId: 'org-1',
      projectId: 'proj-1',
      collectionName: 'col-1',
      data: { id: 'r1', data: { a: 1 } },
    })

    expect(mockRecordsUpsert).toHaveBeenCalledWith('org-1', 'proj-1', 'col-1', {
      id: 'r1',
      data: { a: 1 },
    })
    expect(mockUpsertRecordLocal).toHaveBeenCalledWith('proj-1', 'col-1', record)
    expect(result.data).toBe(record)
  })

  it('should handle upsert errors without updating state', async () => {
    mockRecordsUpsert.mockResolvedValueOnce({ error: new Error('validation failed') })

    const result = await upsertRecord({
      orgId: 'org-1',
      projectId: 'proj-1',
      collectionName: 'col-1',
      data: { data: { a: 1 } },
    })

    expect(result.error).toBeDefined()
    expect(mockUpsertRecordLocal).not.toHaveBeenCalled()
  })
})
