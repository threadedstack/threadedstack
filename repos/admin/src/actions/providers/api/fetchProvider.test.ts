import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchProvider } from './fetchProvider'

const mockUpsertProvider = vi.fn()
const mockProvidersGet = vi.fn()

vi.mock('@TAF/services', () => ({
  providersApi: {
    get: (...args: any[]) => mockProvidersGet(...args),
  },
}))

vi.mock('@TAF/actions/providers/local/upsertProvider', () => ({
  upsertProvider: (...args: any[]) => mockUpsertProvider(...args),
}))

describe('fetchProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId and id and update local state', async () => {
    const mockData = { id: 'p1', name: 'Provider 1' }
    const resp = { data: mockData }
    mockProvidersGet.mockResolvedValueOnce(resp)

    const result = await fetchProvider({
      orgId: 'org-1',
      id: 'p1',
    })

    expect(mockProvidersGet).toHaveBeenCalledWith('org-1', 'p1')
    expect(mockUpsertProvider).toHaveBeenCalledWith(mockData)
    expect(result).toEqual(resp)
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockProvidersGet.mockResolvedValueOnce({ error })

    const result = await fetchProvider({
      orgId: 'org-1',
      id: 'p1',
    })

    expect(result).toEqual({ error })
    expect(mockUpsertProvider).not.toHaveBeenCalled()
  })
})
