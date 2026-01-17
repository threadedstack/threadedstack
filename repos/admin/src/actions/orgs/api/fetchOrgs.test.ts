import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Organization } from '@tdsk/domain'
import { fetchOrgs } from './fetchOrgs'

const mockSetOrgs = vi.fn()
const mockSetActiveOrgRole = vi.fn()
const mockGetActiveOrgId = vi.fn()
const mockOrgsList = vi.fn()

vi.mock('@TAF/state/accessors', () => ({
  setOrgs: (...args: any[]) => mockSetOrgs(...args),
  setActiveOrgRole: (...args: any[]) => mockSetActiveOrgRole(...args),
  getActiveOrgId: () => mockGetActiveOrgId(),
}))

vi.mock('@TAF/services', () => ({
  orgsApi: {
    list: () => mockOrgsList(),
  },
}))

describe('fetchOrgs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveOrgId.mockReturnValue(undefined)
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
})
