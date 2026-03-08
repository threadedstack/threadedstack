import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFunction } from './createFunction'

const mockUpsertFunction = vi.fn()
const mockFunctionsCreate = vi.fn()

vi.mock('@TAF/services', () => ({
  functionsApi: {
    create: (...args: any[]) => mockFunctionsCreate(...args),
  },
}))

vi.mock('@TAF/actions/functions/local/upsertFunction', () => ({
  upsertFunction: (...args: any[]) => mockUpsertFunction(...args),
}))

describe('createFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId, projectId, and data and update local state', async () => {
    const mockData = { id: 'fn1', name: 'Function 1' }
    const resp = { data: mockData }
    mockFunctionsCreate.mockResolvedValueOnce(resp)

    const result = await createFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      data: { name: 'Function 1' },
    })

    expect(mockFunctionsCreate).toHaveBeenCalledWith('org-1', 'proj-1', {
      name: 'Function 1',
    })
    expect(mockUpsertFunction).toHaveBeenCalledWith('proj-1', mockData)
    expect(result).toEqual(resp)
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockFunctionsCreate.mockResolvedValueOnce({ error })

    const result = await createFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      data: { name: 'Function 1' },
    })

    expect(result).toEqual({ error })
    expect(mockUpsertFunction).not.toHaveBeenCalled()
  })
})
