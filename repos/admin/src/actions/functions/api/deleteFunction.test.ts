import { describe, it, expect, beforeEach, vi } from 'vitest'
import { deleteFunction } from './deleteFunction'
import { query } from '@TAF/services/query'

const mockRemoveFunction = vi.fn()
const mockFunctionsDelete = vi.fn()

vi.mock('@TAF/services/query', () => ({
  query: {
    upsertListCache: vi.fn(),
    removeFromListCache: vi.fn(),
    updateDetailCache: vi.fn(),
    client: {
      removeQueries: vi.fn(),
      invalidateQueries: vi.fn(),
    },
  },
}))

vi.mock('@TAF/services', () => ({
  functionsApi: {
    delete: (...args: any[]) => mockFunctionsDelete(...args),
    cache: {
      list: vi.fn((...args: any[]) => ['functions', 'list', ...args]),
      detail: vi.fn((...args: any[]) => ['functions', 'detail', ...args]),
    },
  },
}))

vi.mock('@TAF/actions/functions/local/removeFunction', () => ({
  removeFunction: (...args: any[]) => mockRemoveFunction(...args),
}))

describe('deleteFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId, projectId, and id and update local state', async () => {
    mockFunctionsDelete.mockResolvedValueOnce({ data: true })

    const result = await deleteFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      id: 'fn-1',
    })

    expect(mockFunctionsDelete).toHaveBeenCalledWith('org-1', 'proj-1', 'fn-1')
    expect(mockRemoveFunction).toHaveBeenCalledWith('proj-1', 'fn-1')
    expect(query.removeFromListCache).toHaveBeenCalled()
    expect(query.client.removeQueries).toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockFunctionsDelete.mockResolvedValueOnce({ error })

    const result = await deleteFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      id: 'fn-1',
    })

    expect(result).toEqual({ error })
    expect(mockRemoveFunction).not.toHaveBeenCalled()
    expect(query.removeFromListCache).not.toHaveBeenCalled()
    expect(query.client.removeQueries).not.toHaveBeenCalled()
  })
})
