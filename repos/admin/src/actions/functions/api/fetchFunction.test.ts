import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchFunction } from './fetchFunction'

const mockUpsertFunction = vi.fn()
const mockFunctionsGet = vi.fn()

vi.mock('@TAF/services', () => ({
  functionsApi: {
    get: (...args: any[]) => mockFunctionsGet(...args),
  },
}))

vi.mock('@TAF/actions/functions/local/upsertFunction', () => ({
  upsertFunction: (...args: any[]) => mockUpsertFunction(...args),
}))

describe('fetchFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId, projectId, and id and update local state', async () => {
    const mockData = { id: 'fn1', name: 'Function 1' }
    const resp = { data: mockData }
    mockFunctionsGet.mockResolvedValueOnce(resp)

    const result = await fetchFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      id: 'fn1',
    })

    expect(mockFunctionsGet).toHaveBeenCalledWith('org-1', 'proj-1', 'fn1')
    expect(mockUpsertFunction).toHaveBeenCalledWith('proj-1', mockData)
    expect(result).toEqual(resp)
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockFunctionsGet.mockResolvedValueOnce({ error })

    const result = await fetchFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      id: 'fn1',
    })

    expect(result).toEqual({ error })
    expect(mockUpsertFunction).not.toHaveBeenCalled()
  })
})
