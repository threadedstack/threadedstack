import { describe, it, expect, beforeEach, vi } from 'vitest'
import { removeFromOrg } from './removeFromOrg'

const mockRemoveFromOrg = vi.fn()
const mockRemoveOrgUser = vi.fn()

vi.mock('@TAF/services/usersApi', () => ({
  usersApi: {
    removeFromOrg: (...args: any[]) => mockRemoveFromOrg(...args),
  },
}))

vi.mock('@TAF/actions/users/local/removeOrgUser', () => ({
  removeOrgUser: (...args: any[]) => mockRemoveOrgUser(...args),
}))

describe('removeFromOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with correct args and update local state on success', async () => {
    const mockData = { success: true }
    mockRemoveFromOrg.mockResolvedValueOnce({ data: mockData })

    const result = await removeFromOrg('org-1', 'user-1')

    expect(mockRemoveFromOrg).toHaveBeenCalledWith('org-1', 'user-1')
    expect(mockRemoveOrgUser).toHaveBeenCalledWith('org-1', 'user-1')
    expect(result).toEqual({ data: mockData })
  })

  it('should return error and not update local state on failure', async () => {
    const error = new Error('Failed')
    mockRemoveFromOrg.mockResolvedValueOnce({ error })

    const result = await removeFromOrg('org-1', 'user-1')

    expect(result.error).toBe(error)
    expect(mockRemoveOrgUser).not.toHaveBeenCalled()
  })
})
