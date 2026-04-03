import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createFunction } from './createFunction'
import { query } from '@TAF/services/query'

const mockUpsertFunction = vi.fn()
const mockFunctionsCreate = vi.fn()

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
    create: (...args: any[]) => mockFunctionsCreate(...args),
    cache: {
      list: vi.fn((...args: any[]) => ['functions', 'list', ...args]),
      detail: vi.fn((...args: any[]) => ['functions', 'detail', ...args]),
    },
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
    expect(query.upsertListCache).toHaveBeenCalled()
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
    expect(query.upsertListCache).not.toHaveBeenCalled()
  })
})
