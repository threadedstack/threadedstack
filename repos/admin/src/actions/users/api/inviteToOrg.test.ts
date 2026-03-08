import { describe, it, expect, beforeEach, vi } from 'vitest'
import { inviteToOrg } from './inviteToOrg'

const mockInviteToOrg = vi.fn()
const mockListOrg = vi.fn()
const mockRemoveQueries = vi.fn()
const mockListOrgUsers = vi.fn()

vi.mock('@TAF/services/usersApi', () => ({
  usersApi: {
    inviteToOrg: (...args: any[]) => mockInviteToOrg(...args),
    cache: {
      listOrg: (...args: any[]) => mockListOrg(...args),
    },
  },
}))

vi.mock('@TAF/services/query', () => ({
  query: {
    client: {
      removeQueries: (...args: any[]) => mockRemoveQueries(...args),
    },
  },
}))

vi.mock('@TAF/actions/users/api/listOrgUsers', () => ({
  listOrgUsers: (...args: any[]) => mockListOrgUsers(...args),
}))

describe('inviteToOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service, invalidate cache, and refresh users on success', async () => {
    const mockResp = { data: { id: 'inv-1' } }
    const mockCacheKey = ['users', 'org-1']
    mockInviteToOrg.mockResolvedValueOnce(mockResp)
    mockListOrg.mockReturnValueOnce(mockCacheKey)
    mockListOrgUsers.mockResolvedValueOnce({ data: [] })

    const result = await inviteToOrg('org-1', 'foo@bar.com', 'member')

    expect(mockInviteToOrg).toHaveBeenCalledWith('org-1', {
      roleType: 'member',
      email: 'foo@bar.com',
    })
    expect(mockListOrg).toHaveBeenCalledWith('org-1')
    expect(mockRemoveQueries).toHaveBeenCalledWith({ queryKey: mockCacheKey })
    expect(mockListOrgUsers).toHaveBeenCalledWith('org-1')
    expect(result).toBe(mockResp)
  })

  it('should return response without cache invalidation or refresh on error', async () => {
    const mockResp = { error: new Error('Failed') }
    mockInviteToOrg.mockResolvedValueOnce(mockResp)

    const result = await inviteToOrg('org-1', 'foo@bar.com', 'member')

    expect(result).toBe(mockResp)
    expect(mockRemoveQueries).not.toHaveBeenCalled()
    expect(mockListOrgUsers).not.toHaveBeenCalled()
  })

  it('should trim whitespace from email before calling service', async () => {
    const mockResp = { data: { id: 'inv-2' } }
    mockInviteToOrg.mockResolvedValueOnce(mockResp)
    mockListOrg.mockReturnValueOnce(['users', 'org-1'])
    mockListOrgUsers.mockResolvedValueOnce({ data: [] })

    await inviteToOrg('org-1', '  foo@bar.com  ', 'admin')

    expect(mockInviteToOrg).toHaveBeenCalledWith('org-1', {
      roleType: 'admin',
      email: 'foo@bar.com',
    })
  })
})
