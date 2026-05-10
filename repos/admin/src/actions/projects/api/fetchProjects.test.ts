import { Project } from '@tdsk/domain'
import { fetchProjects } from './fetchProjects'
import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSetProjects = vi.fn()
const mockProjectsList = vi.fn()

vi.mock(`@TAF/state/accessors`, () => ({
  setProjects: (...args: any[]) => mockSetProjects(...args),
}))

vi.mock(`@TAF/services`, () => ({
  projectsApi: {
    list: (orgId: string) => mockProjectsList(orgId),
  },
}))

describe(`fetchProjects`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should fetch projects successfully and update state`, async () => {
    const mockProjects = [
      new Project({ id: `1`, name: `Project 1`, orgId: `org1` }),
      new Project({ id: `2`, name: `Project 2`, orgId: `org1` }),
    ]

    mockProjectsList.mockResolvedValueOnce({ data: mockProjects })

    const result = await fetchProjects({ orgId: `org1` })

    expect(mockProjectsList).toHaveBeenCalledWith(`org1`)
    expect(mockSetProjects).toHaveBeenCalled()
    expect(result.data).toBeDefined()
    expect(Object.keys(result.data!)).toHaveLength(2)
  })

  it(`should handle API errors`, async () => {
    mockProjectsList.mockResolvedValueOnce({
      error: new Error(`Failed to fetch projects`),
    })

    const result = await fetchProjects({ orgId: `org1` })

    expect(result.error).toBeDefined()
    expect(mockSetProjects).not.toHaveBeenCalled()
  })
})
