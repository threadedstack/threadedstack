import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateProvider } from './updateProvider'
import { query } from '@TAF/services/query'

const mockUpsertProvider = vi.fn()
const mockProvidersUpdate = vi.fn()

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
    update: (...args: any[]) => mockProvidersUpdate(...args),
    cache: {
      list: vi.fn((...args: any[]) => ['providers', 'list', ...args]),
      detail: vi.fn((...args: any[]) => ['providers', 'detail', ...args]),
    },
  },
}))

vi.mock('@TAF/actions/providers/local/upsertProvider', () => ({
  upsertProvider: (...args: any[]) => mockUpsertProvider(...args),
}))

describe('updateProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId, id, and data and update local state', async () => {
    const mockData = { id: 'p1', name: 'Updated Provider' }
    const resp = { data: mockData }
    mockProvidersUpdate.mockResolvedValueOnce(resp)

    const result = await updateProvider({
      orgId: 'org-1',
      id: 'p1',
      data: { name: 'Updated Provider' },
    })

    expect(mockProvidersUpdate).toHaveBeenCalledWith('org-1', 'p1', {
      name: 'Updated Provider',
    })
    expect(mockUpsertProvider).toHaveBeenCalledWith(mockData)
    expect(query.upsertListCache).toHaveBeenCalled()
    expect(query.updateDetailCache).toHaveBeenCalled()
    expect(result).toEqual(resp)
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockProvidersUpdate.mockResolvedValueOnce({ error })

    const result = await updateProvider({
      orgId: 'org-1',
      id: 'p1',
      data: { name: 'Updated Provider' },
    })

    expect(result).toEqual({ error })
    expect(mockUpsertProvider).not.toHaveBeenCalled()
    expect(query.upsertListCache).not.toHaveBeenCalled()
    expect(query.updateDetailCache).not.toHaveBeenCalled()
  })
})
