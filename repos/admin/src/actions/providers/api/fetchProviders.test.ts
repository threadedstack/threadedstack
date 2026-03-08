import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchProviders } from './fetchProviders'

const mockSetProviders = vi.fn()
const mockProvidersList = vi.fn()

vi.mock('@TAF/services', () => ({
  providersApi: {
    list: (...args: any[]) => mockProvidersList(...args),
  },
}))

vi.mock('@TAF/actions/providers/local/setProviders', () => ({
  setProviders: (...args: any[]) => mockSetProviders(...args),
}))

describe('fetchProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId and update local state on success', async () => {
    const mockData = [{ id: 'p1', name: 'Provider 1' }]
    mockProvidersList.mockResolvedValueOnce({ data: mockData })

    const result = await fetchProviders({ orgId: 'org-1' })

    expect(mockProvidersList).toHaveBeenCalledWith('org-1')
    expect(mockSetProviders).toHaveBeenCalledWith(mockData)
    expect(result).toEqual({ data: [{ id: 'p1', name: 'Provider 1' }] })
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed to fetch providers')
    mockProvidersList.mockResolvedValueOnce({ error })

    const result = await fetchProviders({ orgId: 'org-1' })

    expect(result.error).toBe(error)
    expect(mockSetProviders).not.toHaveBeenCalled()
  })

  it('should return response without updating state when data is undefined', async () => {
    const resp = { data: undefined }
    mockProvidersList.mockResolvedValueOnce(resp)

    const result = await fetchProviders({ orgId: 'org-1' })

    expect(result).toEqual(resp)
    expect(mockSetProviders).not.toHaveBeenCalled()
  })
})
