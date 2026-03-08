import { describe, it, expect, beforeEach, vi } from 'vitest'
import { updateOrgRole } from './updateOrgRole'

const mockUpdateRole = vi.fn()
const mockUpdateOrgUserRole = vi.fn()

vi.mock('@TAF/services/usersApi', () => ({
  usersApi: {
    updateRole: (...args: any[]) => mockUpdateRole(...args),
  },
}))

vi.mock('@TAF/actions/users/local/updateOrgUserRole', () => ({
  updateOrgUserRole: (...args: any[]) => mockUpdateOrgUserRole(...args),
}))

describe('updateOrgRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with correct args and update local state on success', async () => {
    const mockData = { id: 'u1', role: 'admin' }
    mockUpdateRole.mockResolvedValueOnce({ data: mockData })

    const result = await updateOrgRole('org-1', 'user-1', 'admin')

    expect(mockUpdateRole).toHaveBeenCalledWith('org-1', 'user-1', 'admin')
    expect(mockUpdateOrgUserRole).toHaveBeenCalledWith('org-1', 'user-1', 'admin')
    expect(result).toEqual({ data: mockData })
  })

  it('should return error and not update local state on failure', async () => {
    const error = new Error('Failed')
    mockUpdateRole.mockResolvedValueOnce({ error })

    const result = await updateOrgRole('org-1', 'user-1', 'admin')

    expect(result.error).toBe(error)
    expect(mockUpdateOrgUserRole).not.toHaveBeenCalled()
  })
})
