import { describe, it, expect, beforeEach, vi } from 'vitest'
import { queryRecords } from './queryRecords'

const mockSetRecords = vi.fn()
const mockRecordsQuery = vi.fn()

vi.mock('@TAF/services', () => ({
  recordsApi: {
    query: (...args: any[]) => mockRecordsQuery(...args),
  },
}))

vi.mock('@TAF/actions/records/local/setRecords', () => ({
  setRecords: (...args: any[]) => mockSetRecords(...args),
}))

describe('queryRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should query records and update state', async () => {
    const rows = [{ id: 'r1', data: { a: 1 } }]
    mockRecordsQuery.mockResolvedValueOnce({ data: rows })

    const result = await queryRecords({
      orgId: 'org-1',
      projectId: 'proj-1',
      collectionName: 'col-1',
      query: { limit: 10 },
    })

    expect(mockRecordsQuery).toHaveBeenCalledWith('org-1', 'proj-1', 'col-1', {
      limit: 10,
    })
    expect(mockSetRecords).toHaveBeenCalledWith('proj-1', 'col-1', rows)
    expect(result.data).toBe(rows)
  })

  it('should handle query errors without updating state', async () => {
    mockRecordsQuery.mockResolvedValueOnce({ error: new Error('bad query') })

    const result = await queryRecords({
      orgId: 'org-1',
      projectId: 'proj-1',
      collectionName: 'col-1',
      query: {},
    })

    expect(result.error).toBeDefined()
    expect(mockSetRecords).not.toHaveBeenCalled()
  })
})
