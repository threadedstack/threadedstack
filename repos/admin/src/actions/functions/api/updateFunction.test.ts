import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateFunction } from './updateFunction'

const mockUpsertFunction = vi.fn()
const mockFunctionsUpdate = vi.fn()

vi.mock('@TAF/services', () => ({
  functionsApi: {
    update: (...args: any[]) => mockFunctionsUpdate(...args),
  },
}))

vi.mock('@TAF/actions/functions/local/upsertFunction', () => ({
  upsertFunction: (...args: any[]) => mockUpsertFunction(...args),
}))

describe('updateFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId, projectId, id, and data and update local state', async () => {
    const mockData = { id: 'fn1', name: 'Updated Function' }
    const resp = { data: mockData }
    mockFunctionsUpdate.mockResolvedValueOnce(resp)

    const result = await updateFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      id: 'fn1',
      data: { name: 'Updated Function' },
    })

    expect(mockFunctionsUpdate).toHaveBeenCalledWith('org-1', 'proj-1', 'fn1', {
      name: 'Updated Function',
    })
    expect(mockUpsertFunction).toHaveBeenCalledWith('proj-1', mockData)
    expect(result).toEqual(resp)
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockFunctionsUpdate.mockResolvedValueOnce({ error })

    const result = await updateFunction({
      orgId: 'org-1',
      projectId: 'proj-1',
      id: 'fn1',
      data: { name: 'Updated Function' },
    })

    expect(result).toEqual({ error })
    expect(mockUpsertFunction).not.toHaveBeenCalled()
  })
})
