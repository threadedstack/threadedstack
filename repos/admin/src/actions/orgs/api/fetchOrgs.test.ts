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
    list: (...args: any[]) => mockOrgsList(...args),
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

  it('should merge per-entry on full refresh without downgrading detail-only fields (clobber-race regression)', async () => {
    const existing = {
      og_active: {
        id: 'og_active',
        name: 'Active Org',
        userRole: 'owner',
        resolvedPermissions: 'super',
      },
    }
    mockGetOrgs.mockReturnValueOnce(existing)

    // The list entry for the active org lacks detail-only fields
    const listData = {
      og_active: { id: 'og_active', name: 'Active Org Renamed', userRole: 'owner' },
      og_other: { id: 'og_other', name: 'Other Org', userRole: 'owner' },
    }
    mockOrgsList.mockResolvedValueOnce({ data: listData })

    await fetchOrgs()

    expect(mockSetOrgs).toHaveBeenCalledWith({
      // List fields update the entry, detail-only fields survive the merge
      og_active: {
        id: 'og_active',
        name: 'Active Org Renamed',
        userRole: 'owner',
        resolvedPermissions: 'super',
      },
      og_other: { id: 'og_other', name: 'Other Org', userRole: 'owner' },
    })
  })

  it('should evict orgs absent from a full (non-paginated) refresh', async () => {
    const existing = {
      og_kept: { id: 'og_kept', name: 'Kept Org', userRole: 'owner' },
      og_deleted: { id: 'og_deleted', name: 'Deleted Server-Side', userRole: 'member' },
    }
    mockGetOrgs.mockReturnValueOnce(existing)

    const listData = {
      og_kept: { id: 'og_kept', name: 'Kept Org', userRole: 'owner' },
    }
    mockOrgsList.mockResolvedValueOnce({ data: listData })

    await fetchOrgs()

    expect(mockSetOrgs).toHaveBeenCalledWith({
      og_kept: { id: 'og_kept', name: 'Kept Org', userRole: 'owner' },
    })
    const setArg = mockSetOrgs.mock.calls[0][0]
    expect(setArg.og_deleted).toBeUndefined()
  })

  it('should preserve entries outside the page on a paginated fetch', async () => {
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

    await fetchOrgs({ limit: 2, offset: 2 })

    expect(mockOrgsList).toHaveBeenCalledWith({ limit: 2, offset: 2 })
    expect(mockSetOrgs).toHaveBeenCalledWith({
      // Entry not in the paginated page response is preserved
      og_active: existing.og_active,
      // Page entry updates the existing entry
      og_shared: { id: 'og_shared', name: 'New Name', userRole: 'member' },
      og_other: { id: 'og_other', name: 'Other Org', userRole: 'owner' },
    })
  })
})
