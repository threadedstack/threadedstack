import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchFunctions } from './fetchFunctions'

const mockSetFunctions = vi.fn()
const mockFunctionsList = vi.fn()

vi.mock('@TAF/services', () => ({
  functionsApi: {
    list: (...args: any[]) => mockFunctionsList(...args),
  },
}))

vi.mock('@TAF/actions/functions/local/setFunctions', () => ({
  setFunctions: (...args: any[]) => mockSetFunctions(...args),
}))

describe('fetchFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId and projectId and update local state', async () => {
    const mockData = [{ id: 'fn1', name: 'Function 1' }]
    mockFunctionsList.mockResolvedValueOnce({ data: mockData })

    const result = await fetchFunctions({ orgId: 'org-1', projectId: 'proj-1' })

    expect(mockFunctionsList).toHaveBeenCalledWith('org-1', 'proj-1')
    expect(mockSetFunctions).toHaveBeenCalledWith('proj-1', mockData)
    expect(result).toEqual({ data: [{ id: 'fn1', name: 'Function 1' }] })
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockFunctionsList.mockResolvedValueOnce({ error })

    const result = await fetchFunctions({ orgId: 'org-1', projectId: 'proj-1' })

    expect(result.error).toBe(error)
    expect(mockSetFunctions).not.toHaveBeenCalled()
  })

  it('should return response without updating state when data is undefined', async () => {
    const resp = { data: undefined }
    mockFunctionsList.mockResolvedValueOnce(resp)

    const result = await fetchFunctions({ orgId: 'org-1', projectId: 'proj-1' })

    expect(result).toEqual(resp)
    expect(mockSetFunctions).not.toHaveBeenCalled()
  })
})
