import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Organization } from '@tdsk/domain'
import { fetchOrgs } from './fetchOrgs'

const mockSetOrgs = vi.fn()
const mockGetOrgs = vi.fn()
const mockOrgsList = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setOrgs: (...args: any[]) => mockSetOrgs(...args),
  getOrgs: (...args: any[]) => mockGetOrgs(...args),
}))

vi.mock('@TAF/services', () => ({
  orgsApi: {
    list: () => mockOrgsList(),
  },
}))

describe('fetchOrgs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch orgs and update state', async () => {
    const mockOrgs = [
      new Organization({ id: '1', name: 'Org 1', description: 'First org' }),
      new Organization({ id: '2', name: 'Org 2', description: 'Second org' }),
    ]

    mockOrgsList.mockResolvedValueOnce({ data: mockOrgs })

    const result = await fetchOrgs()

    expect(mockOrgsList).toHaveBeenCalled()
    expect(mockSetOrgs).toHaveBeenCalled()
    expect(result.data).toBeDefined()
    expect(Object.keys(result.data!)).toHaveLength(2)
  })

  it('should handle API errors', async () => {
    mockOrgsList.mockResolvedValueOnce({
      error: new Error('Failed to fetch orgs'),
    })

    const result = await fetchOrgs()

    expect(result.error).toBeDefined()
    expect(mockSetOrgs).not.toHaveBeenCalled()
  })

  it('should merge fetched orgs into existing state without evicting entries', async () => {
    const existing = {
      og_active: {
        id: 'og_active',
        name: 'Active Org',
        userRole: 'owner',
        resolvedPermissions: 'super',
      },
      og_shared: { id: 'og_shared', name: 'Old Name', userRole: 'member' },
    }
    mockGetOrgs.mockReturnValueOnce(existing)

    const listData = {
      og_shared: { id: 'og_shared', name: 'New Name', userRole: 'member' },
      og_other: { id: 'og_other', name: 'Other Org', userRole: 'owner' },
    }
    mockOrgsList.mockResolvedValueOnce({ data: listData })

    await fetchOrgs()

    expect(mockSetOrgs).toHaveBeenCalledWith({
      // Entry not in the paginated list response is preserved
      og_active: existing.og_active,
      // List entry updates the existing entry but keeps detail-only fields
      og_shared: { id: 'og_shared', name: 'New Name', userRole: 'member' },
      og_other: { id: 'og_other', name: 'Other Org', userRole: 'owner' },
    })
  })
})
