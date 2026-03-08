import { describe, it, expect, beforeEach, vi } from 'vitest'
import { removeProjectMember } from './removeProjectMember'

const mockRemove = vi.fn()
const mockRemoveProjectMemberLocal = vi.fn()

vi.mock('@TAF/services/projectMembersApi', () => ({
  projectMembersApi: {
    remove: (...args: any[]) => mockRemove(...args),
  },
}))

vi.mock('@TAF/actions/projectMembers/local/removeProjectMember', () => ({
  removeProjectMemberLocal: (...args: any[]) => mockRemoveProjectMemberLocal(...args),
}))

describe('removeProjectMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service and update local state on success', async () => {
    const mockResp = { data: { success: true } }
    mockRemove.mockResolvedValueOnce(mockResp)

    const result = await removeProjectMember({
      orgId: 'org-1',
      projectId: 'proj-1',
      userId: 'user-1',
    })

    expect(mockRemove).toHaveBeenCalledWith('org-1', 'proj-1', 'user-1')
    expect(mockRemoveProjectMemberLocal).toHaveBeenCalledWith('proj-1', 'user-1')
    expect(result).toEqual(mockResp)
  })

  it('should return error and not update local state on failure', async () => {
    const error = new Error('Failed')
    mockRemove.mockResolvedValueOnce({ error })

    const result = await removeProjectMember({
      orgId: 'org-1',
      projectId: 'proj-1',
      userId: 'user-1',
    })

    expect(result.error).toBe(error)
    expect(mockRemoveProjectMemberLocal).not.toHaveBeenCalled()
  })
})
