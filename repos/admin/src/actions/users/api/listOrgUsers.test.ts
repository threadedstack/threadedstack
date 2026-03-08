import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listOrgUsers } from './listOrgUsers'

const mockListByOrg = vi.fn()
const mockSetOrgUsers = vi.fn()

vi.mock('@TAF/services/usersApi', () => ({
  usersApi: {
    listByOrg: (...args: any[]) => mockListByOrg(...args),
  },
}))

vi.mock('@TAF/actions/users/local/setOrgUsers', () => ({
  setOrgUsers: (...args: any[]) => mockSetOrgUsers(...args),
}))

describe('listOrgUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId and update local state on success', async () => {
    const mockData = [{ id: 'u1', name: 'User 1' }]
    mockListByOrg.mockResolvedValueOnce({ data: mockData })

    const result = await listOrgUsers('org-1')

    expect(mockListByOrg).toHaveBeenCalledWith('org-1')
    expect(mockSetOrgUsers).toHaveBeenCalledWith('org-1', mockData)
    expect(result).toEqual({ data: mockData })
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockListByOrg.mockResolvedValueOnce({ error })

    const result = await listOrgUsers('org-1')

    expect(result.error).toBe(error)
    expect(mockSetOrgUsers).not.toHaveBeenCalled()
  })
})
