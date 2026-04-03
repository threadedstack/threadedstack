import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Organization } from '@tdsk/domain'
import { createOrg } from './createOrg'
import { query } from '@TAF/services/query'

const mockSetOrgs = vi.fn()
const mockGetOrgs = vi.fn()
const mockOrgsCreate = vi.fn()

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

vi.mock('@TAF/state/accessors', () => ({
  setOrgs: (...args: any[]) => mockSetOrgs(...args),
  getOrgs: () => mockGetOrgs(),
}))

vi.mock('@TAF/services', () => ({
  orgsApi: {
    create: (data: any) => mockOrgsCreate(data),
    cache: {
      list: vi.fn((...args: any[]) => ['orgs', 'list', ...args]),
      detail: vi.fn((...args: any[]) => ['orgs', 'detail', ...args]),
    },
  },
}))

describe('createOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetOrgs.mockReturnValue({})
  })

  it('should create a org successfully', async () => {
    const mockOrg = new Organization({
      id: '1',
      name: 'New Org',
      description: 'A new org',
    })

    mockOrgsCreate.mockResolvedValueOnce({ data: mockOrg })

    const result = await createOrg({
      name: 'New Org',
      description: 'A new org',
    })

    expect(mockOrgsCreate).toHaveBeenCalledWith({
      name: 'New Org',
      description: 'A new org',
    })
    expect(mockSetOrgs).toHaveBeenCalled()
    expect(query.client.invalidateQueries).toHaveBeenCalled()
    expect(result.org).toBeDefined()
    expect(result.org?.name).toBe('New Org')
  })

  it('should handle creation errors', async () => {
    mockOrgsCreate.mockResolvedValueOnce({
      error: new Error('Failed to create org'),
    })

    const result = await createOrg({
      name: 'New Org',
    })

    expect(result.error).toBeDefined()
    expect(mockSetOrgs).not.toHaveBeenCalled()
    expect(query.client.invalidateQueries).not.toHaveBeenCalled()
  })
})
