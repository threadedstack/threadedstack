import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listProjectMembers } from './listProjectMembers'

const mockList = vi.fn()
const mockSetProjectMembers = vi.fn()

vi.mock('@TAF/services/projectMembersApi', () => ({
  projectMembersApi: {
    list: (...args: any[]) => mockList(...args),
  },
}))

vi.mock('@TAF/actions/projectMembers/local/setProjectMembers', () => ({
  setProjectMembers: (...args: any[]) => mockSetProjectMembers(...args),
}))

describe('listProjectMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service with orgId and projectId and update local state', async () => {
    const mockData = [{ id: 'm1', userId: 'u1' }]
    const mockResp = { data: mockData }
    mockList.mockResolvedValueOnce(mockResp)

    const result = await listProjectMembers({ orgId: 'org-1', projectId: 'proj-1' })

    expect(mockList).toHaveBeenCalledWith('org-1', 'proj-1')
    expect(mockSetProjectMembers).toHaveBeenCalledWith('proj-1', mockData)
    expect(result).toEqual(mockResp)
  })

  it('should return error and not update state on failure', async () => {
    const error = new Error('Failed')
    mockList.mockResolvedValueOnce({ error })

    const result = await listProjectMembers({ orgId: 'org-1', projectId: 'proj-1' })

    expect(result.error).toBe(error)
    expect(mockSetProjectMembers).not.toHaveBeenCalled()
  })
})
