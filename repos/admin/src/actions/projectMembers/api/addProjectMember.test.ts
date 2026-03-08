import { describe, it, expect, beforeEach, vi } from 'vitest'
import { addProjectMember } from './addProjectMember'

const mockAdd = vi.fn()
const mockRemoveQueries = vi.fn()
const mockListProjectMembers = vi.fn()

vi.mock('@TAF/services/projectMembersApi', () => ({
  projectMembersApi: {
    add: (...args: any[]) => mockAdd(...args),
  },
}))

vi.mock('@TAF/services/query', () => ({
  query: {
    client: {
      removeQueries: (...args: any[]) => mockRemoveQueries(...args),
    },
  },
}))

vi.mock('./listProjectMembers', () => ({
  listProjectMembers: (...args: any[]) => mockListProjectMembers(...args),
}))

describe('addProjectMember', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call service, clear cache, and re-fetch members on success', async () => {
    const mockResp = { data: { id: 'm1' } }
    mockAdd.mockResolvedValueOnce(mockResp)
    mockListProjectMembers.mockResolvedValueOnce({ data: [] })

    const result = await addProjectMember({
      orgId: 'org-1',
      projectId: 'proj-1',
      userId: 'user-1',
      roleType: 'member',
    })

    expect(mockAdd).toHaveBeenCalledWith('org-1', 'proj-1', {
      userId: 'user-1',
      roleType: 'member',
    })
    expect(mockRemoveQueries).toHaveBeenCalledWith({
      queryKey: ['projectMembers', 'org-1', 'proj-1'],
    })
    expect(mockListProjectMembers).toHaveBeenCalledWith({
      orgId: 'org-1',
      projectId: 'proj-1',
    })
    expect(result).toEqual(mockResp)
  })

  it('should return error and not clear cache or re-fetch on failure', async () => {
    const error = new Error('Failed')
    mockAdd.mockResolvedValueOnce({ error })

    const result = await addProjectMember({
      orgId: 'org-1',
      projectId: 'proj-1',
      userId: 'user-1',
      roleType: 'member',
    })

    expect(result.error).toBe(error)
    expect(mockRemoveQueries).not.toHaveBeenCalled()
    expect(mockListProjectMembers).not.toHaveBeenCalled()
  })
})
