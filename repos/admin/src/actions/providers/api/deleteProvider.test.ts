import { describe, it, expect, beforeEach, vi } from 'vitest'
import { deleteProvider } from './deleteProvider'
import { query } from '@TAF/services/query'

const mockRemoveProvider = vi.fn()
const mockProvidersDelete = vi.fn()

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
  providersApi: {
    delete: (...args: any[]) => mockProvidersDelete(...args),
    cache: {
      list: vi.fn((...args: any[]) => ['providers', 'list', ...args]),
      detail: vi.fn((...args: any[]) => ['providers', 'detail', ...args]),
    },
  },
}))

vi.mock('@TAF/actions/providers/local/removeProvider', () => ({
  removeProvider: (...args: any[]) => mockRemoveProvider(...args),
}))

describe('deleteProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a provider successfully', async () => {
    mockProvidersDelete.mockResolvedValueOnce({ data: true })

    const result = await deleteProvider({ orgId: 'org-1', id: 'p1' })

    expect(mockProvidersDelete).toHaveBeenCalledWith('org-1', 'p1')
    expect(mockRemoveProvider).toHaveBeenCalledWith('p1')
    expect(query.removeFromListCache).toHaveBeenCalled()
    expect(query.client.removeQueries).toHaveBeenCalled()
    expect(result).toEqual({ success: true })
  })

  it('should handle deletion errors', async () => {
    mockProvidersDelete.mockResolvedValueOnce({
      error: new Error('Failed to delete provider'),
    })

    const result = await deleteProvider({ orgId: 'org-1', id: 'p1' })

    expect(result.error).toBeDefined()
    expect(mockRemoveProvider).not.toHaveBeenCalled()
    expect(query.removeFromListCache).not.toHaveBeenCalled()
    expect(query.client.removeQueries).not.toHaveBeenCalled()
  })
})
