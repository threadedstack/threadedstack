import { describe, it, expect, beforeEach, vi } from 'vitest'
import { deleteRecord } from './deleteRecord'

const mockRemoveRecord = vi.fn()
const mockRecordsDelete = vi.fn()

vi.mock('@TAF/services', () => ({
  recordsApi: {
    delete: (...args: any[]) => mockRecordsDelete(...args),
  },
}))

vi.mock('@TAF/actions/records/local/removeRecord', () => ({
  removeRecord: (...args: any[]) => mockRemoveRecord(...args),
}))

describe('deleteRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a record and update state', async () => {
    mockRecordsDelete.mockResolvedValueOnce({ data: { success: true } })

    const result = await deleteRecord({
      orgId: 'org-1',
      projectId: 'proj-1',
      collectionName: 'col-1',
      id: 'r1',
    })

    expect(mockRecordsDelete).toHaveBeenCalledWith('org-1', 'proj-1', 'col-1', 'r1')
    expect(mockRemoveRecord).toHaveBeenCalledWith('proj-1', 'col-1', 'r1')
    expect(result).toEqual({ success: true })
  })

  it('should handle delete errors without updating state', async () => {
    mockRecordsDelete.mockResolvedValueOnce({ error: new Error('not found') })

    const result = await deleteRecord({
      orgId: 'org-1',
      projectId: 'proj-1',
      collectionName: 'col-1',
      id: 'missing',
    })

    expect(result.error).toBeDefined()
    expect(mockRemoveRecord).not.toHaveBeenCalled()
  })
})
