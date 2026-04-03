import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createProvider } from './createProvider'
import { query } from '@TAF/services/query'

const mockUpsertProvider = vi.fn()
const mockProvidersCreate = vi.fn()

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
    create: (...args: any[]) => mockProvidersCreate(...args),
    cache: {
      list: vi.fn((...args: any[]) => ['providers', 'list', ...args]),
      detail: vi.fn((...args: any[]) => ['providers', 'detail', ...args]),
    },
  },
}))

vi.mock('@TAF/actions/providers/local/upsertProvider', () => ({
  upsertProvider: (...args: any[]) => mockUpsertProvider(...args),
}))

describe('createProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create a provider successfully', async () => {
    const mockProvider = { id: 'p1', name: 'New Provider' }
    mockProvidersCreate.mockResolvedValueOnce({ data: mockProvider })

    const result = await createProvider({
      orgId: 'org-1',
      data: { name: 'New Provider' },
    })

    expect(mockProvidersCreate).toHaveBeenCalledWith('org-1', { name: 'New Provider' })
    expect(mockUpsertProvider).toHaveBeenCalledWith(mockProvider)
    expect(query.upsertListCache).toHaveBeenCalled()
    expect(result.data).toBeDefined()
    expect(result.data?.name).toBe('New Provider')
  })

  it('should handle creation errors', async () => {
    mockProvidersCreate.mockResolvedValueOnce({
      error: new Error('Failed to create provider'),
    })

    const result = await createProvider({
      orgId: 'org-1',
      data: { name: 'New Provider' },
    })

    expect(result.error).toBeDefined()
    expect(mockUpsertProvider).not.toHaveBeenCalled()
    expect(query.upsertListCache).not.toHaveBeenCalled()
  })
})
